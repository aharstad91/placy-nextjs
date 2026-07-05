// Per-IP in-memory rate-limiter (fixed window) for uautentiserte API-ruter.
// Audit-fiks 2026-07-05 (DECISIONS-QUEUE #2): proxyene mot betalte oppstrøms-API-er
// (Mapbox Directions/Matrix koster per kall) var åpne uten grense — hvem som helst
// kunne bruke Placys kvote. In-memory er bevisst (prototype-stadium): grensen er
// kvote-vern mot enkel misbruk, ikke en distribuert garanti på tvers av instanser.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Rullerende-IP-misbruk skal ikke kunne vokse mappen ubegrenset:
// ved taket sveipes utløpte entries før ny IP registreres.
const MAX_TRACKED_IPS = 10_000;

export interface RateLimiter {
  /** true = forespørselen er innenfor grensen, false = avvis med 429. */
  check(ip: string): boolean;
}

export function createRateLimiter(opts: {
  limit: number;
  windowMs: number;
}): RateLimiter {
  const entries = new Map<string, RateLimitEntry>();

  return {
    check(ip: string): boolean {
      const now = Date.now();

      if (entries.size >= MAX_TRACKED_IPS && !entries.has(ip)) {
        entries.forEach((entry, key) => {
          if (now >= entry.resetAt) entries.delete(key);
        });
      }

      const entry = entries.get(ip);
      if (!entry || now >= entry.resetAt) {
        entries.set(ip, { count: 1, resetAt: now + opts.windowMs });
        return true;
      }
      if (entry.count >= opts.limit) {
        return false;
      }
      entry.count++;
      return true;
    },
  };
}

/** Klient-IP fra proxy-headeren (første hop); "unknown" som felles fallback-bøtte. */
export function getClientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
