import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTrackedUrl, sanitizeSubId } from "../src/links.js";

test("amazon: sets tag and ascsubtag, replaces an existing tag", () => {
  const r = buildTrackedUrl(
    "https://www.amazon.de/dp/B000TEST?tag=someone-else&th=1",
    { kind: "amazon", tag: "mine-21" },
    { subId: "post_1" },
  );
  assert.equal(r.tracked, true);
  const u = new URL(r.url);
  assert.equal(u.searchParams.get("tag"), "mine-21");
  assert.equal(u.searchParams.get("ascsubtag"), "post_1");
  assert.equal(u.searchParams.get("th"), "1");
});

test("amazon: refuses look-alike hosts and non-amazon URLs", () => {
  const net = { kind: "amazon", tag: "mine-21" } as const;
  assert.equal(buildTrackedUrl("https://amazon.com.evil.io/dp/X", net).tracked, false);
  assert.equal(buildTrackedUrl("https://notamazon.com/dp/X", net).tracked, false);
  assert.equal(buildTrackedUrl("https://shop.example.com/p/1", net).tracked, false);
  assert.equal(buildTrackedUrl("https://www.amazon.co.uk/dp/X", net).tracked, true);
});

test("awin: exact deep link, clickref only with a sub id", () => {
  const net = { kind: "awin", affiliateId: "111" } as const;
  const r = buildTrackedUrl("https://shop.example.com/p/1?a=b&c=d", net, { merchantId: "222", subId: "x1" });
  assert.equal(
    r.url,
    "https://www.awin1.com/cread.php?awinmid=222&awinaffid=111&ued=https%3A%2F%2Fshop.example.com%2Fp%2F1%3Fa%3Db%26c%3Dd&clickref=x1",
  );
  assert.ok(!buildTrackedUrl("https://shop.example.com/p/1", net, { merchantId: "222" }).url.includes("clickref"));
});

test("awin: untracked without merchantId", () => {
  const r = buildTrackedUrl("https://shop.example.com/p/1", { kind: "awin", affiliateId: "1" });
  assert.equal(r.tracked, false);
  assert.equal(r.url, "https://shop.example.com/p/1");
  assert.match(r.reason!, /merchantId/);
});

test("template: merges network and feed params; url placeholders cannot be overridden", () => {
  const net = {
    kind: "template",
    template: "https://t.example.net/c?aff={affId}&camp={campaignId}&sub={subId}&to={urlEncoded}&raw={url}",
    params: { affId: "A1", url: "hijack" },
  } as const;
  const r = buildTrackedUrl("https://shop.example.com/p?x=1", net, { params: { campaignId: "42" }, subId: "s" });
  assert.equal(r.tracked, true);
  const u = new URL(r.url);
  assert.equal(u.searchParams.get("aff"), "A1");
  assert.equal(u.searchParams.get("camp"), "42");
  assert.equal(u.searchParams.get("sub"), "s");
  assert.equal(u.searchParams.get("to"), "https://shop.example.com/p?x=1");
});

test("template: unknown placeholder or non-http result is untracked, never a broken link", () => {
  const missing = buildTrackedUrl(
    "https://shop.example.com/p",
    { kind: "template", template: "https://t.example.net/?c={nope}", params: {} },
  );
  assert.equal(missing.tracked, false);
  assert.equal(missing.url, "https://shop.example.com/p");

  const bad = buildTrackedUrl(
    "https://shop.example.com/p",
    { kind: "template", template: "javascript:alert({urlEncoded})", params: {} },
  );
  assert.equal(bad.tracked, false);
});

test("no network config -> plain url, untracked", () => {
  const r = buildTrackedUrl("https://shop.example.com/p", undefined);
  assert.deepEqual([r.url, r.tracked], ["https://shop.example.com/p", false]);
});

test("sanitizeSubId strips unsafe characters and caps length", () => {
  assert.equal(sanitizeSubId("a b&c=d/../é"), "abcd");
  assert.equal(sanitizeSubId("&&&"), undefined);
  assert.equal(sanitizeSubId("x".repeat(80))!.length, 50);
});
