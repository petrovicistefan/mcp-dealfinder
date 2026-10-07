import { readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import type { FeedConfig } from "./config.js";
import { productRef, type Product } from "./types.js";

const MAX_FEED_BYTES = 100 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;

/** RFC 4180-style CSV parser (quoted fields, escaped quotes, CRLF, BOM). */
export function parseCsv(input: string, delimiter = ","): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/**
 * Parses prices as they appear in real feeds: `19.99`, `19,99`, `1.299,99`,
 * `1,299.99`, `1.299`, `19.99 EUR`, `€ 19,99`. Returns undefined for anything else.
 */
export function parsePrice(raw: string | number | undefined | null): number | undefined {
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? raw : undefined;
  if (!raw) return undefined;
  let s = raw.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(s) || s.includes("-")) return undefined;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // The separator that comes last is the decimal one.
    const dec = lastDot > lastComma ? "." : ",";
    const group = dec === "." ? "," : ".";
    s = s.split(group).join("").replace(dec, ".");
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? "." : ",";
    const parts = s.split(sep);
    // "1,299" / "1.299" is a thousands separator; "12,5" / "0.125" is decimal.
    const thousands =
      parts.length > 2 ||
      (parts.length === 2 && /^\d{3}$/.test(parts[1]!) && /^[1-9]\d{0,2}$/.test(parts[0]!));
    s = thousands ? parts.join("") : parts.join(".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Reads `key` from a row; falls back to a dotted path for nested JSON. */
function pick(row: Record<string, unknown>, key: string | undefined): unknown {
  if (!key) return undefined;
  if (key in row) return row[key];
  let cur: unknown = row;
  for (const part of key.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function str(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

function httpUrl(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function mapRow(row: Record<string, unknown>, feed: FeedConfig): Product | undefined {
  const m = feed.map;
  const id = str(pick(row, m.id));
  const title = str(pick(row, m.title));
  const url = httpUrl(pick(row, m.url));
  const price = parsePrice(pick(row, m.price) as string | number | undefined);
  if (!id || !title || !url || price === undefined) return undefined;

  const cur = str(pick(row, m.currency))?.toUpperCase();
  const imageUrl = httpUrl(pick(row, m.imageUrl));
  return {
    id,
    title,
    price,
    currency: cur && /^[A-Z]{3}$/.test(cur) ? cur : feed.currency.toUpperCase(),
    url,
    ...(imageUrl && { imageUrl }),
    brand: str(pick(row, m.brand)),
    category: str(pick(row, m.category)),
    description: str(pick(row, m.description)),
    merchant: feed.merchant,
    feedId: feed.id,
    network: feed.network,
  };
}

async function readSource(source: string, baseDir: string): Promise<string> {
  let buf: Buffer;
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "mcp-dealfinder" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    buf = Buffer.from(await res.arrayBuffer());
  } else {
    buf = await readFile(path.resolve(baseDir, source));
  }
  if (buf.length > MAX_FEED_BYTES) throw new Error(`feed larger than ${MAX_FEED_BYTES} bytes`);
  // Many networks ship gzipped feeds; detect by magic bytes instead of trusting the extension.
  if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  return buf.toString("utf8");
}

export async function loadFeed(feed: FeedConfig, baseDir: string): Promise<Product[]> {
  const text = await readSource(feed.source, baseDir);
  let rows: Record<string, unknown>[];

  if (feed.format === "csv") {
    const table = parseCsv(text, feed.delimiter ?? ",");
    const header = (table[0] ?? []).map((h) => h.trim());
    rows = table.slice(1).map((cells) => {
      const o: Record<string, unknown> = {};
      header.forEach((h, i) => {
        if (h) o[h] = cells[i];
      });
      return o;
    });
  } else {
    let data: unknown = JSON.parse(text);
    if (feed.jsonPath) data = pick(data as Record<string, unknown>, feed.jsonPath);
    if (!Array.isArray(data)) {
      throw new Error(
        feed.jsonPath
          ? `jsonPath "${feed.jsonPath}" is not an array`
          : "JSON root is not an array (set jsonPath)",
      );
    }
    rows = data as Record<string, unknown>[];
  }

  const seen = new Set<string>();
  const products: Product[] = [];
  for (const row of rows) {
    const p = mapRow(row, feed);
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      products.push(p);
    }
  }
  if (products.length === 0 && rows.length > 0) {
    throw new Error(`0 of ${rows.length} rows could be mapped — check "map" against the feed's columns`);
  }
  return products;
}

export interface FeedStatus {
  id: string;
  merchant: string;
  network: string;
  products: number;
  loadedAt: string | null;
  error: string | null;
}

interface FeedState {
  products: Product[];
  loadedAt: number | null;
  error: string | null;
}

/** Holds every feed in memory and re-downloads when older than `refreshMs`. */
export class FeedStore {
  private state = new Map<string, FeedState>();
  private byRef = new Map<string, Product>();
  private inflight: Promise<void> | null = null;

  constructor(
    private feeds: FeedConfig[],
    private baseDir: string,
    private refreshMs: number,
  ) {
    for (const f of feeds) this.state.set(f.id, { products: [], loadedAt: null, error: null });
  }

  feedConfig(feedId: string): FeedConfig | undefined {
    return this.feeds.find((f) => f.id === feedId);
  }

  private async loadOne(feed: FeedConfig): Promise<void> {
    const prev = this.state.get(feed.id)!;
    try {
      const products = await loadFeed(feed, this.baseDir);
      this.state.set(feed.id, { products, loadedAt: Date.now(), error: null });
    } catch (err) {
      // Keep serving the previous data if a refresh fails.
      this.state.set(feed.id, { ...prev, error: (err as Error).message });
    }
  }

  private reindex(): void {
    this.byRef.clear();
    for (const s of this.state.values()) for (const p of s.products) this.byRef.set(productRef(p), p);
  }

  async load(): Promise<void> {
    await Promise.all(this.feeds.map((f) => this.loadOne(f)));
    this.reindex();
  }

  /** Reloads stale feeds. Concurrent callers share one reload. */
  async ensureFresh(now = Date.now()): Promise<void> {
    const stale = this.feeds.filter((f) => {
      const s = this.state.get(f.id)!;
      return s.loadedAt === null || now - s.loadedAt > this.refreshMs;
    });
    if (stale.length === 0) return;
    this.inflight ??= Promise.all(stale.map((f) => this.loadOne(f)))
      .then(() => this.reindex())
      .finally(() => {
        this.inflight = null;
      });
    await this.inflight;
  }

  all(): Product[] {
    return [...this.byRef.values()];
  }

  get(ref: string): Product | undefined {
    return this.byRef.get(ref);
  }

  status(): FeedStatus[] {
    return this.feeds.map((f) => {
      const s = this.state.get(f.id)!;
      return {
        id: f.id,
        merchant: f.merchant,
        network: f.network,
        products: s.products.length,
        loadedAt: s.loadedAt ? new Date(s.loadedAt).toISOString() : null,
        error: s.error,
      };
    });
  }
}
