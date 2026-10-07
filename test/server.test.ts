import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { demoConfig } from "../src/config.js";
import type { NetworkConfig } from "../src/config.js";
import { FeedStore } from "../src/feeds.js";
import { createServer, type ServerOptions } from "../src/server.js";
import { z } from "zod";

const examples = new URL("../examples/", import.meta.url).pathname;

const NETWORKS: Record<string, NetworkConfig> = {
  demo: { kind: "template", template: "https://go.test/?aff={affId}&to={urlEncoded}&sub={subId}", params: { affId: "MINE" } },
};

async function connect(networks: Record<string, NetworkConfig> = NETWORKS, options: ServerOptions = {}) {
  const cfg = demoConfig();
  const store = new FeedStore(cfg.feeds, examples, 3_600_000);
  await store.load();
  const server = createServer({ store, networks, configOrigin: "test", demo: true }, options);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(ct);
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const res = (await client.callTool({ name, arguments: args })) as {
    isError?: boolean;
    content: { type: string; text: string }[];
  };
  const text = res.content[0]!.text;
  return { isError: !!res.isError, text, json: () => JSON.parse(text) };
}

test("lists the four built-in tools", async () => {
  const client = await connect();
  const { tools } = await client.listTools();
  assert.deepEqual(
    tools.map((t) => t.name).sort(),
    ["compare_products", "dealfinder_status", "get_buy_link", "search_products"],
  );
});

test("links use the configured account and carry the disclosure and sub_id", async () => {
  const client = await connect();
  const r = (await call(client, "search_products", { query: "headphones", limit: 20, sub_id: "t1" })).json();
  assert.ok(r.count > 0);
  const first = r.results[0];
  assert.equal(first.tracked, true);
  assert.match(first.buy_link, /aff=MINE/);
  assert.match(first.buy_link, /sub=t1/);
  assert.match(first.disclosure, /Affiliate link/);
});

test("up to 20 results per search", async () => {
  const client = await connect();
  const r = (await call(client, "search_products", { query: "laptop headphones coffee shoes backpack", limit: 20 })).json();
  assert.ok(r.count > 5 && r.count <= 20);
});

test("no matching network account: plain merchant link, no disclosure claimed", async () => {
  const client = await connect({});
  const r = (await call(client, "search_products", { query: "laptop" })).json();
  assert.equal(r.results[0].tracked, false);
  assert.match(r.results[0].buy_link, /^https:\/\/shop\.example\.com\/p\//);
  assert.equal(r.results[0].disclosure, undefined);
});

test("search finds the Romanian product regardless of diacritics", async () => {
  const client = await connect();
  const r = (await call(client, "search_products", { query: "prajita cafea" })).json();
  assert.equal(r.results[0].ref, "demo:D009");
});

test("compare_products marks the cheapest; unknown ref is an error", async () => {
  const client = await connect();
  const ok = (await call(client, "compare_products", { refs: ["demo:D004", "demo:D005", "demo:D006"] })).json();
  assert.equal(ok.cheapest_ref, "demo:D005");
  const bad = await call(client, "compare_products", { refs: ["demo:D004", "demo:NOPE"] });
  assert.equal(bad.isError, true);
});

test("get_buy_link returns a link for a known ref", async () => {
  const client = await connect();
  const r = (await call(client, "get_buy_link", { ref: "demo:D001" })).json();
  assert.equal(r.tracked, true);
  assert.match(r.buy_link, /shop\.example\.com%2Fp%2FD001/);
});

test("dealfinder_status reports feeds and tracking", async () => {
  const client = await connect();
  const s = (await call(client, "dealfinder_status")).json();
  assert.equal(s.feeds[0].products, 20);
  assert.equal(s.feeds[0].error, null);
  assert.deepEqual(s.networks_with_tracking, ["demo"]);
  const bare = (await call(await connect({}), "dealfinder_status")).json();
  assert.deepEqual(bare.feeds_without_tracking, ["demo"]);
});

test("extensions can register their own tools through registerExtras and reuse the toolkit", async () => {
  const client = await connect(NETWORKS, {
    name: "dealfinder-ext",
    instructions: "Extension rule.",
    registerExtras: (server, kit) => {
      server.registerTool(
        "ext_cheapest",
        { description: "cheapest of two refs", inputSchema: { refs: z.array(z.string()).length(2) } },
        async ({ refs }) => {
          const { products, missing } = kit.resolveRefs(refs);
          if (missing.length) return kit.fail(`unknown: ${missing.join(",")}`);
          const best = [...products].sort((a, b) => a.price - b.price)[0]!;
          return kit.text(kit.present(best));
        },
      );
    },
  });
  const { tools } = await client.listTools();
  assert.ok(tools.some((t) => t.name === "ext_cheapest"));
  assert.equal(client.getServerVersion()?.name, "dealfinder-ext");
  assert.match(client.getInstructions() ?? "", /Extension rule\./);
  const r = (await call(client, "ext_cheapest", { refs: ["demo:D004", "demo:D005"] })).json();
  assert.equal(r.ref, "demo:D005");
  assert.match(r.buy_link, /aff=MINE/);
});
