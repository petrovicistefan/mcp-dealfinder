import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkConfig, formatReport, isHealthy } from "../src/check.js";
import { ConfigSchema, demoConfig } from "../src/config.js";

const examples = new URL("../examples/", import.meta.url).pathname;

test("demo config is healthy: 20 products, sample links tracked", async () => {
  const reports = await checkConfig(demoConfig(), examples);
  assert.equal(isHealthy(reports), true);
  const [r] = reports;
  assert.equal(r!.products, 20);
  assert.equal(r!.samples.length, 3);
  assert.ok(r!.samples.every((s) => s.tracked));
  assert.equal(r!.coverage.brand, 1);
  assert.match(formatReport(reports), /All feeds OK/);
});

const base = {
  merchant: "M",
  currency: "EUR",
  format: "csv",
  map: { id: "sku", title: "name", price: "price", url: "link" },
} as const;

test("reports a missing file and a wrong column mapping without throwing", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "df-check-"));
  await writeFile(path.join(dir, "f.csv"), "sku,name,price,link\n1,A,5,https://x.test/1\n");
  await writeFile(path.join(dir, "wrong.csv"), "id,title,cost,url\n1,A,5,https://x.test/1\n");
  const config = ConfigSchema.parse({
    networks: {},
    feeds: [
      { ...base, id: "ok", network: "n", source: "f.csv" },
      { ...base, id: "missing", network: "n", source: "nope.csv" },
      { ...base, id: "wrongmap", network: "n", source: "wrong.csv" },
    ],
  });
  const reports = await checkConfig(config, dir);
  const by = Object.fromEntries(reports.map((r) => [r.id, r]));
  assert.equal(by.ok!.error, null);
  assert.match(by.missing!.error!, /ENOENT/);
  assert.match(by.wrongmap!.error!, /could be mapped/);
  assert.equal(isHealthy(reports), false);
  assert.match(formatReport(reports), /2 of 3 feed\(s\) need attention/);
});

test("warns about an undefined network and an Awin feed without merchantId", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "df-check-"));
  await writeFile(path.join(dir, "f.csv"), "sku,name,price,link\n1,A,5,https://x.test/1\n");
  const config = ConfigSchema.parse({
    networks: { awin: { kind: "awin", affiliateId: "1" } },
    feeds: [
      { ...base, id: "a", network: "ghost", source: "f.csv" },
      { ...base, id: "b", network: "awin", source: "f.csv" },
    ],
  });
  const [a, b] = await checkConfig(config, dir);
  assert.match(a!.warnings.join(" "), /not defined under "networks"/);
  assert.equal(a!.samples[0]!.tracked, false);
  assert.match(b!.warnings.join(" "), /merchantId/);
  assert.equal(b!.samples[0]!.tracked, false);
  assert.match(b!.samples[0]!.reason!, /merchantId/);
});

test("warns when prices parse as 0", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "df-check-"));
  await writeFile(path.join(dir, "f.csv"), "sku,name,price,link\n1,A,0,https://x.test/1\n2,B,9,https://x.test/2\n");
  const config = ConfigSchema.parse({ feeds: [{ ...base, id: "z", network: "n", source: "f.csv" }] });
  const [r] = await checkConfig(config, dir);
  assert.match(r!.warnings.join(" "), /1 product\(s\) have price 0/);
});
