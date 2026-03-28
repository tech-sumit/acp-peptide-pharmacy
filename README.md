# ACP Peptide Pharmacy

A full-stack demo storefront that combines the **Agentic Commerce Protocol (ACP)**,
**Model Context Protocol (MCP)**, and optional **Machine Payments Protocol (MPP)**
with **Stripe test mode** so Claude, Cursor, and other AI clients can browse products
and place demo peptide orders.

## Architecture

- `backend/`: Cloudflare Worker with ACP checkout, remote MCP (`/mcp`), optional MPP gate
- `frontend/`: static storefront (GitHub Pages) + `mpp-demo.html` overview
- `mcp-config/`: MCP client configuration examples
- `IMPLEMENTATION_NOTES.md`: frozen MPP route policy for this repo

Live references:

- Storefront: [tech-sumit.github.io/acp-peptide-pharmacy](https://tech-sumit.github.io/acp-peptide-pharmacy/)
- Worker API: [acp-peptide-pharmacy-backend.tech-sumit.workers.dev](https://acp-peptide-pharmacy-backend.tech-sumit.workers.dev/)

## Machine Payments Protocol (MPP) on `POST /mcp`

This Worker integrates [MPP](https://mpp.dev/) using Stripe **shared payment tokens (SPTs)** via the official [`mppx`](https://www.npmjs.com/package/mppx) server middleware, following [Stripe’s MPP guide](https://docs.stripe.com/payments/machine/mpp).

### Test mode only (including production Worker)

- The **deployed** Worker follows the same rules as local dev: **only Stripe test keys** (`sk_test_...`). **Live keys (`sk_live_...`) are rejected** — there are **no real card charges** on the public demo; MPP is a **concept demo** using Stripe test mode.
- All MPP charges in this demo are **sandbox** amounts (currently **$0.01 USD** per paid **`tools/call`** request).
- ACP checkout remains a **simulated** merchant flow (demo tokens), separate from MPP access fees.
- **`GET /`** and **`GET /health`** include `mpp_demo_billing` (and unpaid **`tools/call`** responses include `x-mpp-stripe-mode: test`) so clients can see that billing is test-only.

### When MPP is active

If **both** `STRIPE_SECRET_KEY` and `MPP_SECRET_KEY` are configured as Cloudflare secrets:

1. **Handshake and discovery** (`initialize`, `tools/list`, `ping`, notifications, etc.) stay **free** so Streamable HTTP clients (Cursor, `mcp-remote`) can connect without MPP.
2. **Paid JSON-RPC** (notably **`tools/call`**) without a valid `Authorization: Payment ...` credential returns **402** with a `WWW-Authenticate: Payment` challenge (RFC 9457 problem body).
3. After the client pays (Stripe test mode + SPT) and retries with the credential, the Worker runs the tool and may attach a **`Payment-Receipt`** header on success.

If those secrets are **omitted**, `POST /mcp` behaves as before (no payment gate) so CI and local dev stay simple.

### Configure secrets

```bash
cd backend

# Stripe test secret from https://dashboard.stripe.com/test/apikeys
npx wrangler secret put STRIPE_SECRET_KEY

# 32-byte key, base64 — binds challenges (mpp.dev / mppx)
openssl rand -base64 32 | npx wrangler secret put MPP_SECRET_KEY
```

### Manual smoke test (curl)

Handshake (expect **200** when MPP is configured):

```bash
curl -i -X POST "https://YOUR-WORKER.workers.dev/mcp" \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

Unpaid **`tools/call`** (expect **402** when MPP is configured):

```bash
curl -i -X POST "https://YOUR-WORKER.workers.dev/mcp" \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_products","arguments":{}}}'
```

Paid retry for tool calls requires an MPP-aware client (for example [`npx mppx`](https://www.npmjs.com/package/mppx) against a local dev server, or a small app using Stripe Elements to mint an SPT per Stripe’s docs). See `mcp-config/README.md`.

## Local development

```bash
cd backend
npm install
npm run test
npm run dev
```

## Learn more

- Blog walkthrough: [sumitagrawal.dev/blog/machine-payments-protocol-mcp-acp/](https://sumitagrawal.dev/blog/machine-payments-protocol-mcp-acp/) (after the portfolio PR is merged)
