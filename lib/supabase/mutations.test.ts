import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "./client";
import { updatePOITrustScore } from "./mutations";

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
