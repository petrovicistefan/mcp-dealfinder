# Changelog

## 0.1.1 — 2026-10-09

- Test script works on Node 20 (no glob in `npm test`)
- README: author and availability section
- Package metadata: homepage, bugs, author URL, MCP registry name (`mcpName`)

## 0.1.0 — 2026-10-07

Initial public release.

- Tools: `search_products`, `compare_products`, `get_buy_link`, `dealfinder_status`
- Feeds: CSV/JSON, local or URL, gzip; European price formats
- Affiliate links: Amazon, Awin, generic `template` networks, disclosure on every tracked link
- `npm run check` (feed validation) and `npm run link-template` (derive a network template from one link)
- Library API with `registerExtras` for custom tools
