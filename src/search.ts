import type { Product } from "./types.js";

export interface SearchOptions {
  query: string;
  minPrice?: number;
  maxPrice?: number;
  /** ISO 4217. Prices are never converted; only products in this currency match. */
  currency?: string;
  network?: string;
  merchant?: string;
  sort?: "relevance" | "price_asc" | "price_desc";
  limit: number;
}

/** Lowercase and strip diacritics so "Ștefan" matches "stefan" and "cafea" matches "căfea". */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function tokenize(s: string): string[] {
  return normalize(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

const FIELD_WEIGHT = { title: 3, brand: 2, category: 1.5, description: 0.5 } as const;
type Field = keyof typeof FIELD_WEIGHT;

const indexCache = new WeakMap<Product, Record<Field, string[]>>();

function wordsOf(p: Product): Record<Field, string[]> {
  let w = indexCache.get(p);
  if (!w) {
    w = {
      title: tokenize(p.title),
      brand: tokenize(p.brand ?? ""),
      category: tokenize(p.category ?? ""),
      description: tokenize(p.description ?? ""),
    };
    indexCache.set(p, w);
  }
  return w;
}

/** 1 = exact word, 0.7 = prefix, 0.4 = substring (4+ chars), 0 = no match. */
function strength(token: string, words: string[]): number {
  let best = 0;
  for (const w of words) {
    if (w === token) return 1;
    if (token.length >= 2 && w.startsWith(token)) best = Math.max(best, 0.7);
    else if (token.length >= 4 && w.includes(token)) best = Math.max(best, 0.4);
  }
  return best;
}

function score(p: Product, tokens: string[]): { score: number; matched: number } {
  const words = wordsOf(p);
  let total = 0;
  let matched = 0;
  for (const t of tokens) {
    let best = 0;
    for (const f of Object.keys(FIELD_WEIGHT) as Field[]) {
      best = Math.max(best, FIELD_WEIGHT[f] * strength(t, words[f]));
    }
    if (best > 0) matched++;
    total += best;
  }
  return { score: total, matched };
}

export function searchProducts(products: Product[], opts: SearchOptions): Product[] {
  const wantCurrency = opts.currency?.toUpperCase();
  const wantMerchant = opts.merchant ? normalize(opts.merchant) : undefined;

  const candidates = products.filter((p) => {
    if (opts.minPrice !== undefined && p.price < opts.minPrice) return false;
    if (opts.maxPrice !== undefined && p.price > opts.maxPrice) return false;
    if (wantCurrency && p.currency !== wantCurrency) return false;
    if (opts.network && p.network !== opts.network) return false;
    if (wantMerchant && !normalize(p.merchant).includes(wantMerchant)) return false;
    return true;
  });

  const tokens = tokenize(opts.query);
  let ranked: { p: Product; score: number }[];
  if (tokens.length === 0) {
    ranked = candidates.map((p) => ({ p, score: 0 }));
  } else {
    const scored = candidates.map((p) => ({ p, ...score(p, tokens) }));
    // Prefer products matching every word; fall back to partial matches only if there are none.
    let hits = scored.filter((s) => s.matched === tokens.length);
    if (hits.length === 0) hits = scored.filter((s) => s.matched > 0);
    ranked = hits;
  }

  const sort = opts.sort ?? "relevance";
  ranked.sort((a, b) => {
    if (sort === "price_asc") return a.p.price - b.p.price;
    if (sort === "price_desc") return b.p.price - a.p.price;
    return b.score - a.score || a.p.price - b.p.price;
  });
  return ranked.slice(0, opts.limit).map((r) => r.p);
}
