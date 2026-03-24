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

## Notes

- The MCP server uses Streamable HTTP on Cloudflare Workers.
- Claude Desktop and Cursor can connect through `mcp-remote`.
- Orders are demo-only and always marked research-use-only.
