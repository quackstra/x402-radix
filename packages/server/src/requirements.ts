import { RadixPaymentRequirements, RadixPaymentExtra, FacilitatorConfig } from "@x402/radix-core";
import { XRD_MAINNET, XRD_STOKENET } from "@x402/radix-core";

export interface RequirementsOptions {
  amount: string;
  payTo: string;
  mode?: "sponsored" | "nonSponsored";
  maxTimeoutSeconds?: number;
}

export function generatePaymentRequirements(
  opts: RequirementsOptions,
  config: FacilitatorConfig,
): RadixPaymentRequirements {
  const mode = opts.mode ?? "sponsored";

  const discriminator = generateU64Discriminator();

  const extra: RadixPaymentExtra = {
    mode,
    intentDiscriminator: discriminator,
    ...(mode === "sponsored" ? { notaryBadge: config.notaryBadge } : {}),
  };

  return {
    scheme: "exact",
    network: config.network,
    asset: config.networkId === 1 ? XRD_MAINNET : XRD_STOKENET,
    amount: opts.amount,
    payTo: opts.payTo,
    maxTimeoutSeconds: opts.maxTimeoutSeconds ?? 60,
    extra,
  };
}

function generateU64Discriminator(): string {
  const high = Math.floor(Math.random() * 0xFFFFFFFF);
  const low = Math.floor(Math.random() * 0xFFFFFFFF);
  return (BigInt(high) * BigInt(0x100000000) + BigInt(low)).toString();
}
