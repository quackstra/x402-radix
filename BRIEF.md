# x402-radix — Project Brief

**Canonical Spec:** [`scheme_exact_radix.md` by Stefan Telea (xstelea)](https://gist.github.com/xstelea/c2eeba1704928f51f10d8d25ae95870f)

## What This Is

An implementation of the x402 payment protocol for the Radix network. This enables AI agents to autonomously pay for HTTP services using XRD (Radix's native token).

## Deliverables

1. **`@x402/radix` TypeScript packages** — Client, server, and shared implementations
2. **A standalone Radix facilitator service** — Verifies and settles payments on-chain
3. **Upstream contribution** — Spec + SDK contributed to the Coinbase x402 repo

## Why This Matters

x402 is the emerging standard for AI agent payments. Active facilitators exist for Base, Solana, Stellar, Algorand, Optimism, and Aptos. Radix has zero x402 presence. This project makes Radix a first-class citizen in the agent payment economy.

## Technical Constraints

- **Language:** TypeScript (Node.js 22+)
- **Package manager:** pnpm with workspace
- **Target:** Stokenet first, mainnet second
- **x402 version:** V2 only
- **CAIP-2:** `radix:mainnet` and `radix:stokenet`
- **Both modes use V2 transactions** (no V1 fallback)

## Success Criteria

1. An AI agent can call a Stokenet x402-gated HTTP endpoint
2. Get a 402 response with Radix payment requirements
3. Construct and sign a Radix subintent
4. Retry with the `SignedPartialTransactionV2` payload
5. Facilitator wraps, notarizes, submits, and confirms on-chain
6. Agent receives the resource
