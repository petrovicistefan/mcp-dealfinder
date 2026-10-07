import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { FeedSchema } from "../src/config.js";
import { FeedStore, loadFeed, parseCsv, parsePrice } from "../src/feeds.js";

test("parseCsv: quotes, escaped quotes, embedded newlines, CRLF, BOM", () => {
  const rows = parseCsv('﻿a,b,c\r\n1,"x, y","say ""hi"""\r\n2,"line1\nline2",z\r\n');
  assert.deepEqual(rows, [
    ["a", "b", "c"],
    ["1", "x, y", 'say "hi"'],
    ["2", "line1\nline2", "z"],
  ]);
});

test("parsePrice handles real-world formats", () => {
  const cases: [string | number, number | undefined][] = [
    ["19.99", 19.99],
    ["19,99", 19.99],
    ["1.299,99", 1299.99],
    ["1,299.99", 1299.99],
    ["1.299", 1299],
    ["1,299", 1299],
    ["12,5", 12.5],
    ["0.125", 0.125],
    ["1.234.567", 1234567],
    ["19.99 EUR", 19.99],
    ["€ 24,50", 24.5],
    ["249", 249],
    [12.5, 12.5],
    ["free", undefined],
    ["", undefined],
    ["-5", undefined],
    [Number.NaN, undefined],
  ];
  for (const [input, want] of cases) assert.equal(parsePrice(input), want, `parsePrice(${JSON.stringify(input)})`);
});

const baseFeed = {
  id: "t",
  network: "n",
  merchant: "M",
  currency: "EUR",
  map: { id: "sku", title: "name", price: "price", url: "link", currency: "cur" },
} as const;

test("loadFeed: csv mapping, skips invalid rows and duplicate ids, normalises currency", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "df-"));
  await writeFile(
    path.join(dir, "f.csv"),
    [
      "sku,name,price,link,cur",
      "1,Good,10.5,https://x.test/1,usd",
      "1,Duplicate id,11,https://x.test/1b,usd",
      "2,No price,,https://x.test/2,usd",
      "3,Bad url,5,ftp://x.test/3,usd",
      "4,Default currency,7,https://x.test/4,",
    ].join("\n"),
  );
  const feed = FeedSchema.parse({ ...baseFeed, source: "f.csv", format: "csv" });
  const products = await loadFeed(feed, dir);
  assert.deepEqual(
    products.map((p) => [p.id, p.price, p.currency]),
    [
      ["1", 10.5, "USD"],
      ["4", 7, "EUR"],
    ],
  );
});

test("loadFeed: json with jsonPath and dotted field paths; gzip detected by magic bytes", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "df-"));
  const data = { products: [{ sku: "a", name: "A", link: "https://x.test/a", price: { amount: "9,90" } }] };
  await writeFile(path.join(dir, "f.json.gz"), gzipSync(JSON.stringify(data)));
  const feed = FeedSchema.parse({
    ...baseFeed,
    source: "f.json.gz",
    format: "json",
    jsonPath: "products",
    map: { id: "sku", title: "name", url: "link", price: "price.amount" },
  });
  const [p] = await loadFeed(feed, dir);
  assert.equal(p!.price, 9.9);
});

test("loadFeed: unmappable feed fails loudly instead of loading nothing silently", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "df-"));
  await writeFile(path.join(dir, "f.csv"), "a,b\n1,2\n3,4\n");
  const feed = FeedSchema.parse({ ...baseFeed, source: "f.csv", format: "csv" });
  await assert.rejects(loadFeed(feed, dir), /could be mapped/);
});

test("FeedStore: one failing feed does not break the others, error is reported", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "df-"));
  await writeFile(path.join(dir, "ok.csv"), "sku,name,price,link\n1,A,1,https://x.test/1\n");
  const ok = FeedSchema.parse({ ...baseFeed, id: "ok", source: "ok.csv", format: "csv" });
  const broken = FeedSchema.parse({ ...baseFeed, id: "broken", source: "missing.csv", format: "csv" });
  const store = new FeedStore([ok, broken], dir, 3_600_000);
  await store.load();
  assert.equal(store.get("ok:1")?.title, "A");
  const status = Object.fromEntries(store.status().map((s) => [s.id, s]));
  assert.equal(status.ok!.error, null);
  assert.match(status.broken!.error!, /ENOENT/);
});
