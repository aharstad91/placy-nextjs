import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@/lib/supabase/client";
import { runAcceptanceCheck } from "./provision-acceptance";

const sixThemes = Array.from({ length: 6 }, (_, i) => ({
  id: `tema-${i}`,
  leadText: `Ledetekst ${i}`,
}));

/**
 * Mock-supabase: .schema("v2").from(table) → konfigurerbare svar per tabell.
 */
function buildMockSupabase(opts: {
  categories?: { data: unknown; error: { message: string } | null };
  product?: { data: unknown; error: { message: string } | null };
  pois?: { data: unknown; error: { message: string } | null };
}) {
  const categories = opts.categories ?? { data: [{ category_id: "cafe" }], error: null };
  const product = opts.product ?? {
    data: { config: { reportConfig: { themes: sixThemes } } },
    error: null,
  };
  const pois = opts.pois ?? { data: Array(12).fill({ poi_id: "p" }), error: null };

  const mock = {
    schema: vi.fn(),
    from: vi.fn((table: string) => {
      if (table === "product_categories") {
        return { select: () => ({ eq: async () => categories }) };
      }
      if (table === "products") {
        return { select: () => ({ eq: () => ({ single: async () => product }) }) };
      }
      if (table === "product_pois") {
        return { select: () => ({ eq: async () => pois }) };
      }
      return {};
    }),
  };
  mock.schema.mockReturnValue(mock);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mock as any;
}

const OPTS = { productId: "prod-1", customer: "placy-demo", slug: "vikhammer" };

describe("runAcceptanceCheck", () => {
  beforeEach(() => vi.clearAllMocks());

  it("happy path → ok=true, ingen error-funn", async () => {
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(buildMockSupabase({}));
    const result = await runAcceptanceCheck(OPTS);
    expect(result.ok).toBe(true);
    expect(result.findings.some((f) => f.level === "error")).toBe(false);
    expect(result.urls.prod).toContain("/eiendom/placy-demo/vikhammer/rapport-board");
  });

  it("AC1: product_categories tom → error + ok=false ('0 av 0')", async () => {
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(
      buildMockSupabase({ categories: { data: [], error: null } }),
    );
    const result = await runAcceptanceCheck(OPTS);
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.level === "error" && f.message.includes("0 av 0"))).toBe(true);
  });

  it("AC2: ugyldig reportTier i config → tier-error → ok=false", async () => {
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(
      buildMockSupabase({
        product: { data: { config: { reportConfig: { reportTier: 3, themes: sixThemes } } }, error: null },
      }),
    );
    const result = await runAcceptanceCheck(OPTS);
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.level === "error" && f.message.startsWith("nivå:"))).toBe(true);
  });

  it("AC3: min-chips QA er INFORMATIVT (warn), ikke error — body-only legitimt", async () => {
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(
      buildMockSupabase({
        product: {
          data: {
            config: {
              reportConfig: {
                themes: [
                  ...sixThemes,
                  { id: "arvet", leadText: "x", editorial: { body: "kuratert", highlightPoiIds: [] } },
                ],
              },
            },
          },
          error: null,
        },
      }),
    );
    const result = await runAcceptanceCheck(OPTS);
    // body-only (0 chips) → warn, IKKE error; ok forblir true
    expect(result.ok).toBe(true);
    const qa = result.findings.find((f) => f.message.includes("min-chips"));
    expect(qa?.level).toBe("warn");
    expect(qa?.details?.some((d) => d.includes("body-only"))).toBe(true);
  });

  it("AC5: Supabase ikke konfigurert → error + ok=false", async () => {
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = await runAcceptanceCheck(OPTS);
    expect(result.ok).toBe(false);
    expect(result.findings[0].level).toBe("error");
  });

  it("AC5: read-feil på product_categories → error-funn", async () => {
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(
      buildMockSupabase({ categories: { data: null, error: { message: "DB nede" } } }),
    );
    const result = await runAcceptanceCheck(OPTS);
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.level === "error" && f.message.includes("DB nede"))).toBe(true);
  });

  it("AC8: leser via .schema('v2')", async () => {
    const mock = buildMockSupabase({});
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);
    await runAcceptanceCheck(OPTS);
    expect(mock.schema).toHaveBeenCalledWith("v2");
  });
});
