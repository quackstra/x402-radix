import { FacilitatorConfig } from "@x402/radix-core";
import { getNetworkConfig } from "@x402/radix-core";

export function loadConfig(): FacilitatorConfig {
  const networkId = parseInt(process.env.RADIX_NETWORK_ID ?? "2") as 1 | 2;
  const networkConfig = getNetworkConfig(networkId);

  const notaryPrivateKeyHex = requireEnv("FACILITATOR_PRIVATE_KEY_HEX");
  // TODO: Derive notaryBadge from private key using Radix Engine Toolkit:
  //   const pk = new PrivateKey.Ed25519(notaryPrivateKeyHex);
  //   const pubKeyHash = blake2b256(pk.publicKeyBytes());
  //   const badge = `${networkConfig.ed25519Badge}:[${pubKeyHash}]`;
  const notaryBadge = requireEnv("FACILITATOR_NOTARY_BADGE");

  return {
    networkId,
    network: networkConfig.network,
    gatewayBaseUrl: process.env.RADIX_GATEWAY_URL ?? networkConfig.gatewayBaseUrl,
    notaryPrivateKeyHex,
    notaryBadge,
    feePayerAccount: requireEnv("FACILITATOR_ACCOUNT"),
    maxGasPerRequestXrd: process.env.MAX_GAS_PER_REQUEST_XRD ?? "5",
    maxGasPerWindowXrd: process.env.MAX_GAS_PER_WINDOW_XRD ?? "100",
    windowDurationSeconds: parseInt(process.env.GAS_WINDOW_SECONDS ?? "3600"),
  };
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}
