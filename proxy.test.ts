import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { proxy, config } from "./proxy";

/**
 * Kontrakt-vakter for r12.2 (PRD 12 Unit 2): legacy-301-SEO-rutingen er
 * bevart verbatim, /admin-branchen er en DOKUMENTERT passthrough (ikke
 * guard), og matcheren ekskluderer api/_next/statiske filer.
 */

beforeEach(() => vi.stubEnv("PLACY_HOSTED_VOICE", "0"));
afterEach(() => vi.unstubAllEnvs());

function req(path: string): NextRequest {
  return new NextRequest(`https://placy.no${path}`);
}

function redirectTarget(res: Response): string | null {
  const loc = res.headers.get("location");
  return loc ? new URL(loc).pathname : null;
}

describe("legacy-301-redirects (AC1 — SEO-bevaring)", () => {
  it("/for/kunde/prosjekt/explore → 301 /eiendom/kunde/prosjekt", () => {
    const res = proxy(req("/for/klp-eiendom/ferjemannsveien-10/explore"));
    expect(res.status).toBe(301);
    expect(redirectTarget(res)).toBe("/eiendom/klp-eiendom/ferjemannsveien-10");
  });

  it("/for/kunde/prosjekt/report → 301 /eiendom/.../rapport-board", () => {
    const res = proxy(req("/for/klp-eiendom/ferjemannsveien-10/report"));
    expect(res.status).toBe(301);
    expect(redirectTarget(res)).toBe(
      "/eiendom/klp-eiendom/ferjemannsveien-10/rapport-board"
    );
  });

  it("/for/kunde/prosjekt (rot) → 301 /eiendom/kunde/prosjekt", () => {
    const res = proxy(req("/for/klp-eiendom/ferjemannsveien-10"));
    expect(res.status).toBe(301);
    expect(redirectTarget(res)).toBe("/eiendom/klp-eiendom/ferjemannsveien-10");
  });

  it("/for/kunde/prosjekt/trips/x → 301 prosjektroten (frysingen døde ved cutover)", () => {
    const res = proxy(req("/for/klp-eiendom/ferjemannsveien-10/trips/x"));
    expect(res.status).toBe(301);
    expect(redirectTarget(res)).toBe("/eiendom/klp-eiendom/ferjemannsveien-10");
  });

  it("/eiendom/kunde/prosjekt/rapport → 301 .../rapport-board (scroll-rapporten død)", () => {
    const res = proxy(req("/eiendom/klp-eiendom/ferjemannsveien-10/rapport"));
    expect(res.status).toBe(301);
    expect(redirectTarget(res)).toBe(
      "/eiendom/klp-eiendom/ferjemannsveien-10/rapport-board"
    );
  });

  it("/klp-eiendom/slug-guide → 301 /eiendom/klp-eiendom/slug (guide-rutene døde)", () => {
    const res = proxy(req("/klp-eiendom/ferjemannsveien-10-guide"));
    expect(res.status).toBe(301);
    expect(redirectTarget(res)).toBe("/eiendom/klp-eiendom/ferjemannsveien-10");
  });

  it("/generer → 301 /eiendom/generer (med query bevart)", () => {
    const res = proxy(req("/generer?utm=test"));
    expect(res.status).toBe(301);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/eiendom/generer");
    expect(loc.search).toBe("?utm=test");
  });

  it("KNOWN_CUSTOMERS legacy: /scandic/x → 301 /eiendom/scandic/x", () => {
    const res = proxy(req("/scandic/scandic-nidelven"));
    expect(res.status).toBe(301);
    expect(redirectTarget(res)).toBe("/eiendom/scandic/scandic-nidelven");
  });

  it("suffiks-redirect: /klp-eiendom/slug-explore → 301 /eiendom/klp-eiendom/slug", () => {
    const res = proxy(req("/klp-eiendom/ferjemannsveien-10-explore"));
    expect(res.status).toBe(301);
    expect(redirectTarget(res)).toBe("/eiendom/klp-eiendom/ferjemannsveien-10");
  });
});

describe("passthroughs (AC1/AC4)", () => {
  it("/eiendom, /en og /trondheim passerer urørt (ingen ny locale-rewrite)", () => {
    for (const p of ["/eiendom/x/y", "/en/trondheim", "/trondheim/guide"]) {
      expect(proxy(req(p)).status, p).toBe(200);
      expect(proxy(req(p)).headers.get("location"), p).toBeNull();
    }
  });
});

describe("innsikt-headeren (spørrestrengen til layouten)", () => {
  it("setter x-insight-search på innsiktsrutene, med token og alt", () => {
    const res = proxy(new NextRequest("https://placy.no/eiendom/kunde/prosjekt/innsikt?t=abc&demo=1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-override-headers")).toContain("x-insight-search");
    expect(res.headers.get("x-middleware-request-x-insight-search")).toBe("?t=abc&demo=1");
  });

  it("gjelder også temasidene under innsikt", () => {
    const res = proxy(new NextRequest("https://placy.no/eiendom/kunde/prosjekt/innsikt/barn-oppvekst?t=abc"));
    expect(res.headers.get("x-middleware-request-x-insight-search")).toBe("?t=abc");
  });

  it("settes IKKE på andre sider — en header overalt er en header ingen husker", () => {
    const res = proxy(new NextRequest("https://placy.no/eiendom/kunde/prosjekt/rapport-board?t=abc"));
    expect(res.headers.get("x-middleware-request-x-insight-search")).toBeNull();
  });
});

describe("/admin-branchen (AC3 — dokumentert passthrough, IKKE guard)", () => {
  it("slipper /admin gjennom uten redirect/blokkering", () => {
    const res = proxy(req("/admin/projects"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("kildeteksten dokumenterer at branchen ikke er en sikkerhetsgrense", () => {
    const src = readFileSync(join(process.cwd(), "proxy.ts"), "utf8");
    expect(src).toContain("PASSTHROUGH, IKKE guard");
    expect(src).toContain("require-admin");
  });
});

describe("config.matcher (AC2)", () => {
  it("ekskluderer api/_next/statiske filer — admin-API gates i egen sjekk", () => {
    expect(config.matcher).toEqual([
      "/((?!api|_next|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)",
    ]);
  });
});


describe("shared platform domain routing", () => {
  beforeEach(() => vi.stubEnv("PLACY_HOSTED_VOICE", "true"));

  it.each(["/nyhavna", "/another-project", "/demo/nyhavna-lokal", "/admin/projects"])("keeps platform path %s same-origin", path => {
    expect(proxy(req(path)).headers.get("location")).toBeNull();
  });

  it.each(["/demo/nyhavna-nettside", "/demo/nyhavna-nettside/beliggenhet"])("serves Nyhavna site demo %s on the platform origin and excludes it from indexing", path => {
    const response = proxy(req(path + "?utm=one&utm=two"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it.each(["/", "/midtbyen", "/eiendom/customer/project/rapport-board", "/event/customer/project", "/demo/another-demo", "/kart/test", "/for/customer/project", "/scandic/hotel", "/pitch/wesselslokka", "/portefolje/test", "/generer", "/prototype"])("preserves the existing website at www for %s", path => {
    const response = proxy(req(path + "?utm=one&utm=two"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://www.placy.no" + path + "?utm=one&utm=two");
  });

  it("preserves existing noncanonical demo links on platform aliases", () => {
    const response = proxy(new NextRequest("https://placy-platform.vercel.app/demo/nyhavna-nettside"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects any old project path to its public slug, preserving query", () => {
    expect(proxy(req("/p/another-project?a=1&a=2")).headers.get("location")).toBe("https://placy.no/another-project?a=1&a=2");
  });
});

describe("Leangenbukta-kundedemoen (tilgangsgate)", () => {
  const CODE = "prov-leangenbukta-2026";
  const SECRET = "s".repeat(40);
  const local = (path: string) => new NextRequest(`http://localhost:3000${path}`);
  const shared = (path: string, cookie?: string) =>
    new NextRequest(`https://leangenbukta-demo.vercel.app${path}`, cookie ? { headers: { cookie } } : undefined);

  it("slipper inn loopback på en ukonfigurert utviklingsserver", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(proxy(local("/demo/leangenbukta-nettside")).status).toBe(200);
    expect(proxy(local("/demo/leangenbukta-lokal")).status).toBe(200);
  });

  it("gir 404 til en ikke-loopback-host når koden ikke er konfigurert", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(proxy(shared("/demo/leangenbukta-nettside/knutepunktet")).status).toBe(404);
  });

  it("feiler lukket i produksjon uten konfigurasjon, også med forfalsket Host", () => {
    vi.stubEnv("NODE_ENV", "production");
    const forged = new NextRequest("https://leangenbukta-demo.vercel.app/demo/leangenbukta-nettside", { headers: { host: "localhost" } });
    expect(proxy(forged).status).toBe(404);
    expect(proxy(local("/demo/leangenbukta-lokal")).status).toBe(404);
  });

  it("sender uten cookie til innloggingen med neste-sti når koden er konfigurert", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLACY_LB_DEMO_ACCESS_CODE", CODE);
    vi.stubEnv("PLACY_LB_DEMO_COOKIE_SECRET", SECRET);
    const response = proxy(shared("/demo/leangenbukta-nettside/knutepunktet?x=1"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/demo/leangenbukta-tilgang");
    expect(location.searchParams.get("neste")).toBe("/demo/leangenbukta-nettside/knutepunktet?x=1");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("slipper inn med gyldig cookie og merker svaret noindex", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLACY_LB_DEMO_ACCESS_CODE", CODE);
    vi.stubEnv("PLACY_LB_DEMO_COOKIE_SECRET", SECRET);
    const { issueLbDemoCookie, LB_DEMO_COOKIE } = await import("@/lib/demo/leangenbukta-site/access");
    const cookie = `${LB_DEMO_COOKIE}=${issueLbDemoCookie(CODE)}`;
    const response = proxy(shared("/demo/leangenbukta-lokal", cookie));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("lar innloggingssiden selv være åpen", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLACY_LB_DEMO_ACCESS_CODE", CODE);
    vi.stubEnv("PLACY_LB_DEMO_COOKIE_SECRET", SECRET);
    expect(proxy(shared("/demo/leangenbukta-tilgang")).status).toBe(200);
  });

  it("rører ikke Nyhavna-demoene", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(proxy(shared("/demo/nyhavna-nettside")).status).toBe(200);
    expect(proxy(shared("/demo/nyhavna-lokal")).status).toBe(200);
  });
});
