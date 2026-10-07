import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveTemplate } from "../src/link-template.js";

// Shaped like a real 2Performant quicklink (destination left unencoded by the network); values are invented.
const REAL_2P =
  "https://event.2performant.com/events/click?ad_type=quicklink&aff_code=abc123def&unique=1234560&redirect_to=https://www.example.com";

test("2Performant-shaped sample: IDs extracted, destination encoded, round trip equivalent", () => {
  const r = deriveTemplate(REAL_2P, "https://www.example.com");
  assert.equal(r.ok, true);
  assert.equal(
    r.template,
    "https://event.2performant.com/events/click?ad_type=quicklink&aff_code={aff_code}&unique={unique}&redirect_to={urlEncoded}",
  );
  assert.deepEqual(r.params, { aff_code: "abc123def", unique: "1234560" });
  assert.equal(r.roundTrip, "equivalent");
  assert.match(r.notes.join(" "), /left the destination unencoded/);
});

test("the derived 2Performant template survives a URL containing ? & #", async () => {
  const { buildTrackedUrl } = await import("../src/links.js");
  const r = deriveTemplate(REAL_2P, "https://www.example.com");
  const built = buildTrackedUrl("https://shop.example.com/p/9?color=red&size=m#x", {
    kind: "template",
    template: r.template!,
    params: r.params,
  });
  assert.equal(new URL(built.url).searchParams.get("redirect_to"), "https://shop.example.com/p/9?color=red&size=m#x");
  assert.equal(new URL(built.url).searchParams.get("aff_code"), "abc123def");
});

// SYNTHETIC samples (format-shaped, invented values) to cover other generator styles.
test("encoded destination (Awin-shaped): exact round trip, suggests the built-in kind", () => {
  const sample =
    "https://www.awin1.com/cread.php?awinmid=1234&awinaffid=5550123&ued=https%3A%2F%2Fshop.example.com%2Fp%2F1%3Fa%3Db";
  const r = deriveTemplate(sample, "https://shop.example.com/p/1?a=b");
  assert.equal(r.ok, true);
  assert.equal(r.roundTrip, "exact");
  assert.match(r.notes.join(" "), /built-in kind/);
});

test("tracking-label params become {subId}; campaign id extracted (eBay-shaped)", () => {
  const sample =
    "https://rover.ebay.com/rover/1/711-53200-19255-0/1?mpre=https%3A%2F%2Fwww.ebay.com%2Fitm%2F123&campid=5338123456&customid=&toolid=10001";
  const r = deriveTemplate(sample, "https://www.ebay.com/itm/123");
  assert.equal(r.ok, true);
  assert.equal(r.roundTrip, "exact");
  assert.match(r.template!, /customid=\{subId\}/);
  assert.deepEqual(r.params, { campid: "5338123456", toolid: "10001" });
});

test("trailing-slash normalisation by the generator is found", () => {
  const sample = "https://t.example.net/c?aff=A12345&to=https%3A%2F%2Fwww.example.com%2F";
  const r = deriveTemplate(sample, "https://www.example.com");
  assert.equal(r.ok, true);
  assert.equal(r.params.aff, "A12345");
});

test("an ID inside the path stays literal and is flagged", () => {
  const sample = "https://l.example.ro/l/1234567?redirect=https%3A%2F%2Fshop.example.com%2Fp%2F1";
  const r = deriveTemplate(sample, "https://shop.example.com/p/1");
  assert.equal(r.ok, true);
  assert.match(r.template!, /^https:\/\/l\.example\.ro\/l\/1234567\?redirect=\{urlEncoded\}$/);
  assert.match(r.notes.join(" "), /inside the link path/);
});

test("product URL absent from the link, or invalid input, fails with a clear message", () => {
  const a = deriveTemplate("https://t.example.net/c?aff=A12345&to=https%3A%2F%2Fother.com", "https://www.example.com");
  assert.equal(a.ok, false);
  assert.match(a.notes[0]!, /Could not find the product URL/);
  assert.equal(deriveTemplate("not a url", "https://x.com").ok, false);
  assert.equal(deriveTemplate("https://t.example.net/?to=x", "nope").ok, false);
});
