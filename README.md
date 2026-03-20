# x402-radix

> x402 payment protocol for Radix DLT — enabling AI agents to pay with XRD

Based on the [`scheme_exact_radix`](https://gist.github.com/xstelea/c2eeba1704928f51f10d8d25ae95870f) specification by Stefan Telea (Radix core developer).

## What is this?

This implements [x402](https://x402.org) for Radix, making Radix a first-class citizen in the AI agent payment economy.

| Package | Description |
|---------|-------------|
| `@x402/radix-core` | Shared types, constants, CAIP-2 config |
| `@x402/radix-client` | Agent-side: construct and sign XRD payments |
| `@x402/radix-server` | Server-side: verify payments, generate requirements |
| `@x402/radix-facilitator` | Standalone service: settle payments on-chain |

## How it works

1. Agent requests a resource from an x402-gated server
2. Server returns HTTP 402 with Radix payment requirements (including facilitator's `notaryBadge`)
3. Agent builds a subintent that uses the notary badge for VERIFY_PARENT, signs it
4. Agent retries with the `SignedPartialTransactionV2` payload
5. Facilitator wraps it in a root transaction, sets `notary_is_signatory: true`, notarizes, previews, submits
6. Agent gets the resource

## Quick Start

```bash
git clone https://github.com/quackstra/x402-radix.git
cd x402-radix
pnpm install && pnpm build
cp .env.example .env  # Edit with your Stokenet keys
pnpm dev:facilitator
```

## Status

**Work in progress** — community contributions welcome!

Key areas needing work:
- [ ] V2 subintent/transaction SBOR encoding (TS toolkit limitation)
- [ ] Full signature verification
- [ ] End-to-end Stokenet integration test
- [ ] Upstream spec PR to coinbase/x402

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design.

See [specs/scheme_exact_radix.md](./specs/scheme_exact_radix.md) for the canonical specification by Stefan Telea.

## Contributing

Community project from the Radix ecosystem, coordinated via [Radical Vibes](https://t.me/RadicalVibing).

## License

MIT
