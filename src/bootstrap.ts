import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { FeedStore } from "./feeds.js";
import { createServer, type ServerOptions } from "./server.js";

export interface StartOptions extends ServerOptions {
  /** Where human-readable progress goes. Defaults to stderr: stdout belongs to the MCP protocol. */
  log?: (message: string) => void;
}

/** Loads the config and feeds, builds the server and serves it over stdio. */
export async function startServer(options: StartOptions = {}): Promise<void> {
  const log = options.log ?? ((m: string) => console.error(`[dealfinder] ${m}`));
  const { config, baseDir, origin, demo } = await loadConfig();

  const store = new FeedStore(config.feeds, baseDir, config.refreshHours * 3_600_000);
  await store.load();
  for (const f of store.status()) {
    log(f.error ? `feed ${f.id}: ERROR ${f.error}` : `feed ${f.id}: ${f.products} products`);
  }
  log(`config: ${origin}${demo ? " (demo data — set DEALFINDER_CONFIG for real feeds)" : ""}`);

  const server = createServer(
    { store, networks: config.networks, configOrigin: origin, demo },
    options,
  );
  await server.connect(new StdioServerTransport());
}
