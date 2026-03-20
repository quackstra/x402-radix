import { FacilitatorConfig, RadixPaymentRequirements, RadixSettlementResponse } from "@x402/radix-core";
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
  const _rootManifest = buildRootManifest(
    config.feePayerAccount,
    requirements.payTo,
    config.maxGasPerRequestXrd,
  );

  // TODO: Requires V2 transaction builder (see SPEC-toolkit-strategy.md)
  //
  // The composed transaction structure:
  //   NotarizedTransactionV2:
  //     SignedTransactionIntentV2:
  //       TransactionIntentV2:
  //         root_intent_core:
  //           header: TransactionHeaderV2
  //             - notary_public_key: facilitator's Ed25519 pubkey
  //             - notary_is_signatory: true  <-- CRITICAL
  //           manifest: rootManifest (compiled)
  //         non_root_subintents: [agent's subintent from SignedPartialTransactionV2]
  //       root_intent_signatures: [] (notary_is_signatory covers this)
  //       non_root_subintent_signatures: [agent's signatures]
  //     notary_signature: facilitator signs the TransactionIntentHash

  // Preview
  const preview = await previewTransaction(config.gatewayBaseUrl, "TODO_composed_tx_hex");
  if (!preview.success) {
    return { success: false, network: config.network, errorReason: `Preview: ${preview.error}` };
  }

  // Gas budget check
  const estimatedGas = parseFloat(preview.feeCost ?? config.maxGasPerRequestXrd);
  if (!gasBudget.canSpend(estimatedGas)) {
    return { success: false, network: config.network, errorReason: "Gas budget exceeded" };
  }

  // Submit
  const txId = await submitTransaction(config.gatewayBaseUrl, "TODO_composed_tx_hex");
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
