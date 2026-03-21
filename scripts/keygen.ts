#!/usr/bin/env -S npx tsx
/**
 * Generate a Stokenet keypair and derive all values needed for deployment.
 *
 * Outputs:
 *   - Ed25519 private key (hex)
 *   - Public key (hex)
 *   - Account address (bech32m)
 *   - Notary badge (NonFungibleGlobalId)
 *   - Ready-to-paste .env block
 *
 * Usage:
 *   npx tsx scripts/keygen.ts
 *   npx tsx scripts/keygen.ts --mainnet     # for mainnet (default: stokenet)
 *   npx tsx scripts/keygen.ts --key <hex>   # derive from existing private key
 */

import { randomBytes } from "node:crypto";
import { derive_account_info } from "../packages/wasm/dist/x402_radix_wasm.js";

interface WasmResult {
  success: boolean;
  data?: string;
  error?: string;
}

interface DeriveOutput {
  account_address: string;
  public_key_hex: string;
  notary_badge: string;
}

// Parse args
const args = process.argv.slice(2);
const isMainnet = args.includes("--mainnet");
const networkId = isMainnet ? 1 : 2;
const networkName = isMainnet ? "mainnet" : "stokenet";

let privateKeyHex: string;
const keyIndex = args.indexOf("--key");
if (keyIndex !== -1 && args[keyIndex + 1]) {
  privateKeyHex = args[keyIndex + 1];
  if (privateKeyHex.length !== 64) {
    console.error("Error: Private key must be 64 hex characters (32 bytes)");
    process.exit(1);
  }
} else {
  privateKeyHex = randomBytes(32).toString("hex");
}

// Derive via WASM
const resultJson = derive_account_info(
  JSON.stringify({ private_key_hex: privateKeyHex, network_id: networkId }),
);
const result: WasmResult = JSON.parse(resultJson);

if (!result.success || !result.data) {
  console.error(`Derivation failed: ${result.error}`);
  process.exit(1);
}

const info: DeriveOutput = JSON.parse(result.data);

console.log(`=== x402-radix Keygen (${networkName}) ===\n`);
console.log(`Private Key:     ${privateKeyHex}`);
console.log(`Public Key:      ${info.public_key_hex}`);
console.log(`Account Address: ${info.account_address}`);
console.log(`Notary Badge:    ${info.notary_badge}`);

if (!isMainnet) {
  console.log(`\nFund this account: https://stokenet-faucet.radixdlt.com/`);
  console.log(`View on dashboard: https://stokenet-dashboard.radixdlt.com/account/${info.account_address}`);
}

console.log(`\n--- .env (copy-paste into your .env file) ---\n`);
console.log(`RADIX_NETWORK_ID=${networkId}`);
console.log(`FACILITATOR_PRIVATE_KEY_HEX=${privateKeyHex}`);
console.log(`FACILITATOR_ACCOUNT=${info.account_address}`);
console.log(`FACILITATOR_NOTARY_BADGE=${info.notary_badge}`);
console.log(`PORT=4020`);
console.log(`MAX_GAS_PER_REQUEST_XRD=5`);
console.log(`MAX_GAS_PER_WINDOW_XRD=100`);
console.log(`GAS_WINDOW_SECONDS=3600`);
