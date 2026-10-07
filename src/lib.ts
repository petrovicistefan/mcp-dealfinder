// Public API for building on top of mcp-dealfinder (extensions, custom servers).
export { startServer, type StartOptions } from "./bootstrap.js";
export {
  createServer,
  createToolkit,
  MAX_RESULTS,
  type PresentedProduct,
  type ServerDeps,
  type ServerOptions,
  type ToolResult,
  type Toolkit,
} from "./server.js";
export {
  ConfigSchema,
  demoConfig,
  loadConfig,
  type Config,
  type FeedConfig,
  type LoadedConfig,
  type NetworkConfig,
} from "./config.js";
export { FeedStore, loadFeed, parseCsv, parsePrice, type FeedStatus } from "./feeds.js";
export { searchProducts, type SearchOptions } from "./search.js";
export { DISCLOSURE, buildTrackedUrl, sanitizeSubId, type LinkContext, type TrackedUrl } from "./links.js";
export { deriveTemplate, type DerivedTemplate } from "./link-template.js";
export { checkConfig, formatReport, isHealthy, type FeedReport } from "./check.js";
export { productRef, type Product } from "./types.js";
// Re-exported so extensions use the same zod / SDK instances as the core.
export { z } from "zod";
export type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
