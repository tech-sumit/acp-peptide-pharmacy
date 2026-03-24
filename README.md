# ACP Peptide Pharmacy

A full-stack demo storefront that combines the Agentic Commerce Protocol (ACP)
with a companion MCP server so Claude, Cursor, and other AI clients can browse
products and place demo peptide orders.

## Architecture

- `backend/`: Cloudflare Worker with ACP checkout endpoints and MCP tools
- `frontend/`: static storefront to be published via GitHub Pages
- `mcp-config/`: ready-to-copy MCP client configuration examples

## Status

This repository is being built in stages:

1. ACP backend on Cloudflare Workers
2. MCP server for remote AI clients
3. GitHub Pages storefront
4. Deployment and documentation
