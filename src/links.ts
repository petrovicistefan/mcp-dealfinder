import type { NetworkConfig } from "./config.js";

export const DISCLOSURE =
  "Affiliate link: if you buy through it, the publisher may earn a commission at no extra cost to you.";

export interface LinkContext {
  /** Merchant id some networks need (Awin `awinmid`). */
  merchantId?: string;
  /** Merchant-level template values. */
  params?: Record<string, string>;
  subId?: string;
}

export interface TrackedUrl {
  url: string;
  tracked: boolean;
  /** Why the link is untracked. */
  reason?: string;
}

const AMAZON_HOST = /(^|\.)amazon\.[a-z]{2,3}(\.[a-z]{2})?$/i;

const enc = encodeURIComponent;

/** Keeps sub-ids safe for every network: letters, digits, `_` and `-`, max 50 chars. */
export function sanitizeSubId(raw?: string): string | undefined {
  if (!raw) return undefined;
  const s = raw.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 50);
  return s === "" ? undefined : s;
}

function untracked(url: string, reason: string): TrackedUrl {
  return { url, tracked: false, reason };
}

export function buildTrackedUrl(
  rawUrl: string,
  net: NetworkConfig | undefined,
  ctx: LinkContext = {},
): TrackedUrl {
  if (!net) return untracked(rawUrl, "no affiliate account configured for this network");
  const subId = sanitizeSubId(ctx.subId);

  switch (net.kind) {
    case "amazon": {
      let u: URL;
      try {
        u = new URL(rawUrl);
      } catch {
        return untracked(rawUrl, "invalid product URL");
      }
      if (!AMAZON_HOST.test(u.hostname)) return untracked(rawUrl, "not an Amazon URL");
      u.searchParams.set("tag", net.tag);
      if (subId) u.searchParams.set("ascsubtag", subId);
      return { url: u.toString(), tracked: true };
    }

    case "awin": {
      if (!ctx.merchantId) return untracked(rawUrl, "feed has no merchantId (Awin awinmid)");
      let url = `https://www.awin1.com/cread.php?awinmid=${enc(ctx.merchantId)}&awinaffid=${enc(net.affiliateId)}&ued=${enc(rawUrl)}`;
      if (subId) url += `&clickref=${enc(subId)}`;
      return { url, tracked: true };
    }

    case "template": {
      // url/urlEncoded/subId are applied last so params can never override them.
      const values: Record<string, string> = {
        ...net.params,
        ...ctx.params,
        url: rawUrl,
        urlEncoded: enc(rawUrl),
        subId: subId ?? "",
      };
      let missing: string | undefined;
      const out = net.template.replace(/\{(\w+)\}/g, (_m, key: string) => {
        const v = values[key];
        if (v === undefined) {
          missing ??= key;
          return "";
        }
        return v;
      });
      if (missing) return untracked(rawUrl, `template placeholder {${missing}} has no value`);
      try {
        const u = new URL(out);
        if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("protocol");
      } catch {
        return untracked(rawUrl, "template did not produce a valid http(s) URL");
      }
      return { url: out, tracked: true };
    }
  }
}
