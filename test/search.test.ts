import assert from "node:assert/strict";
import { test } from "node:test";
import { normalize, searchProducts } from "../src/search.js";
import type { Product } from "../src/types.js";

const mk = (id: string, title: string, price: number, extra: Partial<Product> = {}): Product => ({
  id,
  title,
  price,
  currency: "EUR",
  url: `https://x.test/${id}`,
  merchant: "Shop",
  feedId: "f",
  network: "n",
  ...extra,
});

const catalog = [
  mk("1", "Aurelia Calm ANC Headphones", 229, { brand: "Aurelia", category: "Headphones" }),
  mk("2", "Aurelia Pulse Earbuds", 89.9, { brand: "Aurelia", category: "Headphones" }),
  mk("3", "Kestrel Wired Studio Headphones", 119, { brand: "Kestrel", category: "Headphones" }),
  mk("4", "Cafea Boabe Aroma 1kg", 24.5, { category: "Coffee", description: "Cafea boabe prăjită medie" }),
  mk("5", "Nordvik Aero 14 Laptop", 1049, { category: "Laptops" }),
  mk("6", "Price in USD", 10, { currency: "USD" }),
];

const ids = (r: Product[]) => r.map((p) => p.id);

test("normalize strips diacritics (incl. Romanian comma-below)", () => {
  assert.equal(normalize("Ștefan țară ăâî"), "stefan tara aai");
});

test("all-words match beats partial; title beats description", () => {
  const r = searchProducts(catalog, { query: "aurelia headphones", limit: 10 });
  assert.equal(r[0]!.id, "1");
});

test("diacritics-insensitive and prefix matching", () => {
  assert.deepEqual(ids(searchProducts(catalog, { query: "prajita", limit: 5 })), ["4"]);
  assert.deepEqual(ids(searchProducts(catalog, { query: "lapt", limit: 5 })), ["5"]);
});

test("falls back to partial matches when no product has every word", () => {
  const r = searchProducts(catalog, { query: "laptop banana", limit: 5 });
  assert.deepEqual(ids(r), ["5"]);
});

test("price and currency filters; no cross-currency conversion", () => {
  const r = searchProducts(catalog, { query: "headphones", maxPrice: 150, currency: "eur", limit: 10 });
  assert.deepEqual(ids(r).sort(), ["2", "3"]);
  assert.deepEqual(ids(searchProducts(catalog, { query: "price", currency: "USD", limit: 5 })), ["6"]);
});

test("sort by price and limit", () => {
  const r = searchProducts(catalog, { query: "headphones", sort: "price_asc", limit: 2 });
  assert.deepEqual(ids(r), ["2", "3"]);
});

test("empty query with filters lists by filter", () => {
  const r = searchProducts(catalog, { query: "", maxPrice: 30, limit: 10 });
  assert.deepEqual(ids(r).sort(), ["4", "6"]);
});
