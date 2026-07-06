import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { proxy, config } from "./proxy";

/**
 * Kontrakt-vakter for r12.2 (PRD 12 Unit 2): legacy-301-SEO-rutingen er
 * bevart verbatim, /admin-branchen er en DOKUMENTERT passthrough (ikke
 * guard), og matcheren ekskluderer api/_next/statiske filer.
 */

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
