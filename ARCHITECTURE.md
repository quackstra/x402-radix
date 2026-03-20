# x402-radix — Architecture

**Canonical Spec:** [`scheme_exact_radix.md` by xstelea](https://gist.github.com/xstelea/c2eeba1704928f51f10d8d25ae95870f)

## System Overview

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   AI Agent      │  HTTP   │  Resource Server  │  HTTP   │   Facilitator   │
│  (@x402/radix   │◄───────►│  (@x402/radix    │◄───────►│  (standalone    │
│   client)       │         │   server)         │         │   HTTP service) │
└────────┬────────┘         └──────────────────┘         └────────┬────────┘
         │                                                        │
         │  Signs subintent                    Wraps in root tx,  │
         │  with Ed25519 key                   notarizes, submits │
         │                                                        │
         └──────────────────────┐    ┌────────────────────────────┘
                                │    │
                         ┌──────▼────▼──────┐
                         │  Radix Gateway   │
                         │  API             │
                         │  (stokenet /     │
                         │   mainnet)       │
                         └──────────────────┘
```

## Payment Flow (Sponsored Mode)

1. Agent requests a resource (`GET /api/resource`)
2. Server returns `402 Payment Required` with `PaymentRequirements` (includes `notaryBadge` and `intentDiscriminator`)
3. Agent constructs a 5-instruction subintent using the facilitator's notary badge for `VERIFY_PARENT`
4. Agent signs the subintent, producing a `SignedPartialTransactionV2`
5. Agent retries with the hex-encoded payload in the `PAYMENT` header
6. Server forwards to facilitator's `/verify` endpoint
7. Facilitator wraps the subintent in a root transaction, sets `notary_is_signatory: true`
8. Facilitator previews, submits, and confirms on-chain
9. Server returns the resource

## Package Dependency Graph

```
@x402/radix-core          ← No external x402 deps. Shared types + constants.
    ↑
    ├── @x402/radix-client     ← Depends on core. Used by AI agents.
    ├── @x402/radix-server     ← Depends on core. Used by resource servers.
    └── @x402/radix-facilitator ← Depends on core + server. Standalone service.
```

## Security Model

The canonical spec uses a **facilitator-badge trust model**: the agent's `VERIFY_PARENT` gates on the facilitator's notary badge, not the agent's own key. The facilitator's `notary_is_signatory: true` produces the virtual Ed25519 badge that satisfies this access rule.

See [specs/scheme_exact_radix.md](./specs/scheme_exact_radix.md) for the full specification.
