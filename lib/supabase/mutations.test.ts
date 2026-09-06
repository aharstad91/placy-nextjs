import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "./client";
import {
  updatePOITrustScore,
  upsertPOIsWithEditorialPreservation,
  type POIImportData,
} from "./mutations";

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
  const supabase: Record<string, unknown> = {
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
  // v2-bundet skrivesti: .schema("v2") returnerer samme dobbel
  supabase.schema = () => supabase;
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

/**
 * Upsert-dobbel for `upsertPOIsWithEditorialPreservation`: `.select().in()` gir
 * de eksisterende radene, `.upsert()` fanger payloaden.
 */
function buildUpsertMock(existing: Array<Record<string, unknown>>) {
  const captured: { rows?: Array<Record<string, unknown>> } = {};
  const supabase: Record<string, unknown> = {
    from: () => ({
      select: () => ({ in: async () => ({ data: existing, error: null }) }),
      upsert: async (rows: Array<Record<string, unknown>>) => {
        captured.rows = rows;
        return { error: null };
      },
    }),
  };
  supabase.schema = () => supabase;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { supabase: supabase as any, captured };
}

function importRow(over: Partial<POIImportData> = {}): POIImportData {
  return {
    id: "google-p1",
    name: "Coop Mega",
    lat: 63.43,
    lng: 10.4,
    address: null,
    category_id: "supermarket",
    google_place_id: "p1",
    google_rating: null,
    google_review_count: null,
    google_maps_url: null,
    photo_reference: null,
    entur_stopplace_id: null,
    bysykkel_station_id: null,
    hyre_station_id: null,
    trust_score: null,
    trust_flags: [],
    trust_score_updated_at: null,
    google_website: null,
    google_business_status: null,
    google_price_level: null,
    ...over,
  };
}

describe("upsertPOIsWithEditorialPreservation — åpningstider", () => {
  const LAGRET = { weekday_text: ["Monday: 9:00 AM – 5:00 PM"] };

  beforeEach(() => vi.clearAllMocks());

  it("sletter ALDRI lagrede tider når importen ikke har noen", async () => {
    // `refresh-opening-hours.ts` har hentet tidene i et eget Place Details-pass.
    // En re-provisjonering der Google ikke oppgir tider for stedet skal ikke ta
    // dem med seg — det er nettopp derfor feltet er `undefined` og ikke `null`.
    const { supabase, captured } = buildUpsertMock([
      { id: "google-p1", opening_hours_json: LAGRET },
    ]);
    createServerClientMock.mockReturnValue(supabase);

    await upsertPOIsWithEditorialPreservation([importRow()], { schema: "v2" });
    expect(captured.rows![0].opening_hours_json).toEqual(LAGRET);
  });

  it("lar ferske tider fra importen vinne over de lagrede", async () => {
    const ferske = { weekday_text: ["Monday: 7:00 AM – 11:00 PM"] };
    const { supabase, captured } = buildUpsertMock([
      { id: "google-p1", opening_hours_json: LAGRET },
    ]);
    createServerClientMock.mockReturnValue(supabase);

    await upsertPOIsWithEditorialPreservation(
      [importRow({ opening_hours_json: ferske })],
      { schema: "v2" },
    );
    expect(captured.rows![0].opening_hours_json).toEqual(ferske);
  });

  it("skriver Googles driftsstatus i stedet for å lagre den som «vet ikke»", async () => {
    const { supabase, captured } = buildUpsertMock([]);
    createServerClientMock.mockReturnValue(supabase);

    await upsertPOIsWithEditorialPreservation(
      [importRow({ google_business_status: "CLOSED_TEMPORARILY" })],
      { schema: "v2" },
    );
    expect(captured.rows![0].google_business_status).toBe("CLOSED_TEMPORARILY");
  });
});
