// x402 V2 Core Types for Radix
// Canonical spec: https://gist.github.com/xstelea/c2eeba1704928f51f10d8d25ae95870f

export type RadixNetwork = "radix:mainnet" | "radix:stokenet";
export type RadixMode = "sponsored" | "nonSponsored";

export interface RadixPaymentRequirements {
  scheme: "exact";
  network: RadixNetwork;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: RadixPaymentExtra;
}

export interface RadixPaymentExtra {
  mode: RadixMode;
  /** Facilitator's notary badge (NonFungibleGlobalId). Sponsored mode only. */
  notaryBadge?: string;
  /** String-encoded u64. Client MUST use as IntentHeaderV2.intent_discriminator. */
  intentDiscriminator: string;
}

export interface RadixPaymentPayload {
  x402Version: 2;
  resource: { url: string; description: string; mimeType: string };
  accepted: RadixPaymentRequirements;
  payload: {
    /** Hex-encoded SBOR. Sponsored: SignedPartialTransactionV2. NonSponsored: NotarizedTransactionV2. */
    transaction: string;
  };
}

export interface RadixSettlementResponse {
  success: boolean;
  transaction?: string;
  network: RadixNetwork;
  payer?: string;
  errorReason?: string;
}

export type RadixVerificationResult =
  | { valid: true }
  | { valid: false; invalidReason: RadixErrorCode };

export type RadixErrorCode =
  | "invalid_exact_radix_deserialization"
  | "invalid_exact_radix_instruction_count"
  | "invalid_exact_radix_instruction_sequence"
  | "invalid_exact_radix_asset_mismatch"
  | "invalid_exact_radix_amount_mismatch"
  | "invalid_exact_radix_destination_mismatch"
  | "invalid_exact_radix_facilitator_safety"
  | "invalid_exact_radix_expired"
  | "invalid_exact_radix_signature"
  | "invalid_exact_radix_preview_failed"
  | "invalid_exact_radix_replay";

export interface FacilitatorConfig {
  networkId: 1 | 2;
  network: RadixNetwork;
  gatewayBaseUrl: string;
  notaryPrivateKeyHex: string;
  notaryBadge: string;
  feePayerAccount: string;
  maxGasPerRequestXrd: string;
  maxGasPerWindowXrd: string;
  windowDurationSeconds: number;
}

export interface GasBudgetState {
  windowStart: number;
  totalGasInWindow: number;
}
