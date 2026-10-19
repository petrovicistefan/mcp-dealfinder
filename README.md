# MCP DealFinder

**Turn your affiliate feeds into AI shopping answers with your tracked links and a clear disclosure.**

MCP server for affiliate marketers that lets AI assistants search product feeds from Awin, Amazon, Commission Junction, Impact, 2Performant, and any network — and return buy links built with **your own affiliate IDs**. Works with Claude, ChatGPT, Cursor, and any MCP-compatible AI.

[![npm version](https://img.shields.io/npm/v/mcp-dealfinder?color=blue)](https://www.npmjs.com/package/mcp-dealfinder)
[![npm downloads](https://img.shields.io/npm/dm/mcp-dealfinder)](https://www.npmjs.com/package/mcp-dealfinder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/petrovicistefan/mcp-dealfinder?style=social)](https://github.com/petrovicistefan/mcp-dealfinder)

---

## ⚡ Quick Start

### Install via npx (no installation needed)

```bash
npx mcp-dealfinder
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dealfinder": {
      "command": "npx",
      "args": ["-y", "mcp-dealfinder"],
      "env": { "DEALFINDER_CONFIG": "/absolute/path/to/dealfinder.config.json" }
    }
  }
}
```

### Cursor / VS Code

Add to your MCP settings:

```json
{
  "mcpServers": {
    "dealfinder": {
      "command": "npx",
      "args": ["-y", "mcp-dealfinder"],
      "env": { "DEALFINDER_CONFIG": "/absolute/path/to/dealfinder.config.json" }
    }
  }
}
```

### Try It Immediately (Demo Mode)

With no config file, DealFinder starts with **fictional demo products** so you can test it right away. Ask your AI:

> *"Find noise-cancelling headphones under 150 EUR and compare the top two"*

**⭐ Star this repository if it helps you!** → [Give a star](https://github.com/petrovicistefan/mcp-dealfinder)

---

<!--
## 🎬 Demo

![DealFinder Demo](docs/demo.gif)

TODO: Add a demo GIF showing search and link generation
-->

---

## 📋 Table of Contents

- [Why MCP DealFinder?](#why-mcp-dealfinder)
- [Features](#features)
- [Use Cases & Example Prompts](#use-cases--example-prompts)
- [How It Compares](#how-it-compares)
- [Configure Your Feeds](#configure-your-feeds)
- [Supported Networks](#supported-networks)
- [Compliance](#compliance--please-read)
- [Build on It (Library API)](#build-on-it)
- [Development](#development)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)
- [About the Author](#about-the-author)

---

## Why MCP DealFinder?

**You're an affiliate marketer.** You want AI to recommend products from your feeds with *your* tracked links — not send customers to Amazon with someone else's affiliate ID, or hallucinate product details.

DealFinder solves this:
- ✅ Search **your own product feeds** from any affiliate network
- ✅ Every link includes **your affiliate IDs** (never generic or missing)
- ✅ **Clear disclosure text** ships with every tracked link
- ✅ Works with **Awin, Amazon, CJ, Impact, 2Performant**, and any deep-link network
- ✅ Ranked by **relevance or price**, never commission (keeps it honest)
- ✅ **Local CSV/JSON feeds** (no API keys, no rate limits, no external dependencies)

---

## Features

### MCP Tools

| Tool | What It Does |
|------|--------------|
| `search_products` | Keyword search with price, currency, network, and merchant filters. Diacritics-insensitive. Returns up to 20 results ranked by relevance or price. |
| `compare_products` | Side-by-side comparison of 2–5 products with the cheapest marked. |
| `get_buy_link` | Returns the affiliate link for one product (with your IDs and disclosure text). |
| `dealfinder_status` | Shows feed counts, errors, and which networks produce tracked links. |

All tools accept an optional `sub_id` parameter to tag links (useful for tracking which post/page generated the sale).

### Core Capabilities

- **Multi-network support**: Awin, Amazon Associates, CJ, Impact, 2Performant, Profitshare, or any network with a deep-link template
- **Feed flexibility**: CSV or JSON, local files or URLs, `.gz` automatically decompressed
- **European price parsing**: Handles `1.299,99`, `19,99`, and `€ 24.50` formats
- **Graceful fallback**: If a tracked link can't be built (missing config), returns the plain merchant URL and marks it `tracked: false`
- **Validation tool**: `npm run check` loads feeds and reports product counts, coverage, price ranges, and sample links before you connect an AI

---

## Use Cases & Example Prompts

### 1. Product Recommendations

> *"Find the best ergonomic office chair under $300"*

> *"Show me noise-cancelling headphones available from these merchants: TechGear, SoundPro"*

### 2. Price Comparisons

> *"Compare the top 3 espresso machines between 200-400 EUR"*

> *"Find the cheapest laptop with 16GB RAM from my Awin feed"*

### 3. Niche Research

> *"Search for vegan protein powder from Impact merchants"*

> *"What cameras under 800 EUR are in my feeds right now?"*

### 4. Content Creation

> *"Find 5 winter jackets under $150 and write a comparison post with affiliate links"*

> *"Search for budget gaming keyboards and create a buying guide"*

---

## How It Compares

*As of October 2026. Corrections welcome.*

| Feature | MCP DealFinder | OpenAffiliate | Affiliate.com MCP | Fewsats amazon-mcp |
|---------|----------------|---------------|-------------------|-------------------|
| **Your own affiliate IDs** | ✅ All networks | ❌ Registry only, no personalization | ✅ Account-based | ✅ Amazon only |
| **Local feeds (no API)** | ✅ CSV/JSON | ❌ Hosted registry | ❌ Requires API subscription | ❌ Hosted backend |
| **Multi-network** | ✅ Awin, Amazon, CJ, Impact, 2Performant, generic templates | ✅ 349+ programs (registry) | ✅ Network search | ❌ Amazon only |
| **Product search** | ✅ Keyword, price, merchant filters | ✅ Program search | ✅ Product search | ⚠️ **Discontinued** |
| **Tracked link generation** | ✅ Per network config | ❌ Program info only | ✅ OAuth-based | ⚠️ **Service down** |
| **Disclosure included** | ✅ On every link | ➖ N/A | ➖ Network dependent | ➖ N/A |
| **Setup complexity** | ⭐⭐ (config file + feeds) | ⭐ (one URL) | ⭐⭐⭐ (OAuth + subscription) | ⚠️ **No longer maintained** |
| **Cost** | Free, MIT | Free, MIT | Paid subscription | Was paid (defunct) |

**DealFinder is for you if:**
- You already have affiliate feeds from Awin, Amazon, or other networks
- You want full control over your data (local CSVs, no external API dependencies)
- You need tracked links with *your* IDs, not program discovery

**Consider alternatives if:**
- **[OpenAffiliate](https://github.com/Affitor/open-affiliate)** — You're exploring new affiliate programs and need a searchable registry (not product search).
- **[Affiliate.com MCP](https://guides.affiliate.com/guides/mcp)** — You're already an Affiliate.com customer and want OAuth-integrated product search.

---

## Configure Your Feeds

Copy [examples/dealfinder.config.example.json](examples/dealfinder.config.example.json) to `dealfinder.config.json` (gitignored) and set the `DEALFINDER_CONFIG` environment variable.

### Configuration Structure

```json
{
  "networks": {
    "awin": {
      "kind": "awin",
      "publisherId": "YOUR_PUBLISHER_ID",
      "apiKey": "YOUR_API_KEY"
    },
    "amazon": {
      "kind": "amazon",
      "tag": "yourtag-20"
    }
  },
  "feeds": [
    {
      "url": "https://example.com/feed.csv.gz",
      "network": "awin",
      "refreshHours": 6,
      "columns": {
        "name": "product_name",
        "price": "price",
        "currency": "currency",
        "url": "deep_link"
      }
    }
  ]
}
```

- **`networks`** — Your affiliate account details by network name (used to build tracked links)
- **`feeds`** — Product data sources: CSV or JSON, local file path or URL, `.gz` automatically handled
- **`columns`** — Maps your feed's column names to DealFinder's expected fields

> **Security:** Feed URLs often contain API keys. Keep them in `dealfinder.config.json`, never commit to version control.

---

## Supported Networks

| Network `kind` | How It Builds Links | Requirements |
|----------------|-------------------|--------------|
| `amazon` | Adds `tag` (+ `ascsubtag`) to `amazon.*` product URLs | Feed must contain product URLs. Amazon offers no official feeds; supply your own product list. |
| `awin` | Builds `awin1.com/cread.php` deep links | Needs `publisherId` and `merchantId` (awinmid) per feed. |
| `template` | Generic template for CJ, Impact, 2Performant, etc. | Copy the deep-link format from your network's link builder and put `{urlEncoded}` where the destination URL goes. Also available: `{url}`, `{subId}`, any key from `params`. |

### Derive a Link Template (for CJ, Impact, etc.)

Not sure about your network's link format? Generate one test link in your network's dashboard, then run:

```bash
npm run link-template -- --link "<generated link>" --url "<product URL>" --name mynetwork
```

It extracts your IDs, replaces the destination with `{urlEncoded}`, prints the `networks` config entry, and verifies by rebuilding your link.

### Graceful Fallback

If a tracked link cannot be built (missing account config or placeholder), DealFinder returns the plain merchant URL and marks it `tracked: false`. You never get a broken link.

### Validate Before Connecting

```bash
DEALFINDER_CONFIG=$PWD/dealfinder.config.json npm run check
```

Loads every feed and reports:
- Product counts and field coverage
- Price ranges and currency distribution
- Sample links (tracked and plain)
- Configuration errors that would prevent tracking

---

## Compliance — Please Read

### Legal Requirements

- ✅ **Use official feeds/APIs only**. Scraping violates most networks' terms of service.
- ✅ **Check each program's terms** before use, including whether AI-assisted promotion is allowed.
- ✅ **Use your own affiliate IDs on your own traffic**. Networks attribute sales to the publisher who referred the visitor — do not rotate or share IDs.
- ❌ **Do not buy through your own affiliate links**. Most programs forbid self-referral.
- ✅ **Keep the disclosure visible** next to affiliate links. DealFinder includes disclosure text with every tracked link — make sure your AI shows it.

### Data Accuracy

- Prices reflect the last feed refresh (`refreshHours`, default 6) and are not converted between currencies.
- Always display the product's native currency to avoid misleading customers.

---

## Build on It

DealFinder exports a **library API**. Use `startServer` or `createServer` with a `registerExtras(server, toolkit)` callback to add your own MCP tools while reusing product presentation and link building:

```typescript
import { startServer, z } from "mcp-dealfinder";

await startServer({
  name: "my-dealfinder",
  registerExtras: (server, kit) => {
    server.registerTool(
      "cheapest_of",
      { inputSchema: { refs: z.array(z.string()).min(2) } },
      async ({ refs }) => {
        const { products } = kit.resolveRefs(refs);
        const cheapest = [...products].sort((a, b) => a.price - b.price)[0]!;
        return kit.text(kit.present(cheapest));
      }
    );
  },
});
```

This example adds a `cheapest_of` tool that takes product references and returns the cheapest one. You can extend DealFinder with custom filtering, scoring, or integration logic without forking.

---

## Development

```bash
npm install
npm test             # node:test: links, link-template, feeds, search, check, MCP server
npm run dev          # run from source over stdio
npm run build        # compile TypeScript to dist/
```

### Project Structure

```
src/
  config.ts         Config schema + loader (falls back to demo data)
  feeds.ts          CSV/JSON/gzip loading, price parsing, FeedStore
  search.ts         Ranked keyword search (relevance or price)
  links.ts          Affiliate deep-link builders per network
  link-template.ts  Derive a network template from one generated link
  check.ts          Config/feed validation report
  server.ts         MCP tools + extension hook
  bootstrap.ts      Config → feeds → server over stdio
  lib.ts            Public library API
```

---

## FAQ

### Why does DealFinder need my affiliate IDs?

Without your IDs, the AI would return plain merchant URLs (no commission for you) or someone else's affiliate link. DealFinder ensures every tracked link uses *your* credentials.

### Can I use DealFinder with Amazon Associates?

Yes, but Amazon offers no official product feeds, and the Creators API requires ≥10 qualifying sales in 30 days. You must supply your own list of Amazon product URLs. DealFinder will add your `tag` to each link.

### Does DealFinder work with network APIs, or only CSV feeds?

Currently CSV/JSON feeds (local or URL). API integrations (Awin Product API, CJ Product Catalog, etc.) are planned for future releases.

### What if a product's price changed since the feed was refreshed?

The AI sees the last refresh's price. Set `refreshHours` in your feed config (default 6 hours) to balance freshness and load. Always tell customers "prices subject to change" in your disclosure.

### Can I track which page or post generated a sale?

Yes! Every tool accepts an optional `sub_id` parameter. Pass a unique identifier (e.g., `post-123`, `email-campaign-nov`) and it will be included in your affiliate links, visible in your network's reporting.

### Is my feed data sent anywhere?

No. DealFinder runs locally via stdio. Feeds are loaded into memory, never transmitted. Your config file (which may contain API keys) stays on your machine.

---

## Contributing

Contributions are welcome! Please:
- Keep changes focused and well-tested
- Add tests for new network templates
- Update documentation for new features

See [GitHub Issues](https://github.com/petrovicistefan/mcp-dealfinder/issues) for open tasks and feature requests.

---

## License

[MIT](LICENSE). Paid extensions built on this library are distributed separately.

---

## About the Author

Built by **[Stefan Petrovici](https://petrovicistefan.ro)**, software engineer based in Iași, Romania.

**I'm open to work.** I build web and mobile apps, take ideas from first sketch to production, and work project-based or time-based with clients worldwide. If you need an MCP server, an AI assistant for your shop, or help integrating affiliate marketing with AI — [get in touch](https://petrovicistefan.ro).

---

## ⭐ Support This Project

**If MCP DealFinder helps you, [star this repository](https://github.com/petrovicistefan/mcp-dealfinder)!**

A GitHub star helps other affiliate marketers discover the project and keeps me motivated to maintain it. Thank you for supporting open source!

---

## More by the Author

MCP servers by Stefan Petrovici:

| Project | Description |
|---------|-------------|
| **[mcp-security-guard](https://github.com/petrovicistefan/mcp-security-guard)** | Audit MCP servers for tool poisoning, rug pulls, and OWASP MCP Top 10 vulnerabilities |
| **[mcp-cost-optimizer](https://github.com/petrovicistefan/mcp-cost-optimizer)** | Track and reduce AI API costs across providers |
| **[mcp-database-doctor](https://github.com/petrovicistefan/mcp-database-doctor)** | Database schema analysis and optimization recommendations |
| **[mcp-dependency-doctor](https://github.com/petrovicistefan/mcp-dependency-doctor)** | Dependency health checks and vulnerability scanning |
| **[mcp-seo-auditor](https://github.com/petrovicistefan/mcp-seo-auditor)** | SEO analysis and recommendations for websites |
| **[mcp-api-guardian](https://github.com/petrovicistefan/mcp-api-guardian)** | API security and rate limiting analyzer |
| **[mcp-marketplace](https://github.com/petrovicistefan/mcp-marketplace)** | Browse the full MCP server collection |

Explore the full collection at **[mcp-marketplace](https://github.com/petrovicistefan/mcp-marketplace)**.

---

*MCP DealFinder is not affiliated with Awin, Amazon, Commission Junction, Impact, 2Performant, or any other affiliate network mentioned in this document.*
