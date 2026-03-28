# MPP implementation notes

## Frozen policy (Phase 0)

| Surface | MPP (Stripe SPT / mppx) |
| --- | --- |
| `POST /mcp` | **MPP on paid JSON-RPC** (`tools/call`, etc.) when `STRIPE_SECRET_KEY` + `MPP_SECRET_KEY` are set; handshake methods (`initialize`, `tools/list`, …) are exempt |
| All other routes (catalog, ACP checkout, `GET /mcp` if used) | **Unchanged** — no MPP gate |

## Amount

- **$0.01 USD** per successful **paid** MCP JSON-RPC settlement (demo micro-charge, Stripe test mode), scoped to non-exempt methods (see `backend/src/mpp/mcp-methods.ts`).

## Test-only

- Stripe **test** secret keys only (`sk_test_...`). Live keys are rejected at runtime.
- **Production** deploy uses the same policy: MPP is a demo of machine payments with **Stripe test mode only**, not live card charges.

## Challenge binding

- mppx uses `MPP_SECRET_KEY` for HMAC-bound challenge IDs per [mpp.dev protocol](https://mpp.dev/protocol/challenges).
