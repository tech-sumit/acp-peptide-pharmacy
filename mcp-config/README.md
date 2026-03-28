# MCP Configuration

Use these snippets to connect the deployed Worker MCP endpoint to local AI
clients.

## Endpoints

- Local development: `http://127.0.0.1:8787/mcp`
- Deployed Worker: `https://acp-peptide-pharmacy-backend.tech-sumit.workers.dev/mcp`

## Supported tools

- `list_products`
- `search_products`
- `get_product_details`
- `create_checkout`
- `update_checkout`
- `get_checkout_status`
- `complete_checkout`
- `cancel_checkout`

## Machine Payments Protocol (MPP)

When the Worker has `STRIPE_SECRET_KEY` (`sk_test_...`) and `MPP_SECRET_KEY` set, **every `POST /mcp` must include a valid MPP payment credential** after you complete the 402 challenge flow. Standard MCP clients do not attach `Authorization: Payment` automatically.

**Practical options:**

- **Disable MPP for local AI use**: unset those secrets in dev; MCP works unchanged.
- **Test MPP**: run the Worker locally (`npm run dev` in `backend/`) and use an MPP-capable HTTP client (see [Stripe MPP](https://docs.stripe.com/payments/machine/mpp) and [`mppx` CLI](https://www.npmjs.com/package/mppx)) against `http://127.0.0.1:8787/mcp`.
- **Production demo**: the public Worker may ship with or without secrets; if enabled, remote MCP clients must implement the Payment header retry flow.

See the repo [README](../README.md#machine-payments-protocol-mpp-on-post-mcp) and [IMPLEMENTATION_NOTES.md](../IMPLEMENTATION_NOTES.md).

## Notes

- The MCP server uses Streamable HTTP on Cloudflare Workers.
- Claude Desktop and Cursor can connect through `mcp-remote`.
- Orders are demo-only and always marked research-use-only.
