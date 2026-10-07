/**
 * Validate your config and feeds before connecting them to an assistant:
 *
 *   DEALFINDER_CONFIG=$PWD/dealfinder.config.json npm run check
 *
 * Loads every feed, reports counts, field coverage, price range and sample links,
 * and flags mistakes that would produce untracked links. Exit code 1 if a feed fails.
 */
import { checkConfig, formatReport, isHealthy } from "../src/check.js";
import { loadConfig } from "../src/config.js";

async function main() {
  const { config, baseDir, origin, demo } = await loadConfig();
  console.log(`Config: ${origin}${demo ? " — set DEALFINDER_CONFIG to check your own feeds" : ""}\n`);
  const reports = await checkConfig(config, baseDir);
  console.log(formatReport(reports));
  process.exit(isHealthy(reports) ? 0 : 1);
}

main().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
