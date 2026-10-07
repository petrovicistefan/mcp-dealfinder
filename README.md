# mcp-dealfinder

An [MCP](https://modelcontextprotocol.io) server that lets an AI assistant search **affiliate product feeds from any network** and return buy links built with **your own affiliate IDs**. Works with Awin, Amazon, and any network that has deep links (CJ, Impact, 2Performant, Profitshare, …).

Every tracked link ships with a disclosure text, and the server tells the assistant to show it. Search results are ranked by relevance or price, never by commission.

## Quick start

```bash
git clone https://github.com/petrovicistefan/mcp-dealfinder.git
cd mcp-dealfinder
npm install            # also builds
claude mcp add dealfinder -- node "$(pwd)/dist/index.js"
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "dealfinder": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-dealfinder/dist/index.js"],
      "env": { "DEALFINDER_CONFIG": "/absolute/path/to/dealfinder.config.json" }
    }
  }
}
```

With no config it starts on **fictional demo products**, so you can try it immediately. Then ask: *"find noise-cancelling headphones under 150 EUR and compare the top two"*.

## Tools

| Tool | What it does |
|---|---|
| `search_products` | Keyword search with price / currency / network / merchant filters. Diacritics-insensitive. Up to 20 results. |
| `compare_products` | Side-by-side data for 2–5 products, marks the cheapest. |
| `get_buy_link` | The (affiliate) link for one product. |
| `dealfinder_status` | Feeds (counts, errors) and which networks produce tracked links. |

All tools accept an optional `sub_id` to tag links (for example the post they appear in).

## Configure your feeds

Copy [examples/dealfinder.config.example.json](examples/dealfinder.config.example.json) to `dealfinder.config.json` (gitignored) and set `DEALFINDER_CONFIG`.

- **`networks`** — your affiliate accounts, by name.
- **`feeds`** — where products come from (CSV or JSON, local file or URL, `.gz` handled) and how columns map to fields. Prices like `1.299,99`, `19,99` and `€ 24.50` are parsed.

> Feed URLs often contain an API key. Keep them in `dealfinder.config.json`, never in a repository.

| Network `kind` | Builds | Notes |
|---|---|---|
| `amazon` | adds `tag` (+ `ascsubtag`) to `amazon.*` URLs | Feed must contain product URLs. Amazon offers no product feeds, and its Creators API requires ≥10 qualifying sales in 30 days, so supply your own product URLs |
| `awin` | `awin1.com/cread.php` deep link | Needs `merchantId` (awinmid) on the feed |
| `template` | anything else | Copy the deep-link format from the network's own link builder and put `{urlEncoded}` where the destination goes. Also available: `{url}`, `{subId}`, any key from `params` |

**Not sure about a network's link format?** Generate one link in the network's link generator for any product page, then run:

```bash
npm run link-template -- --link "<generated link>" --url "<product URL you pasted>" --name mynetwork
```

It prints the `networks` entry (IDs extracted, destination replaced by `{urlEncoded}`) and verifies it by rebuilding your link. The link contains only public IDs, never API keys.

Links that cannot be built (missing account, missing placeholder) fall back to the plain merchant URL and are reported as `tracked: false` — never a broken link.

Before connecting an assistant, validate everything:

```bash
DEALFINDER_CONFIG=$PWD/dealfinder.config.json npm run check
```

It loads every feed and reports product counts, field coverage, price range, sample links, and mistakes that would produce untracked links.

## Compliance — please read

- Use **official feeds/APIs only**; scraping breaks most networks' terms.
- Check each program's terms before use, including whether promotion through AI assistants is allowed.
- Use **your own** affiliate IDs on **your own** traffic. Do not rotate or share IDs between different people: networks attribute sales to the publisher who referred the visitor.
- Do not buy through your own affiliate links; most programs forbid it.
- Keep the disclosure visible next to affiliate links.
- Prices are as of the last feed refresh (`refreshHours`, default 6) and are not converted between currencies.

## Build on it

The package exports a library API. `startServer` / `createServer` accept `registerExtras(server, toolkit)` to add your own tools while reusing the product presentation and link building:

```ts
import { startServer, z } from "mcp-dealfinder";

await startServer({
  name: "my-dealfinder",
  registerExtras: (server, kit) => {
    server.registerTool("cheapest_of", { inputSchema: { refs: z.array(z.string()).min(2) } }, async ({ refs }) => {
      const { products } = kit.resolveRefs(refs);
      return kit.text(kit.present([...products].sort((a, b) => a.price - b.price)[0]!));
    });
  },
});
```

## Development

```bash
npm test             # node:test: links, link-template, feeds, search, check, MCP server (in-memory)
npm run dev          # run from source over stdio
npm run build
```

```
src/
  config.ts       config schema + loader (falls back to demo data)
  feeds.ts        CSV/JSON/gzip loading, price parsing, FeedStore (refresh, per-feed errors)
  search.ts       ranked keyword search
  links.ts        affiliate deep links per network
  link-template.ts  derive a network template from one generated link
  check.ts        config/feed validation report
  server.ts       MCP tools + extension hook
  bootstrap.ts    config → feeds → server over stdio
  lib.ts          public library API
```

## License

[MIT](LICENSE). Paid extensions built on this library are distributed separately.
