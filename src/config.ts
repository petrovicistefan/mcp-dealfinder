import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const FeedMapSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: z.string(),
  url: z.string(),
  currency: z.string().optional(),
  imageUrl: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
});

export const FeedSchema = z.object({
  id: z.string().min(1),
  /** Key into `networks`. */
  network: z.string().min(1),
  merchant: z.string().min(1),
  /** Local file path (relative to the config file) or http(s) URL. `.gz` is handled. */
  source: z.string().min(1),
  format: z.enum(["csv", "json"]),
  delimiter: z.string().length(1).optional(),
  /** Used when the feed has no currency column. */
  currency: z.string().length(3).default("USD"),
  /** JSON only: dotted path to the array of products. Omit if the root is the array. */
  jsonPath: z.string().optional(),
  /** Merchant-level id some networks need (e.g. Awin `awinmid`). */
  merchantId: z.string().optional(),
  /** Merchant-level values for `template` networks (e.g. campaign id). */
  params: z.record(z.string(), z.string()).optional(),
  map: FeedMapSchema,
});

export const NetworkSchema = z.discriminatedUnion("kind", [
  /** Adds `?tag=` (and `ascsubtag`) to amazon.* product URLs. */
  z.object({ kind: z.literal("amazon"), tag: z.string().min(1) }),
  /** https://www.awin1.com/cread.php deep link. Needs `merchantId` on the feed. */
  z.object({ kind: z.literal("awin"), affiliateId: z.string().min(1) }),
  /**
   * Any other network: copy the deep-link format from the network's own link
   * builder and replace the destination with `{urlEncoded}`. Placeholders:
   * `{url}`, `{urlEncoded}`, `{subId}` and any key from `params`.
   */
  z.object({
    kind: z.literal("template"),
    template: z.string().min(1),
    params: z.record(z.string(), z.string()).default({}),
  }),
]);

export const ConfigSchema = z.object({
  networks: z.record(z.string(), NetworkSchema).default({}),
  feeds: z.array(FeedSchema).min(1),
  refreshHours: z.number().positive().default(6),
});

export type FeedConfig = z.infer<typeof FeedSchema>;
export type NetworkConfig = z.infer<typeof NetworkSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export interface LoadedConfig {
  config: Config;
  /** Relative feed sources resolve against this directory. */
  baseDir: string;
  /** Human-readable origin of the config. */
  origin: string;
  demo: boolean;
}

const examplesDir = fileURLToPath(new URL("../examples/", import.meta.url));

export function demoConfig(): Config {
  return ConfigSchema.parse({
    networks: {
      demo: {
        kind: "template",
        template: "https://example.com/go?u={urlEncoded}&aff={affId}&sub={subId}",
        params: { affId: "demo" },
      },
    },
    feeds: [
      {
        id: "demo",
        network: "demo",
        merchant: "Demo Store (fictional)",
        source: "feeds/demo.csv",
        format: "csv",
        currency: "EUR",
        map: {
          id: "sku",
          title: "name",
          price: "price",
          url: "deep_link",
          currency: "currency",
          imageUrl: "image",
          brand: "brand",
          category: "category",
          description: "description",
        },
      },
    ],
  });
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await readFile(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Order: explicit path / DEALFINDER_CONFIG, then ./dealfinder.config.json,
 * then the built-in demo (fictional products) so a first run works with zero setup.
 */
export async function loadConfig(explicitPath?: string): Promise<LoadedConfig> {
  const candidate =
    explicitPath ?? process.env.DEALFINDER_CONFIG ?? path.resolve("dealfinder.config.json");
  const isExplicit = explicitPath !== undefined || process.env.DEALFINDER_CONFIG !== undefined;

  if (!isExplicit && !(await fileExists(candidate))) {
    return { config: demoConfig(), baseDir: examplesDir, origin: "built-in demo", demo: true };
  }

  const abs = path.resolve(candidate);
  let raw: string;
  try {
    raw = await readFile(abs, "utf8");
  } catch (err) {
    throw new Error(`Cannot read config file ${abs}: ${(err as Error).message}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Config file ${abs} is not valid JSON: ${(err as Error).message}`);
  }
  const parsed = ConfigSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid config ${abs}:\n${issues}`);
  }
  const unknownNetworks = parsed.data.feeds
    .map((f) => f.network)
    .filter((n) => !(n in parsed.data.networks));
  if (unknownNetworks.length > 0) {
    // Not fatal: the feed still works, its links are just untracked. Surfaced in the status tool.
    console.error(
      `[dealfinder] warning: feeds reference networks missing from "networks": ${[...new Set(unknownNetworks)].join(", ")}`,
    );
  }
  return { config: parsed.data, baseDir: path.dirname(abs), origin: abs, demo: false };
}
