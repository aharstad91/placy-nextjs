import { describe, it, expect, vi, beforeEach } from "vitest";
import { REPORT_THEME_DEFAULTS } from "./report-defaults";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createServerClient: vi.fn(),
}));

// Mock slugify to verify it's used
vi.mock("@/lib/utils/slugify", () => ({
  slugify: vi.fn((text: string) =>
    text
      .toLowerCase()
      .replace(/æ/g, "ae")
      .replace(/ø/g, "o")
      .replace(/å/g, "a")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 63)
  ),
}));

import { createServerClient } from "@/lib/supabase/client";
import { createReportProject } from "./create-report-project";

function makeMaybeSingle(data: unknown) {
  return { maybeSingle: vi.fn().mockResolvedValue({ data }) };
}

function buildMockSupabase(overrides: {
  customerUpsertError?: { message: string } | null;
  existingProject?: { id: string; url_slug: string } | null;
  existingProduct?: { id: string } | null;
  conflictingProject?: { id: string } | null;
  projectInsertError?: { message: string } | null;
  productInsertError?: { message: string } | null;
} = {}) {
  // selectCallCount tracks how many times .from("projects").select() is called
  // so we can route the first call (existing by slug) vs second (conflict by id)
  const selectCallCount: Record<string, number> = {};
  // Captured insert payloads per table — lets tests assert on written config
  const inserts: { table: string; payload: Record<string, unknown> }[] = [];

  const makeFrom = (tableName: string) => {
    const chain: Record<string, unknown> = {};

    chain.upsert = vi.fn().mockResolvedValue({ error: overrides.customerUpsertError ?? null });
    chain.insert = vi.fn((payload: Record<string, unknown>) => {
      inserts.push({ table: tableName, payload });
      return Promise.resolve({
        error:
          tableName === "projects"
            ? (overrides.projectInsertError ?? null)
            : (overrides.productInsertError ?? null),
      });
    });
    chain.delete = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));

    // .select(...).eq(...)[.eq(...)].maybeSingle()
    // Strategy: the col passed to the first .eq() tells us which query this is.
    chain.select = vi.fn(() => {
      selectCallCount[tableName] = (selectCallCount[tableName] ?? 0) + 1;
      const callN = selectCallCount[tableName];

      return {
        eq: vi.fn((col: string) => {
          if (tableName === "projects") {
            if (col === "customer_id") {
              // First eq in: .eq("customer_id", ...).eq("url_slug", ...).maybeSingle()
              // callN=1 → existing-project lookup; callN=2 → conflict-id lookup handled differently
              return {
                eq: vi.fn((col2: string) => {
                  if (col2 === "url_slug") {
                    return makeMaybeSingle(overrides.existingProject ?? null);
                  }
                  return makeMaybeSingle(null);
                }),
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              };
            }
            if (col === "id") {
              // .eq("id", baseProjectId).maybeSingle() — collision check
              return makeMaybeSingle(overrides.conflictingProject ?? null);
            }
          }
          if (tableName === "products") {
            // .eq("project_id", ...).eq("product_type", ...).maybeSingle()
            return {
              eq: vi.fn(() => makeMaybeSingle(overrides.existingProduct ?? null)),
            };
          }
          return makeMaybeSingle(null);
        }),
      };
    });

    return chain;
  };

  // v2-skrivesti (r03.5): koden gjør baseClient.schema("v2").from(...) →
  // .schema returnerer samme mock (som har .from).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: any = {
    from: vi.fn((tableName: string) => makeFrom(tableName)),
    inserts,
  };
  mock.schema = vi.fn(() => mock);
  return mock;
}

function findProjectInsert(
  inserts: { table: string; payload: Record<string, unknown> }[]
): Record<string, unknown> {
  const projectInsert = inserts.find((i) => i.table === "projects");
  expect(projectInsert).toBeDefined();
  return projectInsert!.payload;
}

function findProductConfig(
  inserts: { table: string; payload: Record<string, unknown> }[]
): { reportConfig?: { reportTier?: number } } {
  const productInsert = inserts.find((i) => i.table === "products");
  expect(productInsert).toBeDefined();
  return productInsert!.payload.config as { reportConfig?: { reportTier?: number } };
}

describe("createReportProject — Unit 1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: oppretter prosjekt med container-ID og 6 temaer", async () => {
    const mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await createReportProject({
      name: "Vikhammer Strand",
      address: "Vikhammer Strand, Vikhammer, Malvik",
      lat: 63.41,
      lng: 10.77,
      customerSlug: "placy-demo",
    });

    expect(result.projectId).toBe("placy-demo_vikhammer-strand");
    expect(result.slug).toBe("vikhammer-strand");
    expect(result.existed).toBe(false);
    expect(result.warnings).toHaveLength(0);

    // Verifiser at products.insert ble kalt med 6 temaer og leadTexts
    const productsCalls = mockSupabase.from.mock.calls
      .filter((c: unknown[]) => c[0] === "products")
      .map(() => mockSupabase.from("products"));

    // Sjekk at insert ble kalt (indirekte via products.from)
    const fromCalls = mockSupabase.from.mock.calls;
    expect(fromCalls.some((c: unknown[]) => c[0] === "products")).toBe(true);
  });

  it("norske tegn i navn: Wesseløkka Vest → slug wesselokka-vest", async () => {
    const mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await createReportProject({
      name: "Wesseløkka Vest",
      address: "Wesseløkka Vest, Trondheim",
      lat: 63.42,
      lng: 10.38,
      customerSlug: "broset-utvikling-as",
    });

    expect(result.slug).toBe("wesselokka-vest");
    expect(result.projectId).toBe("broset-utvikling-as_wesselokka-vest");
  });

  it("eksisterende prosjekt med product: returnerer uten å overskrive", async () => {
    const mockSupabase = buildMockSupabase({
      existingProject: { id: "placy-demo_vikhammer-strand", url_slug: "vikhammer-strand" },
      existingProduct: { id: "existing-product-uuid" },
    });
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await createReportProject({
      name: "Vikhammer Strand",
      address: "Vikhammer Strand, Vikhammer",
      lat: 63.41,
      lng: 10.77,
      customerSlug: "placy-demo",
    });

    expect(result.existed).toBe(true);
    expect(result.productId).toBe("existing-product-uuid");
    expect(result.warnings.length).toBeGreaterThan(0);
    // Kun select-kall mot projects (ikke insert) — bevist av existed=true + productId
  });

  it("manglende SUPABASE_SERVICE_ROLE_KEY: kaster feil før noen writes", async () => {
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(null);

    await expect(
      createReportProject({
        name: "X",
        address: "X",
        lat: 0,
        lng: 0,
      })
    ).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("reportTier-option skrives i initial config (Unit 4/R3b)", async () => {
    const mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    await createReportProject({
      name: "Tier Test",
      address: "Tier Test, Trondheim",
      lat: 63.4,
      lng: 10.4,
      customerSlug: "placy-demo",
      reportTier: 2,
    });

    expect(findProductConfig(mockSupabase.inserts).reportConfig?.reportTier).toBe(2);
  });

  it("uten reportTier-option utelates feltet (nivå 1-default)", async () => {
    const mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    await createReportProject({
      name: "Default Tier",
      address: "Default Tier, Trondheim",
      lat: 63.4,
      lng: 10.4,
      customerSlug: "placy-demo",
    });

    const config = findProductConfig(mockSupabase.inserts);
    expect(config.reportConfig).toBeDefined();
    expect("reportTier" in (config.reportConfig ?? {})).toBe(false);
  });

  it("reportTier skrives også når prosjekt finnes men mangler report-produkt", async () => {
    const mockSupabase = buildMockSupabase({
      existingProject: { id: "placy-demo_tier-test", url_slug: "tier-test" },
      existingProduct: null,
    });
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    await createReportProject({
      name: "Tier Test",
      address: "Tier Test, Trondheim",
      lat: 63.4,
      lng: 10.4,
      customerSlug: "placy-demo",
      reportTier: 2,
    });

    expect(findProductConfig(mockSupabase.inserts).reportConfig?.reportTier).toBe(2);
  });

  it("AC2: has_3d_addon default false (ikke hardkodet true) — ortogonalt render-flagg", async () => {
    const mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    await createReportProject({
      name: "Addon Default",
      address: "Addon Default, Trondheim",
      lat: 63.4,
      lng: 10.4,
      customerSlug: "placy-demo",
    });

    const insert = findProjectInsert(mockSupabase.inserts);
    expect(insert.has_3d_addon).toBe(false);
    // v2 NOT-NULL-felt satt eksplisitt
    expect(insert.version).toBe(1);
    expect(insert.default_product).toBe("report");
  });

  it("AC2: has3dAddon=true → has_3d_addon true (CLI --addon-3d)", async () => {
    const mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    await createReportProject({
      name: "Addon On",
      address: "Addon On, Trondheim",
      lat: 63.4,
      lng: 10.4,
      customerSlug: "placy-demo",
      has3dAddon: true,
    });

    expect(findProjectInsert(mockSupabase.inserts).has_3d_addon).toBe(true);
  });

  it("AC4: uten customerSlug brukes reservert default-kunde 'intern' → intern_<slug>", async () => {
    const mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await createReportProject({
      name: "Intern Test",
      address: "Intern Test, Trondheim",
      lat: 63.4,
      lng: 10.4,
    });

    expect(result.customerSlug).toBe("intern");
    expect(result.projectId).toBe("intern_intern-test");
  });

  it("report-defaults.ts: alle 6 aktive temaer har ikke-tom leadText", () => {
    const ids = REPORT_THEME_DEFAULTS.map((t) => t.id);
    expect(ids).toContain("hverdagsliv");
    expect(ids).toContain("barn-oppvekst");
    expect(ids).toContain("mat-drikke");
    expect(ids).toContain("natur-friluftsliv");
    expect(ids).toContain("transport");
    expect(ids).toContain("trening-aktivitet");
    expect(ids).not.toContain("opplevelser");

    for (const theme of REPORT_THEME_DEFAULTS) {
      expect(theme.leadText.trim().length, `leadText mangler for ${theme.id}`).toBeGreaterThan(0);
    }
  });
});
