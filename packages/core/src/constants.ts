import { RadixNetwork } from "./types.js";

// XRD Native Token
export const XRD_MAINNET = "resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd";
export const XRD_STOKENET = "resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc";

// Ed25519 Virtual Badge
export const ED25519_BADGE_MAINNET = "resource_rdx1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxx3e2cpa";
export const ED25519_BADGE_STOKENET = "resource_tdx_2_1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxxed8fma";

// Gateway URLs
export const GATEWAY_MAINNET = "https://mainnet.radixdlt.com";
export const GATEWAY_STOKENET = "https://stokenet.radixdlt.com";

// Instruction Counts
export const SPONSORED_INSTRUCTION_COUNT = 5;
export const NON_SPONSORED_INSTRUCTION_COUNT = 4;

// Temporal Constants (per canonical spec section 6)
export const CONSTRUCTION_TOLERANCE_SECONDS = 60;
export const REPLAY_RETENTION_BUFFER_SECONDS = 300;
export const DEFAULT_EPOCH_SAFETY_WINDOW = 1000;

// Default Facilitator Settings
export const DEFAULT_MAX_GAS_PER_REQUEST_XRD = "5";
export const DEFAULT_MAX_GAS_PER_WINDOW_XRD = "100";
export const DEFAULT_WINDOW_DURATION_SECONDS = 3600;

// Network Config
export interface NetworkConfig {
  networkId: 1 | 2;
  network: RadixNetwork;
  xrdAddress: string;
  ed25519Badge: string;
  gatewayBaseUrl: string;
}

export function getNetworkConfig(networkId: 1 | 2): NetworkConfig {
  return {
    networkId,
    network: networkId === 1 ? "radix:mainnet" : "radix:stokenet",
    xrdAddress: networkId === 1 ? XRD_MAINNET : XRD_STOKENET,
    ed25519Badge: networkId === 1 ? ED25519_BADGE_MAINNET : ED25519_BADGE_STOKENET,
    gatewayBaseUrl: networkId === 1 ? GATEWAY_MAINNET : GATEWAY_STOKENET,
  };
}

export function networkIdFromCaip2(network: RadixNetwork): 1 | 2 {
  if (network === "radix:mainnet") return 1;
  if (network === "radix:stokenet") return 2;
  throw new Error(`Unknown Radix network: ${network}`);
}
