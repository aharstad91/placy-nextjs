import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "./client";
import { updatePOITier, updatePOITrustScore } from "./mutations";

const createServerClientMock = vi.mocked(createServerClient);

/**
 * Minimal supabase-dobbel som skiller select-kjeden (.select().eq().single())
 * fra update-kjeden (.update().eq()), fanger update-payloaden, og lar select-
 * og update-resultatet konfigureres per test.
 */
function buildMockSupabase(opts: {
  selectResult?: { data: unknown; error: { message: string } | null };
  updateError?: { message: string } | null;
}) {
  const captured: { updatePayload?: Record<string, unknown> } = {};
  const selectResult = opts.selectResult ?? {
    data: { editorial_hook: null, local_insight: null, editorial_sources: null },
    error: null,
  };
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => selectResult }),
      }),
      update: (payload: Record<string, unknown>) => {
        captured.updatePayload = payload;
        return { eq: async () => ({ error: opts.updateError ?? null }) };
      },
    }),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { supabase: supabase as any, captured };
}

describe("updatePOITrustScore", () => {
  beforeEach(() => vi.clearAllMocks());

  it("AC1: kaster når score er utenfor 0–1 (før DB-kall)", async () => {
    await expect(updatePOITrustScore("p1", 1.5, [])).rejects.toThrow(
      /0\.0-1\.0/,
    );
    await expect(updatePOITrustScore("p1", -0.1, [])).rejects.toThrow(
      /0\.0-1\.0/,
    );
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it("AC1: kaster på ukjent trust-flag (validert mot VALID_TRUST_FLAGS)", async () => {
    await expect(
      updatePOITrustScore("p1", 0.8, ["not_a_real_flag"]),
    ).rejects.toThrow(/Invalid trust flag/);
  });

  it("AC1: skriver score/flags/updated_at og kaster IKKE ved gyldig input", async () => {
    const { supabase, captured } = buildMockSupabase({});
    createServerClientMock.mockReturnValue(supabase);
    await updatePOITrustScore("p1", 0.65, ["no_website"]);
    expect(captured.updatePayload?.trust_score).toBe(0.65);
    expect(captured.updatePayload?.trust_flags).toEqual(["no_website"]);
    expect(captured.updatePayload).toHaveProperty("trust_score_updated_at");
  });

  it("AC1: kaster med tydelig melding ved DB-feil (ingen stille swallow)", async () => {
    const { supabase } = buildMockSupabase({ updateError: { message: "boom" } });
    createServerClientMock.mockReturnValue(supabase);
    await expect(updatePOITrustScore("p1", 0.8, [])).rejects.toThrow(/boom/);
  });
});

describe("updatePOITier", () => {
  beforeEach(() => vi.clearAllMocks());

  const baseData = {
    tier_reason: "kjede",
    is_chain: true,
    is_local_gem: false,
    poi_metadata: { source: "test" },
  };

  it("AC2: validerer poi_tier ∈ {1,2,3} — avviser 0 og 4 (egen akse fra reportTier 1|2)", async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updatePOITier("p1", { ...baseData, poi_tier: 0 as any }),
    ).rejects.toThrow(/must be 1, 2, or 3/);
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updatePOITier("p1", { ...baseData, poi_tier: 4 as any }),
    ).rejects.toThrow(/must be 1, 2, or 3/);
  });

  it("AC2 port-with-rewrite: kaster når existing-selecten feiler (ingen stille editorial-skip)", async () => {
    const { supabase } = buildMockSupabase({
      selectResult: { data: null, error: { message: "select failed" } },
    });
    createServerClientMock.mockReturnValue(supabase);
    await expect(
      updatePOITier("p1", { ...baseData, poi_tier: 2 }),
    ).rejects.toThrow(/Kunne ikke lese eksisterende POI/);
  });

  it("AC2: skriver tier-felt + poi_metadata + tier_evaluated_at", async () => {
    const { supabase, captured } = buildMockSupabase({});
    createServerClientMock.mockReturnValue(supabase);
    await updatePOITier("p1", { ...baseData, poi_tier: 1 });
    expect(captured.updatePayload?.poi_tier).toBe(1);
    expect(captured.updatePayload?.tier_reason).toBe("kjede");
    expect(captured.updatePayload?.is_chain).toBe(true);
    expect(captured.updatePayload?.poi_metadata).toEqual({ source: "test" });
    expect(captured.updatePayload).toHaveProperty("tier_evaluated_at");
  });

  it("AC2: skriver editorial KUN når eksisterende verdi er null (bevarer hand-crafted)", async () => {
    // editorial_hook finnes allerede → skal IKKE overskrives; local_insight er null → skrives
    const { supabase, captured } = buildMockSupabase({
      selectResult: {
        data: {
          editorial_hook: "kuratert hook",
          local_insight: null,
          editorial_sources: null,
        },
        error: null,
      },
    });
    createServerClientMock.mockReturnValue(supabase);
    await updatePOITier("p1", {
      ...baseData,
      poi_tier: 2,
      editorial_hook: "ny hook",
      local_insight: "ny insight",
    });
    expect(captured.updatePayload).not.toHaveProperty("editorial_hook");
    expect(captured.updatePayload?.local_insight).toBe("ny insight");
  });

  it("AC2: kaster med tydelig melding ved update-DB-feil", async () => {
    const { supabase } = buildMockSupabase({ updateError: { message: "db down" } });
    createServerClientMock.mockReturnValue(supabase);
    await expect(
      updatePOITier("p1", { ...baseData, poi_tier: 1 }),
    ).rejects.toThrow(/db down/);
  });
});
