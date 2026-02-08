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

export interface TrustSignals {
  // Layer 1: Google data
  hasWebsite: boolean;
  businessStatus: string | null; // "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY"
  hasPriceLevel: boolean;
  googleRating: number | null;
  googleReviewCount: number | null;

  // Layer 2: Website verification
  websiteResponds: boolean | null; // null = not checked
  isSuspiciousDomain: boolean;
}

export interface TrustResult {
  score: number; // 0.0-1.0
  flags: string[];
  needsClaudeReview: boolean; // true if score is in 0.3-0.7 range
}

export interface WebsiteCheckResult {
  responds: boolean;
  isSuspicious: boolean;
  statusCode: number | null;
}

// ============================================
// Constants
// ============================================

const BASE_SCORE = 0.6;

const SUSPICIOUS_DOMAINS = [
  ".ntnu.no", ".uio.no", ".uit.no", ".nmbu.no", ".uib.no", // Norske universiteter
  ".edu", ".ac.uk",                                          // Internasjonale universiteter
  "blogspot.com", "wordpress.com",                           // Blogg-plattformer
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
  const flags: string[] = [];

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

/**
 * Validate that a URL is safe for server-side requests.
 * Blocks private IPs, non-http protocols, and bare IP addresses.
 */
export function validateExternalUrl(rawUrl: string): { safe: boolean; reason?: string } {
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

  const hostname = parsed.hostname;

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
    return SUSPICIOUS_DOMAINS.some(
      (domain) => hostname.endsWith(domain) || hostname === domain.replace(/^\./, "")
    );
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
 */
export async function checkWebsite(url: string): Promise<WebsiteCheckResult> {
  // SSRF check
  const validation = validateExternalUrl(url);
  if (!validation.safe) {
    return { responds: false, isSuspicious: false, statusCode: null };
  }

  const suspicious = isSuspiciousDomain(url);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBSITE_CHECK_TIMEOUT_MS);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeout);

    // Check final URL after redirects for SSRF
    if (response.url && response.url !== url) {
      const redirectValidation = validateExternalUrl(response.url);
      if (!redirectValidation.safe) {
        return { responds: false, isSuspicious: suspicious, statusCode: null };
      }
    }

    const responds = response.status >= 200 && response.status < 400;
    return {
      responds,
      isSuspicious: suspicious || (response.url ? isSuspiciousDomain(response.url) : false),
      statusCode: response.status,
    };
  } catch {
    // Timeout or network error — neutral (not negative)
    return { responds: false, isSuspicious: suspicious, statusCode: null };
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
    businessStatus: poi.googleBusinessStatus ?? null,
    hasPriceLevel: poi.googlePriceLevel != null,
    googleRating: poi.googleRating ?? null,
    googleReviewCount: poi.googleReviewCount ?? null,
    websiteResponds: websiteResult?.responds ?? null,
    isSuspiciousDomain: websiteResult?.isSuspicious ?? (poi.googleWebsite ? isSuspiciousDomain(poi.googleWebsite) : false),
  };
}

/**
 * Validate multiple POIs concurrently.
 * Runs website checks in parallel with limited concurrency.
 */
export async function batchValidateTrust(
  pois: POI[],
  concurrency: number = DEFAULT_BATCH_CONCURRENCY
): Promise<Map<string, TrustResult>> {
  const results = new Map<string, TrustResult>();

  // Process in batches for concurrency control
  for (let i = 0; i < pois.length; i += concurrency) {
    const batch = pois.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(async (poi) => {
        // Layer 2: Website check (only if has website URL)
        const websiteResult = poi.googleWebsite
          ? await checkWebsite(poi.googleWebsite)
          : null;

        // Layer 1+2: Calculate heuristic trust
        const signals = buildTrustSignals(poi, websiteResult);
        const result = calculateHeuristicTrust(signals);

        return { poiId: poi.id, result };
      })
    );

    for (const { poiId, result } of batchResults) {
      results.set(poiId, result);
    }
  }

  return results;
}
