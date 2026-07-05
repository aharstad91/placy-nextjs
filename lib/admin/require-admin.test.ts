import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Kontrakt-vakter for r12.1 (PRD 12 Unit 1): den delte admin-gaten +
 * skall-invariantene (Mapbox-fri layout, keeper-nav, noindex, ingen
 * inline ADMIN_ENABLED-streng på keeper-flater).
 */

vi.mock("server-only", () => ({}));
const redirectMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { isAdminEnabled, requireAdmin, requireAdminApi } from "./require-admin";

afterEach(() => {
  vi.unstubAllEnvs();
  redirectMock.mockReset();
});

describe("requireAdmin (side-gate)", () => {
  it("slipper gjennom når ADMIN_ENABLED=true", () => {
    vi.stubEnv("ADMIN_ENABLED", "true");
    requireAdmin();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirecter til / når av eller usatt", () => {
    vi.stubEnv("ADMIN_ENABLED", "false");
    requireAdmin();
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("krever eksakt strengen 'true' (ikke '1'/'TRUE')", () => {
    vi.stubEnv("ADMIN_ENABLED", "1");
    expect(isAdminEnabled()).toBe(false);
    vi.stubEnv("ADMIN_ENABLED", "TRUE");
    expect(isAdminEnabled()).toBe(false);
    vi.stubEnv("ADMIN_ENABLED", "true");
    expect(isAdminEnabled()).toBe(true);
  });
});

describe("requireAdminApi (API-gate)", () => {
  it("returnerer null når admin er på", () => {
    vi.stubEnv("ADMIN_ENABLED", "true");
    expect(requireAdminApi()).toBeNull();
  });

  it("returnerer 403 når admin er av", async () => {
    vi.stubEnv("ADMIN_ENABLED", "false");
    const res = requireAdminApi();
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toBe("Admin ikke aktivert");
  });
});

describe("skall-invarianter (kildetekst-kontrakt)", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  const KEEPER_PAGES = [
    "app/admin/page.tsx",
    "app/admin/categories/page.tsx",
    "app/admin/customers/page.tsx",
    "app/admin/generate/page.tsx",
    "app/admin/pois/page.tsx",
    "app/admin/projects/page.tsx",
    "app/admin/projects/[id]/page.tsx",
    "app/admin/public/page.tsx",
    "app/admin/requests/page.tsx",
  ];
  const KEEPER_APIS = [
    "app/api/admin/fetch-photos/route.ts",
    "app/api/admin/import/route.ts",
    "app/api/admin/projects/[id]/route.ts",
    "app/api/admin/retry-request/route.ts",
    "app/api/admin/revalidate/route.ts",
    "app/api/admin/trust-validate/route.ts",
    "app/api/admin/trust-validate/update/route.ts",
  ];

  it("ingen keeper-flate beholder inline ADMIN_ENABLED-strengen (AC3)", () => {
    for (const p of [...KEEPER_PAGES, ...KEEPER_APIS]) {
      expect(read(p), p).not.toContain("ADMIN_ENABLED");
    }
  });

  it("keeper-sider kaller requireAdmin, keeper-API-er requireAdminApi (AC3)", () => {
    for (const p of KEEPER_PAGES) {
      expect(read(p), p).toContain("requireAdmin()");
    }
    for (const p of KEEPER_APIS) {
      expect(read(p), p).toContain("requireAdminApi()");
    }
  });

  it("hver keeper-side eksporterer metadata med noindex (AC4)", () => {
    for (const p of KEEPER_PAGES) {
      const src = read(p);
      expect(src, p).toContain("export const metadata");
      expect(src, p).toContain("index: false");
    }
  });

  it("layout injiserer ikke ekstern Mapbox-CSS (AC1)", () => {
    expect(read("app/admin/layout.tsx")).not.toContain("api.mapbox.com");
  });

  it("NAV_ITEMS er nøyaktig keeper-settet (AC2)", () => {
    const src = read("components/admin/admin-sidebar.tsx");
    const hrefs = Array.from(src.matchAll(/href: "(\/admin[^"]*)"/g), (m) => m[1]);
    expect(hrefs).toEqual([
      "/admin",
      "/admin/customers",
      "/admin/projects",
      "/admin/pois",
      "/admin/categories",
      "/admin/generate",
      "/admin/requests",
    ]);
  });

  it("skall-komponentene er tier-/produkt-agnostiske (AC5)", () => {
    for (const p of [
      "app/admin/layout.tsx",
      "components/admin/admin-sidebar.tsx",
      "components/admin/admin-secondary-nav.tsx",
    ]) {
      expect(read(p), p).not.toContain("reportTier");
    }
  });

  it("helperen er server-only (lekker ikke env til klient)", () => {
    expect(read("lib/admin/require-admin.ts")).toContain('import "server-only"');
  });
});
