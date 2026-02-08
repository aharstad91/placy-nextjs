/**
 * POI Trust Validation — Layer 1+2 heuristic scoring.
 *
 * Pure function: calculateHeuristicTrust() — deterministic scoring from signals
 * Async functions: checkWebsite(), batchValidateTrust() — network I/O
 *
 * Follows poi-score.ts pattern: simple interface in, score out.
 */

import type { POI } from "@/lib/types";

// ============================================
// Types
// ============================================

export type GoogleBusinessStatus = "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";

export type TrustFlag =
  | "permanently_closed"
  | "suspect_no_website_perfect_rating"
  | "no_website"
  | "website_ok"
  | "suspicious_domain"
  | "has_price_level"
  | "high_review_count"
  | "moderate_review_count";

export interface TrustSignals {
  // Layer 1: Google data
  hasWebsite: boolean;
  businessStatus: GoogleBusinessStatus | null;
  hasPriceLevel: boolean;
  googleRating: number | null;
  googleReviewCount: number | null;

  // Layer 2: Website verification
  websiteResponds: boolean | null; // null = not checked
  isSuspiciousDomain: boolean;
}

export interface TrustResult {
  score: number; // 0.0-1.0
  flags: TrustFlag[];
  needsClaudeReview: boolean; // true if score is in 0.3-0.7 range
}

export interface WebsiteCheckResult {
  responds: boolean;
  isSuspicious: boolean;
}

// ============================================
// Constants
// ============================================

const BASE_SCORE = 0.6;

/** Minimum trust score for POIs to appear in Explorer. Exported for use in apply-explorer-caps. */
export const MIN_TRUST_SCORE = 0.5;

const SUSPICIOUS_DOMAINS = [
  ".ntnu.no", ".uio.no", ".uit.no", ".nmbu.no", ".uib.no", // Norske universiteter
  ".edu", ".ac.uk",                                          // Internasjonale universiteter
  ".blogspot.com", ".wordpress.com",                         // Blogg-plattformer (dot-prefixed to avoid myblogspot.com false positive)
];

/** Private/reserved IP ranges that must be blocked for SSRF protection */
const PRIVATE_IP_PATTERNS = [
  /^127\./,                    // Loopback
  /^10\./,                     // Class A private
  /^172\.(1[6-9]|2\d|3[01])\./, // Class B private
  /^192\.168\./,               // Class C private
  /^169\.254\./,               // Link-local
  /^0\./,                      // Current network
  /^::1$/,                     // IPv6 loopback
  /^fc00:/i,                   // IPv6 unique local
  /^fd/i,                      // IPv6 unique local
  /^fe80:/i,                   // IPv6 link-local
];

const WEBSITE_CHECK_TIMEOUT_MS = 3000;
const DEFAULT_BATCH_CONCURRENCY = 10;

// ============================================
// Pure heuristic scoring (Layer 1+2)
// ============================================

/**
 * Calculate heuristic trust score from pre-gathered signals.
 * Pure function — no I/O.
 */
export function calculateHeuristicTrust(signals: TrustSignals): TrustResult {
  const flags: TrustFlag[] = [];

  // Hard fail: permanently closed
  if (signals.businessStatus === "CLOSED_PERMANENTLY") {
    return { score: 0, flags: ["permanently_closed"], needsClaudeReview: false };
  }

  let score = BASE_SCORE;

  // No website + perfect 5.0 + < 100 reviews → strong negative
  if (
    !signals.hasWebsite &&
    signals.googleRating === 5.0 &&
    (signals.googleReviewCount ?? 0) < 100
  ) {
    score -= 0.3;
    flags.push("suspect_no_website_perfect_rating");
  } else if (!signals.hasWebsite) {
    // No website alone → moderate negative
    score -= 0.15;
    flags.push("no_website");
  }

  // Website responds
  if (signals.websiteResponds === true) {
    score += 0.1;
    flags.push("website_ok");
  }

  // Suspicious domain
  if (signals.isSuspiciousDomain) {
    score -= 0.3;
    flags.push("suspicious_domain");
  }

  // Price level set
  if (signals.hasPriceLevel) {
    score += 0.05;
    flags.push("has_price_level");
  }

  // Business status operational
  if (signals.businessStatus === "OPERATIONAL") {
    score += 0.05;
  }

  // Review count tiers
  if ((signals.googleReviewCount ?? 0) >= 200) {
    score += 0.2; // 0.1 for >=50 + 0.1 extra for >=200
    flags.push("high_review_count");
  } else if ((signals.googleReviewCount ?? 0) >= 50) {
    score += 0.1;
    flags.push("moderate_review_count");
  }

  // Clamp to 0.0–1.0
  score = Math.max(0, Math.min(1, score));

  return {
    score: Math.round(score * 100) / 100, // 2 decimal places
    flags,
    needsClaudeReview: score >= 0.3 && score <= 0.7,
  };
}

// ============================================
// SSRF Protection
// ============================================

type UrlValidation =
  | { safe: true }
  | { safe: false; reason: string };

/**
 * Validate that a URL is safe for server-side requests.
 * Blocks private IPs, non-http protocols, bare IP addresses, localhost, and metadata endpoints.
 */
export function validateExternalUrl(rawUrl: string): UrlValidation {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, reason: "invalid_url" };
  }

  // Only http/https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: "invalid_protocol" };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost
  if (hostname === "localhost" || hostname === "0.0.0.0") {
    return { safe: false, reason: "localhost" };
  }

  // Block cloud metadata endpoints
  if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
    return { safe: false, reason: "metadata_endpoint" };
  }

  // Block bare IP addresses (require FQDN)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    // IPv4 — check if private
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { safe: false, reason: "private_ip" };
      }
    }
    // Even public IPs are suspicious for a business website
    return { safe: false, reason: "bare_ip" };
  }

  // Block IPv6 addresses
  if (hostname.startsWith("[") || hostname.includes(":")) {
    return { safe: false, reason: "ipv6_address" };
  }

  // Require at least one dot (FQDN)
  if (!hostname.includes(".")) {
    return { safe: false, reason: "not_fqdn" };
  }

  return { safe: true };
}

// ============================================
// Suspicious domain check
// ============================================

/**
 * Check if a URL belongs to a suspicious domain (universities, blog platforms).
 */
export function isSuspiciousDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return SUSPICIOUS_DOMAINS.some((domain) => {
      // All domains are dot-prefixed, so endsWith is exact segment match
      return hostname.endsWith(domain) || hostname === domain.slice(1);
    });
  } catch {
    return false;
  }
}

// ============================================
// Website check (Layer 2)
// ============================================

/**
 * Check if a website URL responds. Uses HTTP HEAD with 3s timeout.
 * Includes SSRF protection — blocks private IPs and non-http protocols.
 * Uses redirect: "manual" to prevent TOCTOU redirect attacks.
 */
export async function checkWebsite(url: string): Promise<WebsiteCheckResult> {
  // SSRF check
  const validation = validateExternalUrl(url);
  if (!validation.safe) {
    return { responds: false, isSuspicious: false };
  }

  const suspicious = isSuspiciousDomain(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBSITE_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "manual", // Prevent redirect TOCTOU — validate each hop
    });

    // If redirect, validate the target URL for SSRF
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      const redirectValidation = validateExternalUrl(location);
      if (!redirectValidation.safe) {
        return { responds: false, isSuspicious: suspicious };
      }
      // Redirect target is safe — treat as responds (don't follow)
      return {
        responds: true,
        isSuspicious: suspicious || isSuspiciousDomain(location),
      };
    }

    const responds = response.status >= 200 && response.status < 400;
    return { responds, isSuspicious: suspicious };
  } catch {
    // Timeout or network error — neutral (not negative)
    return { responds: false, isSuspicious: suspicious };
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================
// Batch validation
// ============================================

/**
 * Build TrustSignals from a POI's data and optional website check result.
 */
export function buildTrustSignals(
  poi: POI,
  websiteResult: WebsiteCheckResult | null
): TrustSignals {
  return {
    hasWebsite: !!poi.googleWebsite,
    businessStatus: (poi.googleBusinessStatus as GoogleBusinessStatus) ?? null,
    hasPriceLevel: poi.googlePriceLevel != null,
    googleRating: poi.googleRating ?? null,
    googleReviewCount: poi.googleReviewCount ?? null,
    websiteResponds: websiteResult?.responds ?? null,
    isSuspiciousDomain: websiteResult?.isSuspicious ?? (poi.googleWebsite ? isSuspiciousDomain(poi.googleWebsite) : false),
  };
}

/**
 * Validate multiple POIs concurrently.
 * Deduplicates website checks by domain, then runs with a concurrency pool.
 */
export async function batchValidateTrust(
  pois: POI[],
  concurrency: number = DEFAULT_BATCH_CONCURRENCY
): Promise<Map<string, TrustResult>> {
  const results = new Map<string, TrustResult>();

  // Deduplicate website checks by domain (same domain = same result)
  const domainResults = new Map<string, WebsiteCheckResult>();
  const getDomainKey = (url: string): string | null => {
    try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
  };

  // Collect unique domains to check
  const domainsToCheck = new Map<string, string>(); // domain → first URL
  for (const poi of pois) {
    if (poi.googleWebsite) {
      const domain = getDomainKey(poi.googleWebsite);
      if (domain && !domainsToCheck.has(domain)) {
        domainsToCheck.set(domain, poi.googleWebsite);
      }
    }
  }

  // Check unique domains with concurrency pool
  const domainEntries = Array.from(domainsToCheck.entries());
  let running = 0;
  let idx = 0;

  await new Promise<void>((resolve) => {
    if (domainEntries.length === 0) { resolve(); return; }

    const next = () => {
      while (running < concurrency && idx < domainEntries.length) {
        const [domain, url] = domainEntries[idx++];
        running++;
        checkWebsite(url).then((result) => {
          domainResults.set(domain, result);
          running--;
          if (idx >= domainEntries.length && running === 0) {
            resolve();
          } else {
            next();
          }
        });
      }
    };
    next();
  });

  // Score each POI using cached domain results
  for (const poi of pois) {
    let websiteResult: WebsiteCheckResult | null = null;
    if (poi.googleWebsite) {
      const domain = getDomainKey(poi.googleWebsite);
      if (domain) websiteResult = domainResults.get(domain) ?? null;
    }
    const signals = buildTrustSignals(poi, websiteResult);
    results.set(poi.id, calculateHeuristicTrust(signals));
  }

  return results;
}
