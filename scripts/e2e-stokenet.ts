#!/usr/bin/env -S npx tsx
/**
 * End-to-end Stokenet test for x402-radix.
 *
 * Exercises the full payment flow:
 *   1. Fetch Gateway status (live epoch + proposer timestamp)
 *   2. Generate payment requirements (simulating the resource server)
 *   3. Build a signed subintent via the client SDK (agent side)
 *   4. POST /verify to the facilitator
 *   5. POST /settle to the facilitator
 *   6. Poll Gateway for on-chain confirmation
 *
 * Usage:
 *   # Set env vars (or export them):
 *   AGENT_PRIVATE_KEY_HEX=...       # Agent's Ed25519 private key (64 hex chars)
 *   AGENT_ACCOUNT=account_tdx_2_... # Agent's funded Stokenet account
 *   FACILITATOR_URL=http://localhost:4020
 *   PAYMENT_AMOUNT=1                # XRD to send (default: 1)
 *
 *   npx tsx scripts/e2e-stokenet.ts
 *
 * The facilitator must be running. See DEPLOYMENT.md.
 */

import { randomBytes } from "node:crypto";

// ─── Config ───

const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:4020";
const AGENT_PRIVATE_KEY_HEX = requireEnv("AGENT_PRIVATE_KEY_HEX");
const AGENT_ACCOUNT = requireEnv("AGENT_ACCOUNT");
const PAYMENT_AMOUNT = process.env.PAYMENT_AMOUNT ?? "1";
const STOKENET_GATEWAY = "https://stokenet.radixdlt.com";
const XRD_STOKENET = "resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc";

// ─── Helpers ───

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return val;
}

function log(step: string, msg: string) {
  console.log(`[${step}] ${msg}`);
}

function fail(step: string, msg: string, detail?: unknown): never {
  console.error(`[${step}] FAILED: ${msg}`);
  if (detail) console.error(detail);
  process.exit(1);
}

async function fetchJson(url: string, body: unknown): Promise<Record<string, unknown>> {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resp.json() as Record<string, unknown>;
  if (!resp.ok) {
    throw new Error(`${resp.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

// ─── Step 1: Gateway status ───

async function getGatewayStatus() {
  log("1/6", "Fetching Stokenet Gateway status...");
  const data = await fetchJson(`${STOKENET_GATEWAY}/status/gateway-status`, {});
  const ledger = data.ledger_state as Record<string, unknown>;
  const epoch = Number(ledger.epoch);
  const stateVersion = Number(ledger.state_version);
  const timestamp = ledger.proposer_round_timestamp as string;
  log("1/6", `Epoch: ${epoch}, State version: ${stateVersion}, Timestamp: ${timestamp}`);
  return { epoch, timestamp };
}

// ─── Step 2: Generate payment requirements ───

function generateRequirements(notaryBadge: string): Record<string, unknown> {
  const discriminator = generateU64();
  log("2/6", `Generated intent discriminator: ${discriminator}`);

  return {
    scheme: "exact",
    network: "radix:stokenet",
    asset: XRD_STOKENET,
    amount: PAYMENT_AMOUNT,
    payTo: AGENT_ACCOUNT, // paying self for test purposes
    maxTimeoutSeconds: 120,
    extra: {
      mode: "sponsored",
      notaryBadge,
      intentDiscriminator: discriminator,
    },
  };
}

function generateU64(): string {
  const buf = randomBytes(8);
  const high = buf.readUInt32BE(0);
  const low = buf.readUInt32BE(4);
  return (BigInt(high) * BigInt(0x100000000) + BigInt(low)).toString();
}

// ─── Step 3: Build agent subintent ───

async function buildAgentPayment(
  requirements: Record<string, unknown>,
  epoch: number,
): Promise<string> {
  log("3/6", "Building signed subintent via WASM...");

  // Dynamic import of workspace packages
  const { buildSponsoredManifest } = await import("../packages/client/src/manifest-builder.js");
  const { build_signed_partial_transaction } = await import("../packages/wasm/dist/x402_radix_wasm.js");

  const manifest = buildSponsoredManifest(requirements as any, AGENT_ACCOUNT);
  log("3/6", `Manifest:\n${manifest}\n`);

  const extra = requirements.extra as Record<string, unknown>;
  const maxProposerTimestamp = Math.floor(Date.now() / 1000) + (requirements.maxTimeoutSeconds as number);

  const input = JSON.stringify({
    manifest_string: manifest,
    network_id: 2,
    intent_discriminator: extra.intentDiscriminator as string,
    max_proposer_timestamp_secs: maxProposerTimestamp,
    start_epoch: epoch,
    end_epoch: epoch + 1000,
    signer_private_key_hex: AGENT_PRIVATE_KEY_HEX,
  });

  const resultJson = build_signed_partial_transaction(input);
  const result = JSON.parse(resultJson) as { success: boolean; data?: string; error?: string };

  if (!result.success || !result.data) {
    fail("3/6", `WASM build failed: ${result.error}`);
  }

  log("3/6", `SignedPartialTransactionV2: ${result.data.slice(0, 40)}...`);
  return result.data;
}

// ─── Step 4: Verify ───

async function verifyPayment(
  txHex: string,
  requirements: Record<string, unknown>,
): Promise<void> {
  log("4/6", "POST /verify to facilitator...");

  const payload = {
    x402Version: 2,
    resource: { url: "https://test.example", description: "E2E test", mimeType: "text/plain" },
    accepted: requirements,
    payload: { transaction: txHex },
  };

  const resp = await fetch(`${FACILITATOR_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, requirements }),
  });

  const data = await resp.json() as Record<string, unknown>;

  if ((data as any).valid === true) {
    log("4/6", "Verification passed");
  } else {
    fail("4/6", `Verification failed: ${(data as any).invalidReason ?? JSON.stringify(data)}`);
  }
}

// ─── Step 5: Settle ───

async function settlePayment(
  txHex: string,
  requirements: Record<string, unknown>,
): Promise<string> {
  log("5/6", "POST /settle to facilitator...");

  const payload = {
    x402Version: 2,
    resource: { url: "https://test.example", description: "E2E test", mimeType: "text/plain" },
    accepted: requirements,
    payload: { transaction: txHex },
  };

  const resp = await fetch(`${FACILITATOR_URL}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, requirements }),
  });

  const data = await resp.json() as Record<string, unknown>;

  if (!(data as any).success) {
    fail("5/6", `Settlement failed: ${(data as any).errorReason ?? JSON.stringify(data)}`);
  }

  const txId = (data as any).transaction as string;
  log("5/6", `Settlement submitted. Intent hash: ${txId}`);
  return txId;
}

// ─── Step 6: Confirm on-chain ───

async function confirmOnChain(txId: string): Promise<void> {
  log("6/6", "Polling Gateway for on-chain confirmation...");

  const maxWait = 60_000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    try {
      const data = await fetchJson(`${STOKENET_GATEWAY}/transaction/status`, {
        intent_hash: txId,
      });

      const status = data.intent_status ?? data.status;
      log("6/6", `Status: ${status}`);

      if (status === "CommittedSuccess") {
        log("6/6", "Transaction confirmed on-chain!");
        return;
      }
      if (status === "CommittedFailure" || status === "Rejected") {
        fail("6/6", `Transaction ${status}`, data);
      }
    } catch {
      // Gateway may return 404 for new txs — keep polling
    }

    await new Promise(r => setTimeout(r, 3000));
  }

  fail("6/6", "Timed out waiting for confirmation (60s)");
}

// ─── Main ───

async function main() {
  console.log("=== x402-radix E2E Stokenet Test ===\n");
  console.log(`Facilitator: ${FACILITATOR_URL}`);
  console.log(`Agent account: ${AGENT_ACCOUNT}`);
  console.log(`Payment: ${PAYMENT_AMOUNT} XRD\n`);

  // Step 1: Gateway status
  const { epoch } = await getGatewayStatus();

  // Step 1.5: Facilitator health check
  log("1/6", "Checking facilitator health...");
  let healthResp: Response;
  try {
    healthResp = await fetch(`${FACILITATOR_URL}/health`);
  } catch {
    fail("1/6", `Facilitator not reachable at ${FACILITATOR_URL}. Is it running? See DEPLOYMENT.md`);
  }
  if (!healthResp.ok) fail("1/6", "Facilitator returned non-200");
  const health = await healthResp.json() as Record<string, unknown>;
  const notaryBadge = health.notaryBadge as string;
  log("1/6", `Facilitator OK. Notary badge: ${notaryBadge}`);

  // Step 2: Generate requirements
  const requirements = generateRequirements(notaryBadge);

  // Step 3: Build agent payment
  const txHex = await buildAgentPayment(requirements, epoch);

  // Step 4: Verify
  await verifyPayment(txHex, requirements);

  // Step 5: Settle
  const txId = await settlePayment(txHex, requirements);

  // Step 6: On-chain confirmation
  await confirmOnChain(txId);

  console.log("\n=== E2E TEST PASSED ===");
  console.log(`Transaction: ${txId}`);
  console.log(`View on dashboard: https://stokenet-dashboard.radixdlt.com/transaction/${txId}`);
}

main().catch((err) => {
  console.error("\nUnexpected error:", err);
  process.exit(1);
});
