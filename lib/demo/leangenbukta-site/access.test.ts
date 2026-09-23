import { afterEach, describe, expect, it, vi } from "vitest";
import {
  issueLbDemoCookie,
  lbDemoAccessFromHeaders,
  LB_DEMO_COOKIE,
  LB_DEMO_MAX_AGE_SECONDS,
  safeNextPath,
  verifyLbDemoCookie,
} from "@/lib/demo/leangenbukta-site/access";

const CODE = "prov-leangenbukta-2026";
const SECRET = "hemmelig-".repeat(5);

function configure() {
  vi.stubEnv("PLACY_LB_DEMO_ACCESS_CODE", CODE);
  vi.stubEnv("PLACY_LB_DEMO_COOKIE_SECRET", SECRET);
}

afterEach(() => vi.unstubAllEnvs());

describe("tilgangscookie", () => {
  it("utstedes bare for riktig kode og verifiseres til en stabil besøks-ID", () => {
    configure();
    expect(issueLbDemoCookie("feil-kode-som-er-lang")).toBeNull();
    const token = issueLbDemoCookie(CODE)!;
    const visitor = verifyLbDemoCookie(token);
    expect(visitor?.via).toBe("code");
    expect(visitor?.visitorId).toMatch(/^[0-9a-f-]{36}$/);
    expect(verifyLbDemoCookie(token)?.visitorId).toBe(visitor?.visitorId);
  });

  it("avviser manipulert, utløpt og gammel-kode-cookie", () => {
    configure();
    const now = Date.UTC(2026, 8, 23);
    const token = issueLbDemoCookie(CODE, now)!;
    const [body, sig] = token.split(".");
    const tampered = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), exp: now + 10 ** 12 })).toString("base64url");
    expect(verifyLbDemoCookie(`${tampered}.${sig}`, now)).toBeNull();
    expect(verifyLbDemoCookie(token, now + LB_DEMO_MAX_AGE_SECONDS * 1000 + 1)).toBeNull();
    vi.stubEnv("PLACY_LB_DEMO_ACCESS_CODE", "ny-kode-etter-rotasjon");
    expect(verifyLbDemoCookie(token, now)).toBeNull();
  });

  it("gir ingen cookie når konfigurasjonen er for svak", () => {
    vi.stubEnv("PLACY_LB_DEMO_ACCESS_CODE", CODE);
    vi.stubEnv("PLACY_LB_DEMO_COOKIE_SECRET", "for-kort");
    expect(issueLbDemoCookie(CODE)).toBeNull();
  });
});

describe("tilgang per forespørsel", () => {
  it("krever cookie også på localhost når koden er konfigurert", () => {
    configure();
    vi.stubEnv("NODE_ENV", "development");
    expect(lbDemoAccessFromHeaders({ cookie: null, host: "localhost:3000" })).toBeNull();
    const cookie = `annet=1; ${LB_DEMO_COOKIE}=${issueLbDemoCookie(CODE)}`;
    expect(lbDemoAccessFromHeaders({ cookie, host: "demo.example" })?.via).toBe("code");
  });

  it("slipper inn loopback uten kode bare utenfor produksjon", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(lbDemoAccessFromHeaders({ cookie: null, host: "127.0.0.1:3105" })).toEqual({ visitorId: "local", via: "local" });
    expect(lbDemoAccessFromHeaders({ cookie: null, host: "192.168.1.20:3000" })).toBeNull();
    vi.stubEnv("NODE_ENV", "production");
    expect(lbDemoAccessFromHeaders({ cookie: null, host: "localhost" })).toBeNull();
  });
});

describe("neste-sti etter innlogging", () => {
  it.each([
    ["/demo/leangenbukta-nettside/knutepunktet", "/demo/leangenbukta-nettside/knutepunktet"],
    ["/demo/leangenbukta-lokal", "/demo/leangenbukta-lokal"],
    ["https://evil.example", "/demo/leangenbukta-nettside"],
    ["//evil.example/demo/leangenbukta-x", "/demo/leangenbukta-nettside"],
    ["/demo/leangenbukta-tilgang?neste=x", "/demo/leangenbukta-nettside"],
    ["/admin", "/demo/leangenbukta-nettside"],
    [null, "/demo/leangenbukta-nettside"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
