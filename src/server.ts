import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { NetworkConfig } from "./config.js";
import type { FeedStore } from "./feeds.js";
import { DISCLOSURE, buildTrackedUrl } from "./links.js";
import { searchProducts } from "./search.js";
import { productRef, type Product } from "./types.js";

export interface ServerDeps {
  store: FeedStore;
  /** Affiliate accounts used to build links: the ones of the person running the server. */
  networks: Record<string, NetworkConfig>;
  configOrigin: string;
  demo: boolean;
}

export const MAX_RESULTS = 20;

export interface PresentedProduct {
  ref: string;
  title: string;
  brand?: string;
  category?: string;
  price: number;
  currency: string;
  merchant: string;
  image_url?: string;
  description?: string;
  buy_link: string;
  tracked: boolean;
  /** Present exactly when `tracked` is true. Show it next to the link. */
  disclosure?: string;
}

export interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

/** Helpers shared by the built-in tools and by extensions that register their own. */
export interface Toolkit {
  store: FeedStore;
  present(p: Product, subId?: string, detail?: "short" | "full"): PresentedProduct;
  resolveRefs(refs: string[]): { products: Product[]; missing: string[] };
  text(payload: unknown): ToolResult;
  fail(message: string): ToolResult;
}

export interface ServerOptions {
  name?: string;
  version?: string;
  /** Appended to the built-in instructions the assistant receives. */
  instructions?: string;
  /** Register additional tools, e.g. from a commercial extension package. */
  registerExtras?: (server: McpServer, kit: Toolkit) => void;
}

const INSTRUCTIONS = [
  "DealFinder searches product feeds from affiliate networks and returns buy links.",
  "Rules for you, the assistant:",
  "- Whenever you show a link whose `tracked` is true, also show its `disclosure` text next to it.",
  "- Only state facts present in the tool results (price, brand, category, description). Never invent specs, ratings or stock.",
  "- Prices are as of the last feed refresh and are not converted between currencies; say so if the user needs exact prices.",
  "- Use search_products first, then compare_products or get_buy_link with the `ref` values it returns.",
].join("\n");

export function createToolkit(deps: ServerDeps): Toolkit {
  const { store, networks } = deps;

  function present(p: Product, subId?: string, detail: "short" | "full" = "short"): PresentedProduct {
    const feed = store.feedConfig(p.feedId);
    const link = buildTrackedUrl(p.url, networks[p.network], {
      merchantId: feed?.merchantId,
      params: feed?.params,
      subId,
    });
    const description = p.description && (detail === "full" ? p.description : p.description.slice(0, 160));
    return {
      ref: productRef(p),
      title: p.title,
      brand: p.brand,
      category: p.category,
      price: p.price,
      currency: p.currency,
      merchant: p.merchant,
      image_url: p.imageUrl,
      description,
      buy_link: link.url,
      tracked: link.tracked,
      disclosure: link.tracked ? DISCLOSURE : undefined,
    };
  }

  function resolveRefs(refs: string[]) {
    const products: Product[] = [];
    const missing: string[] = [];
    for (const r of refs) {
      const p = store.get(r);
      if (p) products.push(p);
      else missing.push(r);
    }
    return { products, missing };
  }

  const text = (payload: unknown): ToolResult => ({
    content: [{ type: "text", text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2) }],
  });
  const fail = (message: string): ToolResult => ({ isError: true, ...text(message) });

  return { store, present, resolveRefs, text, fail };
}

export function createServer(deps: ServerDeps, options: ServerOptions = {}): McpServer {
  const instructions = options.instructions ? `${INSTRUCTIONS}\n${options.instructions}` : INSTRUCTIONS;
  const server = new McpServer(
    { name: options.name ?? "dealfinder", version: options.version ?? "0.1.0" },
    { instructions },
  );
  const kit = createToolkit(deps);
  const { store, present, resolveRefs, text, fail } = kit;
  const readOnly = { readOnlyHint: true, openWorldHint: true } as const;

  server.registerTool(
    "search_products",
    {
      title: "Search products",
      description:
        "Search the loaded affiliate product feeds by keywords. Returns products with price, merchant and a buy link. " +
        "Filters: price range, currency (no conversion), network, merchant. Use the returned `ref` in other tools.",
      inputSchema: {
        query: z.string().min(1).describe("Keywords, e.g. 'noise cancelling headphones'. Diacritics are ignored."),
        max_price: z.number().positive().optional(),
        min_price: z.number().nonnegative().optional(),
        currency: z.string().length(3).optional().describe("ISO code, e.g. EUR. Only products in this currency match."),
        network: z.string().optional().describe("Restrict to one affiliate network key."),
        merchant: z.string().optional().describe("Restrict to merchants whose name contains this text."),
        sort: z.enum(["relevance", "price_asc", "price_desc"]).default("relevance"),
        limit: z.number().int().min(1).max(MAX_RESULTS).default(5),
        sub_id: z.string().max(50).optional().describe("Optional tracking tag (e.g. a campaign or post name)."),
      },
      annotations: { title: "Search products", ...readOnly },
    },
    async (args) => {
      await store.ensureFresh();
      const results = searchProducts(store.all(), {
        query: args.query,
        maxPrice: args.max_price,
        minPrice: args.min_price,
        currency: args.currency,
        network: args.network,
        merchant: args.merchant,
        sort: args.sort,
        limit: args.limit,
      });
      return text({
        count: results.length,
        results: results.map((p) => present(p, args.sub_id)),
        ...(results.length === 0 && { hint: "No matches. Try fewer or more general keywords, or remove price filters." }),
      });
    },
  );

  server.registerTool(
    "compare_products",
    {
      title: "Compare products",
      description: "Side-by-side data for 2–5 products (by `ref`). Marks the cheapest when all share one currency.",
      inputSchema: {
        refs: z.array(z.string()).min(2).max(5),
        sub_id: z.string().max(50).optional(),
      },
      annotations: { title: "Compare products", ...readOnly },
    },
    async ({ refs, sub_id }) => {
      await store.ensureFresh();
      const { products, missing } = resolveRefs(refs);
      if (missing.length > 0) return fail(`Unknown ref(s): ${missing.join(", ")}. Get refs from search_products.`);
      const sameCurrency = new Set(products.map((p) => p.currency)).size === 1;
      const cheapest = sameCurrency ? [...products].sort((a, b) => a.price - b.price)[0] : undefined;
      return text({
        products: products.map((p) => present(p, sub_id, "full")),
        ...(cheapest && { cheapest_ref: productRef(cheapest) }),
        ...(!sameCurrency && { note: "Prices are in different currencies and are not converted." }),
      });
    },
  );

  server.registerTool(
    "get_buy_link",
    {
      title: "Get buy link",
      description: "Return the (affiliate) link for one product by `ref`.",
      inputSchema: {
        ref: z.string(),
        sub_id: z.string().max(50).optional(),
      },
      annotations: { title: "Get buy link", ...readOnly },
    },
    async ({ ref, sub_id }) => {
      await store.ensureFresh();
      const p = store.get(ref);
      if (!p) return fail(`Unknown ref: ${ref}. Get refs from search_products.`);
      const { buy_link, tracked, disclosure } = present(p, sub_id);
      return text({ ref, buy_link, tracked, disclosure });
    },
  );

  server.registerTool(
    "dealfinder_status",
    {
      title: "DealFinder status",
      description: "Shows loaded feeds (counts, last refresh, errors) and which networks produce tracked links.",
      annotations: { title: "DealFinder status", readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      await store.ensureFresh();
      const status = store.status();
      const active = Object.keys(deps.networks);
      const untracked = status.filter((f) => !active.includes(f.network)).map((f) => f.id);
      return text({
        config: deps.configOrigin,
        demo_data: deps.demo,
        links_earn_for: "the affiliate accounts in your config",
        feeds: status,
        networks_with_tracking: active,
        ...(untracked.length > 0 && { feeds_without_tracking: untracked }),
      });
    },
  );

  options.registerExtras?.(server, kit);
  return server;
}
