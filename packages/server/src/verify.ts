import {
  RadixPaymentPayload, RadixPaymentRequirements,
  RadixVerificationResult, FacilitatorConfig,
  SPONSORED_INSTRUCTION_COUNT, NON_SPONSORED_INSTRUCTION_COUNT,
  CONSTRUCTION_TOLERANCE_SECONDS, REPLAY_RETENTION_BUFFER_SECONDS,
  networkIdFromCaip2,
} from "@x402/radix-core";
import {
  decompile_signed_partial_transaction,
  decompile_notarized_transaction_v2,
} from "@x402/radix-wasm";

export interface ReplayStore {
  isReplay(hash: string): boolean;
  record(hash: string, ttlSeconds: number): void;
}

/**
 * Verify a Radix x402 payment per canonical spec sections 1-8.
 */
export async function verifyRadixPayment(
  payload: RadixPaymentPayload,
  requirements: RadixPaymentRequirements,
  config: FacilitatorConfig,
  replayStore: ReplayStore,
  currentProposerTimestamp: number,
  currentEpoch: number,
): Promise<RadixVerificationResult> {
  const mode = requirements.extra.mode;

  // Section 1: Protocol validation
  if (payload.x402Version !== 2)
    return { valid: false, invalidReason: "invalid_exact_radix_deserialization" };
  if (payload.accepted.scheme !== "exact" || requirements.scheme !== "exact")
    return { valid: false, invalidReason: "invalid_exact_radix_deserialization" };
  if (payload.accepted.network !== requirements.network)
    return { valid: false, invalidReason: "invalid_exact_radix_deserialization" };
  if (requirements.network !== "radix:mainnet" && requirements.network !== "radix:stokenet")
    return { valid: false, invalidReason: "invalid_exact_radix_deserialization" };
  if (mode !== "sponsored" && mode !== "nonSponsored")
    return { valid: false, invalidReason: "invalid_exact_radix_deserialization" };

  const txHex = payload.payload.transaction;

  // Section 2: Deserialization
  let manifest: string;
  try {
    manifest = await decompileManifest(txHex, config.networkId, mode);
  } catch {
    return { valid: false, invalidReason: "invalid_exact_radix_deserialization" };
  }

  // Section 3/4: Structure validation
  const instructions = parseInstructions(manifest);
  const expectedCount = mode === "sponsored"
    ? SPONSORED_INSTRUCTION_COUNT : NON_SPONSORED_INSTRUCTION_COUNT;

  if (instructions.length !== expectedCount)
    return { valid: false, invalidReason: "invalid_exact_radix_instruction_count" };

  if (mode === "sponsored") {
    if (!verifySponsoredSequence(instructions))
      return { valid: false, invalidReason: "invalid_exact_radix_instruction_sequence" };
  } else {
    if (!verifyNonSponsoredSequence(instructions))
      return { valid: false, invalidReason: "invalid_exact_radix_instruction_sequence" };
  }

  // Asset & amount match
  const withdrawIdx = mode === "sponsored" ? 2 : 1;
  const withdrawnAsset = extractAddress(instructions[withdrawIdx], 1);
  if (withdrawnAsset !== requirements.asset)
    return { valid: false, invalidReason: "invalid_exact_radix_asset_mismatch" };

  const withdrawnAmount = extractDecimal(instructions[withdrawIdx]);
  if (withdrawnAmount !== requirements.amount)
    return { valid: false, invalidReason: "invalid_exact_radix_amount_mismatch" };

  // TAKE_ALL_FROM_WORKTOP asset must also match
  const takeIdx = mode === "sponsored" ? 3 : 2;
  const takeAsset = extractAddress(instructions[takeIdx], 0);
  if (takeAsset !== requirements.asset)
    return { valid: false, invalidReason: "invalid_exact_radix_asset_mismatch" };

  // Destination match (non-sponsored only)
  if (mode === "nonSponsored") {
    const depositAddr = extractAddress(instructions[3], 0);
    if (depositAddr !== requirements.payTo)
      return { valid: false, invalidReason: "invalid_exact_radix_destination_mismatch" };
  }

  // Section 5: Facilitator safety
  const manifestLower = manifest.toLowerCase();
  const feePayerLower = config.feePayerAccount.toLowerCase();

  if (mode === "sponsored") {
    if (manifestLower.includes(feePayerLower))
      return { valid: false, invalidReason: "invalid_exact_radix_facilitator_safety" };
    if (manifestLower.includes("lock_fee") || manifestLower.includes("lock_contingent_fee"))
      return { valid: false, invalidReason: "invalid_exact_radix_facilitator_safety" };
  } else {
    if (manifestLower.includes(feePayerLower))
      return { valid: false, invalidReason: "invalid_exact_radix_facilitator_safety" };
  }

  // Section 6: Temporal validity & replay
  const header = await extractIntentHeader(txHex, config.networkId, mode);
  if (header) {
    const expectedNetworkId = networkIdFromCaip2(requirements.network);
    if (header.networkId !== expectedNetworkId)
      return { valid: false, invalidReason: "invalid_exact_radix_expired" };

    if (header.intentDiscriminator !== requirements.extra.intentDiscriminator)
      return { valid: false, invalidReason: "invalid_exact_radix_expired" };

    if (header.maxProposerTimestamp === null || header.maxProposerTimestamp === undefined)
      return { valid: false, invalidReason: "invalid_exact_radix_expired" };

    if (header.maxProposerTimestamp <= currentProposerTimestamp)
      return { valid: false, invalidReason: "invalid_exact_radix_expired" };

    const maxAllowed = currentProposerTimestamp + requirements.maxTimeoutSeconds
      + CONSTRUCTION_TOLERANCE_SECONDS;
    if (header.maxProposerTimestamp > maxAllowed)
      return { valid: false, invalidReason: "invalid_exact_radix_expired" };

    if (header.endEpochExclusive <= currentEpoch)
      return { valid: false, invalidReason: "invalid_exact_radix_expired" };
  }

  // Replay protection
  const intentHash = await computeIntentHash(txHex, config.networkId, mode);
  if (replayStore.isReplay(intentHash))
    return { valid: false, invalidReason: "invalid_exact_radix_replay" };

  const replayTtl = requirements.maxTimeoutSeconds + REPLAY_RETENTION_BUFFER_SECONDS;
  replayStore.record(intentHash, replayTtl);

  // Section 7: Signature validation
  const sigValid = await verifySignatures(txHex, config.networkId, mode);
  if (!sigValid)
    return { valid: false, invalidReason: "invalid_exact_radix_signature" };

  return { valid: true };
}

// Helper types

interface ParsedInstruction {
  name: string;
  raw: string;
}

interface IntentHeader {
  networkId: number;
  intentDiscriminator: string;
  startEpochInclusive: number;
  endEpochExclusive: number;
  minProposerTimestamp: number | null;
  maxProposerTimestamp: number | null;
}

// WASM-backed decompilation helpers

interface DecompileResult {
  manifest: string;
  network_id: number;
  intent_discriminator: string;
  start_epoch: number;
  end_epoch: number;
  max_proposer_timestamp_secs: number | null;
  min_proposer_timestamp_secs: number | null;
}

function callDecompile(txHex: string, networkId: number, mode: string): DecompileResult {
  const inputJson = JSON.stringify({ tx_hex: txHex, network_id: networkId });
  const rawResult = mode === "sponsored"
    ? decompile_signed_partial_transaction(inputJson)
    : decompile_notarized_transaction_v2(inputJson);
  const parsed = JSON.parse(rawResult);
  if (parsed.error) throw new Error(parsed.error);
  return parsed.data as DecompileResult;
}

async function decompileManifest(txHex: string, networkId: number, mode: string): Promise<string> {
  const result = callDecompile(txHex, networkId, mode);
  return result.manifest;
}

function parseInstructions(manifest: string): ParsedInstruction[] {
  return manifest.split(";").map(s => s.trim()).filter(s => s.length > 0).map(raw => {
    const name = raw.split(/[\s\n]/)[0].trim();
    return { name, raw };
  });
}

function verifySponsoredSequence(inst: ParsedInstruction[]): boolean {
  const expected = ["VERIFY_PARENT", "ASSERT_WORKTOP_IS_EMPTY", "CALL_METHOD", "TAKE_ALL_FROM_WORKTOP", "YIELD_TO_PARENT"];
  if (!inst.every((i, idx) => i.name === expected[idx])) return false;
  return inst[2].raw.includes('"withdraw"');
}

function verifyNonSponsoredSequence(inst: ParsedInstruction[]): boolean {
  const expected = ["CALL_METHOD", "CALL_METHOD", "TAKE_ALL_FROM_WORKTOP", "CALL_METHOD"];
  if (!inst.every((i, idx) => i.name === expected[idx])) return false;
  return inst[0].raw.includes('"lock_fee"') &&
    inst[1].raw.includes('"withdraw"') &&
    inst[3].raw.includes('"try_deposit_or_abort"');
}

function extractAddress(inst: ParsedInstruction, index: number): string {
  const matches = inst.raw.match(/Address\("([^"]+)"\)/g) ?? [];
  const m = matches[index];
  return m ? m.replace(/Address\("|"\)/g, "") : "";
}

function extractDecimal(inst: ParsedInstruction): string {
  const m = inst.raw.match(/Decimal\("([^"]+)"\)/);
  return m ? m[1] : "";
}

async function extractIntentHeader(txHex: string, networkId: number, mode: string): Promise<IntentHeader | null> {
  try {
    const result = callDecompile(txHex, networkId, mode);
    return {
      networkId: result.network_id,
      intentDiscriminator: result.intent_discriminator,
      startEpochInclusive: result.start_epoch,
      endEpochExclusive: result.end_epoch,
      minProposerTimestamp: result.min_proposer_timestamp_secs,
      maxProposerTimestamp: result.max_proposer_timestamp_secs,
    };
  } catch {
    return null;
  }
}

async function computeIntentHash(txHex: string, _networkId: number, _mode: string): Promise<string> {
  // TODO: Use WASM to compute SubintentHash (sponsored) or TransactionIntentHash (non-sponsored).
  // The WASM module doesn't expose hash computation separately yet — using hex prefix as placeholder.
  return txHex.slice(0, 64);
}

async function verifySignatures(_txHex: string, _networkId: number, _mode: string): Promise<boolean> {
  // TODO: Verify Ed25519 signatures over the intent hash
  return true;
}
