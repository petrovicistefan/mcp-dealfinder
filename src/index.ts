#!/usr/bin/env node
import { startServer } from "./bootstrap.js";

startServer().catch((err) => {
  console.error(`[dealfinder] fatal: ${(err as Error).message}`);
  process.exit(1);
});
