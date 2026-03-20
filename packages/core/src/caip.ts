import { RadixNetwork } from "./types.js";

export const RADIX_CAIP2_NAMESPACE = "radix";

export function parseRadixNetwork(network: string): { networkId: number; name: string } | null {
  if (network === "radix:mainnet") return { networkId: 1, name: "mainnet" };
  if (network === "radix:stokenet") return { networkId: 2, name: "stokenet" };
  return null;
}

export function radixAssetId(network: RadixNetwork, resourceAddress: string): string {
  return `${network}/resource:${resourceAddress}`;
}
