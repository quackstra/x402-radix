# Stokenet Deployment Guide

Deploy the x402-radix facilitator on Stokenet for testing AI agent payments with XRD.

## Prerequisites

- Node.js >= 22
- pnpm >= 9
- A Radix Stokenet account with XRD (use the [Stokenet Faucet](https://stokenet-faucet.radixdlt.com/))

## 1. Clone and Build

```bash
git clone https://github.com/quackstra/x402-radix.git
cd x402-radix
pnpm install
pnpm build
```

The WASM bindings are pre-built and checked into `packages/wasm/dist/`. No Rust toolchain needed unless you modify the WASM crate.

## 2. Generate a Stokenet Account

If you don't already have a Stokenet Ed25519 keypair, generate one:

```bash
node -e "
const crypto = require('crypto');
const seed = crypto.randomBytes(32);
console.log('PRIVATE KEY HEX:', seed.toString('hex'));
console.log('');
console.log('Import this key into the Radix Wallet or use the Dashboard');
console.log('to find your account address and notary badge.');
"
```

Then:
1. Import the private key into the [Radix Dashboard](https://stokenet-dashboard.radixdlt.com/) or Radix Wallet
2. Note your account address (starts with `account_tdx_2_`)
3. Fund it via the [Stokenet Faucet](https://stokenet-faucet.radixdlt.com/)

## 3. Determine Your Notary Badge

The notary badge is a `NonFungibleGlobalId` derived from your Ed25519 public key. It follows this format:

```
resource_tdx_2_1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxxed8fma:[<blake2b256_of_public_key_bytes>]
```

You can find it by:
- Checking your account's owned resources on the [Stokenet Dashboard](https://stokenet-dashboard.radixdlt.com/)
- Or deriving it programmatically from your public key

## 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Network: 2 = Stokenet, 1 = Mainnet
RADIX_NETWORK_ID=2

# Your Ed25519 private key (64 hex chars)
FACILITATOR_PRIVATE_KEY_HEX=your_64_char_hex_private_key

# Your funded Stokenet account address
FACILITATOR_ACCOUNT=account_tdx_2_1...your_account...

# Your notary badge NonFungibleGlobalId (see step 3)
FACILITATOR_NOTARY_BADGE=resource_tdx_2_1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxxed8fma:[your_hash]

# Server port (default: 4020)
PORT=4020

# Gas budget limits
MAX_GAS_PER_REQUEST_XRD=5
MAX_GAS_PER_WINDOW_XRD=100
GAS_WINDOW_SECONDS=3600
```

## 5. Start the Facilitator

```bash
# Load env vars and run
source .env && node packages/facilitator/dist/index.js
```

Or with pnpm:
```bash
pnpm dev:facilitator
```

You should see:
```
[x402-radix facilitator] listening on :4020
[x402-radix facilitator] network: radix:stokenet
[x402-radix facilitator] notaryBadge: resource_tdx_2_1nf...
```

## 6. Verify It's Running

```bash
curl http://localhost:4020/health
```

Expected response:
```json
{
  "status": "ok",
  "network": "radix:stokenet",
  "notaryBadge": "resource_tdx_2_1nf..."
}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check — returns network and notary badge |
| `/verify` | POST | Verify a payment payload against requirements |
| `/settle` | POST | Submit a payment transaction to the Radix network |

### POST /verify

```json
{
  "payload": { "payload": { "transaction": "hex..." } },
  "requirements": { "...RadixPaymentRequirements..." }
}
```

### POST /settle

```json
{
  "payload": { "payload": { "transaction": "hex..." } },
  "requirements": { "...RadixPaymentRequirements..." }
}
```

## How Settlement Works

### Sponsored Mode (facilitator pays gas)

1. Agent builds a `SubintentV2` with `VERIFY_PARENT` using the facilitator's notary badge
2. Agent signs it → `SignedPartialTransactionV2` (hex)
3. Facilitator receives the hex via `/settle`
4. Facilitator wraps it in a root `NotarizedTransactionV2` with `notary_is_signatory: true`
5. Facilitator previews the transaction against the Gateway
6. If preview succeeds and gas budget allows, submits to the network
7. Polls `/transaction/status` until confirmed or timeout (30s)

### Non-Sponsored Mode (agent pays gas)

1. Agent builds a full `NotarizedTransactionV2` including `lock_fee`
2. Facilitator receives the hex via `/settle`
3. Facilitator previews, submits, and polls for confirmation

## Troubleshooting

**"Missing required env var: FACILITATOR_PRIVATE_KEY_HEX"**
→ Your `.env` file isn't loaded. Use `source .env` before running, or set the vars in your shell.

**"Failed to fetch current epoch from Gateway"**
→ The Stokenet Gateway (`https://stokenet.radixdlt.com`) is unreachable. Check your network or set `RADIX_GATEWAY_URL` to a custom endpoint.

**"Preview: ..." errors during settlement**
→ The transaction preview failed. Common causes: insufficient XRD in the fee payer account, invalid manifest, or epoch window expired.

**"Gas budget exceeded"**
→ The facilitator has hit its gas spending limit for the current window. Wait for the window to reset or increase `MAX_GAS_PER_WINDOW_XRD`.

## Architecture

```
Agent (client)                    Server (resource owner)           Facilitator
─────────────                    ──────────────────────           ───────────
GET /resource ──────────────────→ 402 + PaymentRequirements
                                   (includes notaryBadge)
Build SubintentV2
  VERIFY_PARENT(notaryBadge)
  withdraw XRD
  YIELD_TO_PARENT
Sign → SignedPartialTransactionV2

GET /resource + payment ────────→ POST /verify ─────────────────→ verifyRadixPayment()
                                   ← valid
                                  POST /settle ─────────────────→ wrap in root tx
                                                                   preview → submit
                                   ← txId                          → Gateway
                                  Return resource
```

## Next Steps

- **Full signature verification**: Currently the facilitator trusts well-formed payloads. Ed25519 signature verification against the subintent hash is not yet implemented.
- **Notary badge auto-derivation**: Currently requires manual `FACILITATOR_NOTARY_BADGE` env var. Could be derived from the private key using blake2b256.
- **E2E test script**: A script that generates a test keypair, builds a subintent, and settles it against a running facilitator.
- **Upstream PR**: Submit the `scheme_exact_radix` spec to [coinbase/x402](https://github.com/coinbase/x402).
