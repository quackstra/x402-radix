import { FacilitatorConfig, RadixPaymentRequirements, RadixSettlementResponse } from "@x402/radix-core";
import { wrap_subintent_in_root_transaction } from "@x402/radix-wasm";
import { GasBudgetTracker } from "./gas-budget.js";

/**
 * Settle a sponsored payment on-chain (canonical spec - Settlement).
 */
export async function settleSponsored(
  _agentTxHex: string,
  requirements: RadixPaymentRequirements,
  config: FacilitatorConfig,
  gasBudget: GasBudgetTracker,
): Promise<RadixSettlementResponse> {
  const rootManifest = buildRootManifest(
    config.feePayerAccount,
    requirements.payTo,
    config.maxGasPerRequestXrd,
  );

  // Get current epoch from Gateway for transaction validity window
  const currentEpoch = await getCurrentEpoch(config.gatewayBaseUrl);
  const startEpoch = currentEpoch;
  const endEpoch = currentEpoch + 100; // ~50 min validity window

  // Compose the NotarizedTransactionV2 via WASM
  const wrapResult = JSON.parse(
    wrap_subintent_in_root_transaction(
      JSON.stringify({
        signed_partial_tx_hex: _agentTxHex,
        root_manifest_string: rootManifest,
        network_id: config.networkId,
        notary_private_key_hex: config.notaryPrivateKeyHex,
        start_epoch: startEpoch,
        end_epoch: endEpoch,
      }),
    ),
  ) as { success: boolean; data?: string; error?: string };

  if (!wrapResult.success || !wrapResult.data) {
    return { success: false, network: config.network, errorReason: `Compose: ${wrapResult.error ?? "unknown"}` };
  }

  const composedTxHex = wrapResult.data;

  // Preview
  const preview = await previewTransaction(config.gatewayBaseUrl, composedTxHex);
  if (!preview.success) {
    return { success: false, network: config.network, errorReason: `Preview: ${preview.error}` };
  }

  // Gas budget check
  const estimatedGas = parseFloat(preview.feeCost ?? config.maxGasPerRequestXrd);
  if (!gasBudget.canSpend(estimatedGas)) {
    return { success: false, network: config.network, errorReason: "Gas budget exceeded" };
  }

  // Submit
  const txId = await submitTransaction(config.gatewayBaseUrl, composedTxHex);
  if (!txId) {
    return { success: false, network: config.network, errorReason: "Submission failed" };
  }

  // Confirm
  const confirmed = await pollForConfirmation(config.gatewayBaseUrl, txId, 30_000);
  if (!confirmed) {
    return { success: false, network: config.network, transaction: txId, errorReason: "Not confirmed" };
  }

  gasBudget.record(estimatedGas);
  return { success: true, transaction: txId, network: config.network };
}

/**
 * Settle a non-sponsored payment (submit client's NotarizedTransactionV2).
 */
export async function settleNonSponsored(
  clientTxHex: string,
  requirements: RadixPaymentRequirements,
  config: FacilitatorConfig,
): Promise<RadixSettlementResponse> {
  const preview = await previewTransaction(config.gatewayBaseUrl, clientTxHex);
  if (!preview.success) {
    return { success: false, network: config.network, errorReason: `Preview: ${preview.error}` };
  }

  const txId = await submitTransaction(config.gatewayBaseUrl, clientTxHex);
  if (!txId) {
    return { success: false, network: config.network, errorReason: "Submission failed" };
  }

  const confirmed = await pollForConfirmation(config.gatewayBaseUrl, txId, 30_000);
  if (!confirmed) {
    return { success: false, network: config.network, transaction: txId, errorReason: "Not confirmed" };
  }

  return { success: true, transaction: txId, network: config.network };
}

function buildRootManifest(feePayerAccount: string, payToAccount: string, maxGasXrd: string): string {
  return `
CALL_METHOD
    Address("${feePayerAccount}")
    "lock_fee"
    Decimal("${maxGasXrd}")
;
YIELD_TO_CHILD
    SubintentIndex(0u64)
;
CALL_METHOD
    Address("${payToAccount}")
    "try_deposit_or_abort"
    Expression("ENTIRE_WORKTOP")
    None
;`.trim();
}

async function getCurrentEpoch(gatewayUrl: string): Promise<number> {
  try {
    const resp = await fetch(`${gatewayUrl}/status/gateway-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (resp.ok) {
      const data = await resp.json() as Record<string, unknown>;
      const ledgerState = data.ledger_state as Record<string, unknown> | undefined;
      if (ledgerState?.epoch) return Number(ledgerState.epoch);
    }
  } catch { /* fall through to default */ }
  throw new Error("Failed to fetch current epoch from Gateway");
}

async function previewTransaction(gatewayUrl: string, _txHex: string): Promise<{
  success: boolean; error?: string; feeCost?: string;
}> {
  // TODO: POST to /transaction/preview-v2
  void gatewayUrl;
  return { success: true, feeCost: "1.5" };
}

async function submitTransaction(gatewayUrl: string, txHex: string): Promise<string | null> {
  try {
    const resp = await fetch(`${gatewayUrl}/transaction/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notarized_transaction_hex: txHex }),
    });
    if (!resp.ok) return null;
    return `txid_placeholder_${Date.now()}`;
  } catch { return null; }
}

async function pollForConfirmation(gatewayUrl: string, txId: string, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await fetch(`${gatewayUrl}/transaction/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent_hash: txId }),
      });
      if (resp.ok) {
        const data = await resp.json() as Record<string, unknown>;
        if (data.status === "CommittedSuccess") return true;
        if (data.status === "CommittedFailure" || data.status === "Rejected") return false;
      }
    } catch { /* retry */ }
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}
