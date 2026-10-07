/**
 * Connect ANY affiliate network from one generated link:
 *
 *   npm run link-template -- --link "<link from the network's link generator>" \
 *                            --url  "<the product URL you pasted into that generator>" \
 *                            [--name mynetwork]
 *
 * Prints the `networks` entry for dealfinder.config.json and verifies it by rebuilding your link.
 * The link contains only your public IDs, never API keys.
 */
import { deriveTemplate } from "../src/link-template.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const link = arg("link");
const url = arg("url");
const name = arg("name") ?? "mynetwork";

if (!link || !url) {
  console.error('usage: npm run link-template -- --link "<generated link>" --url "<product URL you used>" [--name mynetwork]');
  process.exit(2);
}

const r = deriveTemplate(link, url);
if (!r.ok || !r.template) {
  for (const n of r.notes) console.error(`✗ ${n}`);
  process.exit(1);
}

console.log(`Round trip: ${r.roundTrip} (rebuilt your link from the product URL)\n`);
console.log('Add under "networks" in dealfinder.config.json:\n');
console.log(JSON.stringify({ [name]: { kind: "template", template: r.template, params: r.params } }, null, 2).slice(2, -2));
console.log(`\nThen set "network": "${name}" on the feeds from this network.`);
if (r.notes.length > 0) console.log("\nNotes:\n" + r.notes.map((n) => `  - ${n}`).join("\n"));
