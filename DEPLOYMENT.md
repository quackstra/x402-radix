# Stokenet Deployment Guide

Deploy the x402-radix facilitator on Stokenet for testing AI agent payments with XRD.

## Prerequisites

- Node.js >= 22
- pnpm >= 9

## 1. Clone and Build

```bash
git clone https://github.com/quackstra/x402-radix.git
cd x402-radix
pnpm install
pnpm build
```

The WASM bindings are pre-built and checked into `packages/wasm/dist/`. No Rust toolchain needed unless you modify the WASM crate.

## 2. Generate a Stokenet Account

Run the keygen script to generate a keypair and derive all required values:

```bash
pnpm keygen
```

This generates a random Ed25519 keypair and outputs everything you need:

```
=== x402-radix Keygen (stokenet) ===

Private Key:     ced10fb19b45bedd07887c0e94104c9e...
Public Key:      0cfe079fc6c76d9083730bdabc147092...
Account Address: account_tdx_2_12xvrxl3m3qhm7r...
Notary Badge:    resource_tdx_2_1nfxxxxxxxxxx...:[98337e3b...]

Fund this account: https://stokenet-faucet.radixdlt.com/
View on dashboard: https://stokenet-dashboard.radixdlt.com/account/account_tdx_2_...

--- .env (copy-paste into your .env file) ---

RADIX_NETWORK_ID=2
FACILITATOR_PRIVATE_KEY_HEX=ced10fb1...
FACILITATOR_ACCOUNT=account_tdx_2_12xvrxl3m3qhm7r...
FACILITATOR_NOTARY_BADGE=resource_tdx_2_1nfxxxxxxxxxx...:[98337e3b...]
PORT=4020
MAX_GAS_PER_REQUEST_XRD=5
MAX_GAS_PER_WINDOW_XRD=100
GAS_WINDOW_SECONDS=3600
```

To derive values from an existing private key:
```bash
pnpm keygen -- --key <your_64_char_hex_private_key>
```

## 3. Fund and Configure

1. Copy the `.env` block from the keygen output into a `.env` file:
   ```bash
   pnpm keygen > /dev/null  # or just copy from the output above
   ```

2. Fund the account with XRD via the [Stokenet Faucet](https://stokenet-faucet.radixdlt.com/)
   - Paste your account address (starts with `account_tdx_2_`)
   - Request test XRD (you'll need at least 10 XRD for gas)

3. Verify the account is funded on the [Stokenet Dashboard](https://stokenet-dashboard.radixdlt.com/)

## 4. Start the Facilitator

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

## 5. Verify It's Running

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

## E2E Test

With the facilitator running, run the full end-to-end test:

```bash
AGENT_PRIVATE_KEY_HEX=<any_funded_stokenet_key> \
AGENT_ACCOUNT=<matching_account_address> \
pnpm test:e2e
```

This exercises the complete flow: Gateway status → subintent build → verify → settle → on-chain confirmation. The test pays the agent to itself so no XRD is lost.

## Next Steps

- **Full signature verification**: Currently the facilitator trusts well-formed payloads. Ed25519 signature verification against the subintent hash is not yet implemented.
- **Upstream PR**: Submit the `scheme_exact_radix` spec to [coinbase/x402](https://github.com/coinbase/x402).
