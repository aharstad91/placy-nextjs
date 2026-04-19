/**
 * SSRF-safe URL-resolver for Gemini grounding redirect-URLer.
 *
 * Gemini returnerer alle kilder som `vertexaisearch.cloud.google.com/grounding-
 * api-redirect/...`-URLer. Vi må følge dem for å vise riktig domene-pill
 * (f.eks. "trondheim.kommune.no") i sheet-drawer.
 *
 * Sikkerhet:
 * - DNS pre-resolve (ALLE adresser) før fetch — hindrer rebinding
 * - Blokkerer private/reserved IP-rekker via ipaddr.js `range()`
 * - Manuell redirect-følging, max 3 hops
 * - Per-hop DNS + range-sjekk (hindrer redirect inn i intranett)
 * - Final URL må være https
 * - Hard timeout per hop (default 2s)
 */

import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";
import pLimit from "p-limit";

interface ResolveOptions {
  timeoutMs?: number;
  maxHops?: number;
}

export interface ResolvedUrl {
  url: string;
  domain: string;
  redirectUrl: string;
}

/** Load-balancer for per-IP-range-sjekker. Kun `"unicast"` er trygt. */
function isUnsafeIp(ip: string): boolean {
  try {
    const parsed = ipaddr.parse(ip);
    return parsed.range() !== "unicast";
  } catch {
    return true;
  }
}

function normalizeHostname(hostname: string): string {
  // IPv6 URL-hostnames er "[::1]" — strip brackets for ipaddr.js.
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return hostname.slice(1, -1);
  }
  return hostname;
}

async function assertPublicHost(rawHostname: string): Promise<void> {
  const hostname = normalizeHostname(rawHostname);
  if (ipaddr.isValid(hostname)) {
    if (isUnsafeIp(hostname)) {
      throw new Error(`SSRF blocked: direct unsafe IP ${hostname}`);
    }
    return;
  }
  let addrs: Array<{ address: string; family: number }>;
  try {
    addrs = await dns.lookup(hostname, { all: true });
  } catch (err) {
    throw new Error(
      `DNS lookup failed for ${hostname}: ${(err as Error).message}`,
    );
  }
  if (addrs.length === 0) {
    throw new Error(`DNS returned no addresses for ${hostname}`);
  }
  for (const a of addrs) {
    if (isUnsafeIp(a.address)) {
      throw new Error(
        `SSRF blocked: ${hostname} resolves to unsafe IP ${a.address}`,
      );
    }
  }
}

export async function resolveUrl(
  redirectUrl: string,
  options: ResolveOptions = {},
): Promise<ResolvedUrl> {
  const timeoutMs = options.timeoutMs ?? 2000;
  const maxHops = options.maxHops ?? 3;
  let currentUrl = redirectUrl;

  for (let hop = 0; hop <= maxHops; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      throw new Error(`Invalid URL: ${currentUrl}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Non-http(s) URL blocked: ${parsed.protocol}`);
    }

    await assertPublicHost(parsed.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "Placy-Grounding/1.0",
          Accept: "text/html,*/*;q=0.8",
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        throw new Error(`Redirect ${res.status} without Location header`);
      }
      currentUrl = new URL(loc, currentUrl).toString();
      continue;
    }

    if (parsed.protocol !== "https:") {
      throw new Error(`Final URL not https: ${currentUrl}`);
    }

    return {
      url: currentUrl,
      domain: parsed.hostname.replace(/^www\./, ""),
      redirectUrl,
    };
  }

  throw new Error(`Too many redirects (>${maxHops}) for ${redirectUrl}`);
}

export async function resolveUrlsParallel(
  urls: string[],
  options: { concurrency?: number } & ResolveOptions = {},
): Promise<Array<{ input: string; result: ResolvedUrl | Error }>> {
  const concurrency = options.concurrency ?? 5;
  const limit = pLimit(concurrency);
  return Promise.all(
    urls.map((u) =>
      limit(async () => {
        try {
          return { input: u, result: await resolveUrl(u, options) };
        } catch (err) {
          return { input: u, result: err as Error };
        }
      }),
    ),
  );
}

// Export helpers for tests.
export const __internal = { isUnsafeIp, assertPublicHost };
