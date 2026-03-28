# MPP implementation notes

## Frozen policy (Phase 0)

| Surface | MPP (Stripe SPT / mppx) |
| --- | --- |
| `POST /mcp` | **Paid** when `STRIPE_SECRET_KEY` + `MPP_SECRET_KEY` are set |
| All other routes (catalog, ACP checkout, `GET /mcp` if used) | **Unchanged** — no MPP gate |

## Amount

- **$0.01 USD** per successful MCP settlement (demo micro-charge, Stripe test mode).

## Test-only

- Stripe **test** secret keys only (`sk_test_...`). Live keys are rejected at runtime.

## Challenge binding

- mppx uses `MPP_SECRET_KEY` for HMAC-bound challenge IDs per [mpp.dev protocol](https://mpp.dev/protocol/challenges).
