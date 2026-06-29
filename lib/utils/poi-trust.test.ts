import { describe, it, expect } from "vitest";
import {
  ALL_TRUST_FLAGS,
  VALID_TRUST_FLAGS,
  isTrustFlag,
  MIN_TRUST_SCORE,
  calculateHeuristicTrust,
  validateExternalUrl,
  isSuspiciousDomain,
  buildTrustSignals,
  batchValidateTrust,
  type TrustSignals,
} from "./poi-trust";
import type { POI } from "@/lib/types";

const baseSignals = (over: Partial<TrustSignals> = {}): TrustSignals => ({
  hasWebsite: true,
  businessStatus: "OPERATIONAL",
  hasPriceLevel: false,
  googleRating: 4.5,
  googleReviewCount: 10,
  websiteResponds: null,
  isSuspiciousDomain: false,
  ...over,
});

describe("VALID_TRUST_FLAGS / isTrustFlag", () => {
  it("er avledet fra samme single-source som typen (samme medlemmer)", () => {
    expect(VALID_TRUST_FLAGS.size).toBe(ALL_TRUST_FLAGS.length);
    for (const f of ALL_TRUST_FLAGS) expect(VALID_TRUST_FLAGS.has(f)).toBe(true);
  });
  it("isTrustFlag aksepterer gyldige, avviser ukjente + ikke-strenger", () => {
    expect(isTrustFlag("no_website")).toBe(true);
    expect(isTrustFlag("manual_override")).toBe(true);
    expect(isTrustFlag("bogus")).toBe(false);
    expect(isTrustFlag(null)).toBe(false);
    expect(isTrustFlag(42)).toBe(false);
  });
  it("MIN_TRUST_SCORE er 0.5", () => {
    expect(MIN_TRUST_SCORE).toBe(0.5);
  });
});

describe("calculateHeuristicTrust", () => {
  it("hard-fail på permanently_closed → score 0", () => {
    const r = calculateHeuristicTrust(baseSignals({ businessStatus: "CLOSED_PERMANENTLY" }));
    expect(r.score).toBe(0);
    expect(r.flags).toEqual(["permanently_closed"]);
    expect(r.needsClaudeReview).toBe(false);
  });

  it("ingen nettside + perfekt 5.0 + <100 anmeldelser → sterk negativ", () => {
    const r = calculateHeuristicTrust(
      baseSignals({ hasWebsite: false, googleRating: 5.0, googleReviewCount: 20 })
    );
    expect(r.flags).toContain("suspect_no_website_perfect_rating");
    // BASE 0.6 - 0.3 + 0.05 (operational) = 0.35
    expect(r.score).toBeCloseTo(0.35, 5);
  });

  it("ingen nettside alene → moderat negativ", () => {
    const r = calculateHeuristicTrust(baseSignals({ hasWebsite: false, googleRating: 4.2 }));
    expect(r.flags).toContain("no_website");
  });

  it("website_ok + has_price_level + høyt anmeldelsestall klamper til 1.0", () => {
    const r = calculateHeuristicTrust(
      baseSignals({ websiteResponds: true, hasPriceLevel: true, googleReviewCount: 500 })
    );
    expect(r.flags).toEqual(
      expect.arrayContaining(["website_ok", "has_price_level", "high_review_count"])
    );
    expect(r.score).toBeLessThanOrEqual(1);
  });

  it("suspicious_domain trekker ned", () => {
    const r = calculateHeuristicTrust(baseSignals({ isSuspiciousDomain: true }));
    expect(r.flags).toContain("suspicious_domain");
  });

  it("anmeldelses-tiers: >=200 high, >=50 moderate", () => {
    expect(calculateHeuristicTrust(baseSignals({ googleReviewCount: 250 })).flags).toContain("high_review_count");
    expect(calculateHeuristicTrust(baseSignals({ googleReviewCount: 60 })).flags).toContain("moderate_review_count");
  });

  it("score er klampet [0,1] og rundet til 2 desimaler", () => {
    const r = calculateHeuristicTrust(baseSignals());
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
    expect(Math.round(r.score * 100) / 100).toBe(r.score);
  });

  it("needsClaudeReview kun i vinduet [0.3, 0.7]", () => {
    const mid = calculateHeuristicTrust(baseSignals({ hasWebsite: false, googleRating: 4.0 }));
    expect(mid.needsClaudeReview).toBe(mid.score >= 0.3 && mid.score <= 0.7);
  });
});

describe("validateExternalUrl (SSRF-guard)", () => {
  it("tillater normal https-FQDN", () => {
    expect(validateExternalUrl("https://example.com/path")).toEqual({ safe: true });
  });
  it.each([
    ["http://127.0.0.1", "private_ip"],
    ["http://10.0.0.5", "private_ip"],
    ["http://192.168.1.1", "private_ip"],
    ["http://169.254.169.254", "metadata_endpoint"],
    ["http://localhost", "localhost"],
    ["http://metadata.google.internal", "metadata_endpoint"],
    ["http://8.8.8.8", "bare_ip"],
    ["http://[::1]", "ipv6_address"],
    ["ftp://example.com", "invalid_protocol"],
    ["https://nodots", "not_fqdn"],
    ["not a url", "invalid_url"],
  ])("blokkerer %s (%s)", (url, reason) => {
    const r = validateExternalUrl(url);
    expect(r.safe).toBe(false);
    if (!r.safe) expect(r.reason).toBe(reason);
  });
});

describe("isSuspiciousDomain", () => {
  it("flagger universiteter og blogg-plattformer", () => {
    expect(isSuspiciousDomain("https://www.ntnu.no/side")).toBe(true);
    expect(isSuspiciousDomain("https://min.blogspot.com")).toBe(true);
  });
  it("aksepterer vanlige forretnings-domener", () => {
    expect(isSuspiciousDomain("https://kafe-trondheim.no")).toBe(false);
  });
});

describe("batchValidateTrust (deadlock-safe pool, ingen nettverk for web-løse POIer)", () => {
  const poi = (id: string, over: Partial<POI> = {}): POI =>
    ({ id, googleWebsite: null, googleBusinessStatus: "OPERATIONAL", googleRating: 4, googleReviewCount: 80, ...over } as unknown as POI);

  it("scorer hver web-løs POI uten å henge (pool resolver)", async () => {
    const res = await batchValidateTrust([poi("a"), poi("b"), poi("c")]);
    expect(res.size).toBe(3);
    for (const id of ["a", "b", "c"]) expect(res.get(id)?.flags).toContain("moderate_review_count");
  });

  it("tom input → tomt resultat (pool resolver umiddelbart)", async () => {
    const res = await batchValidateTrust([]);
    expect(res.size).toBe(0);
  });
});

describe("buildTrustSignals", () => {
  it("utleder signaler fra POI + website-resultat", () => {
    const s = buildTrustSignals(
      { id: "x", googleWebsite: "https://kafe.no", googlePriceLevel: 2, googleRating: 4.5, googleReviewCount: 120 } as unknown as POI,
      { responds: true, isSuspicious: false }
    );
    expect(s.hasWebsite).toBe(true);
    expect(s.hasPriceLevel).toBe(true);
    expect(s.websiteResponds).toBe(true);
  });
});
