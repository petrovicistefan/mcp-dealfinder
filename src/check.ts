import type { Config, NetworkConfig } from "./config.js";
import { loadFeed } from "./feeds.js";
import { buildTrackedUrl } from "./links.js";
import type { Product } from "./types.js";

export interface SampleLink {
  title: string;
  price: number;
  currency: string;
  link: string;
  tracked: boolean;
  reason?: string;
}

export interface FeedReport {
  id: string;
  merchant: string;
  network: string;
  products: number;
  error: string | null;
  /** Share of products (0–1) that have each optional field. */
  coverage: { brand: number; category: number; description: number; image: number };
  currencies: string[];
  priceMin?: number;
  priceMax?: number;
  samples: SampleLink[];
  warnings: string[];
}

const share = (products: Product[], has: (p: Product) => boolean) =>
  products.length === 0 ? 0 : products.filter(has).length / products.length;

/**
 * Loads every feed of a config and reports what a real run would see:
 * counts, field coverage, price range and sample links, plus mistakes that
 * would silently produce untracked links. Never throws: errors go in the report.
 */
export async function checkConfig(
  config: Config,
  baseDir: string,
  networks: Record<string, NetworkConfig> = config.networks,
  sampleSize = 3,
): Promise<FeedReport[]> {
  const reports: FeedReport[] = [];
  for (const feed of config.feeds) {
    const warnings: string[] = [];
    const net = networks[feed.network];
    if (!net) warnings.push(`network "${feed.network}" is not defined under "networks": links will be untracked`);
    if (net?.kind === "awin" && !feed.merchantId) warnings.push('Awin feeds need "merchantId" (awinmid): links will be untracked');

    let products: Product[] = [];
    let error: string | null = null;
    try {
      products = await loadFeed(feed, baseDir);
    } catch (err) {
      error = (err as Error).message;
    }

    const prices = products.map((p) => p.price);
    const zero = prices.filter((p) => p === 0).length;
    if (zero > 0) warnings.push(`${zero} product(s) have price 0: check the "price" column`);
    const currencies = [...new Set(products.map((p) => p.currency))].sort();

    reports.push({
      id: feed.id,
      merchant: feed.merchant,
      network: feed.network,
      products: products.length,
      error,
      coverage: {
        brand: share(products, (p) => !!p.brand),
        category: share(products, (p) => !!p.category),
        description: share(products, (p) => !!p.description),
        image: share(products, (p) => !!p.imageUrl),
      },
      currencies,
      priceMin: prices.length ? Math.min(...prices) : undefined,
      priceMax: prices.length ? Math.max(...prices) : undefined,
      samples: products.slice(0, sampleSize).map((p) => {
        const t = buildTrackedUrl(p.url, net, { merchantId: feed.merchantId, params: feed.params });
        return { title: p.title, price: p.price, currency: p.currency, link: t.url, tracked: t.tracked, reason: t.reason };
      }),
      warnings,
    });
  }
  return reports;
}

export function isHealthy(reports: FeedReport[]): boolean {
  return reports.every((r) => r.error === null && r.products > 0);
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function formatReport(reports: FeedReport[]): string {
  const out: string[] = [];
  for (const r of reports) {
    out.push(`Feed "${r.id}" — ${r.merchant} (network: ${r.network})`);
    if (r.error) {
      out.push(`  ✗ ERROR: ${r.error}`);
    } else if (r.products === 0) {
      out.push("  ✗ 0 products loaded");
    } else {
      out.push(`  ✓ ${r.products} products, ${r.currencies.join("/")} ${r.priceMin}–${r.priceMax}`);
      out.push(
        `  fields: brand ${pct(r.coverage.brand)} · category ${pct(r.coverage.category)} · description ${pct(r.coverage.description)} · image ${pct(r.coverage.image)}`,
      );
      for (const s of r.samples) {
        out.push(`  - ${s.title} (${s.price} ${s.currency})`);
        out.push(`    ${s.tracked ? "tracked  " : `UNTRACKED (${s.reason}) `}${s.link}`);
      }
    }
    for (const w of r.warnings) out.push(`  ! ${w}`);
    out.push("");
  }
  const bad = reports.filter((r) => r.error !== null || r.products === 0).length;
  out.push(bad === 0 ? "All feeds OK." : `${bad} of ${reports.length} feed(s) need attention.`);
  return out.join("\n");
}
