import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client (buildMockSupabase-mønsteret fra create-report-project.test.ts)
vi.mock("@/lib/supabase/client", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@/lib/supabase/client";
import { findAreaForPoint } from "./find-area-for-point";

interface AreaRow {
  id: string;
  name_no: string;
  level: string | null;
  boundary: unknown;
  report_editorial: unknown;
}

// WGS84 GeoJSON-polygon rundt «Ranheim» — koordinatpar i [lng, lat]-rekkefølge
const ranheimBoundary = {
  type: "Polygon",
  coordinates: [
    [
      [10.5, 63.42],
      [10.55, 63.42],
      [10.55, 63.45],
      [10.5, 63.45],
      [10.5, 63.42],
    ],
  ],
};

// Polygon et annet sted (Midtbyen-aktig) — skal aldri treffe Ranheim-punkter
const otherBoundary = {
  type: "Polygon",
  coordinates: [
    [
      [10.38, 63.42],
      [10.41, 63.42],
      [10.41, 63.44],
      [10.38, 63.44],
      [10.38, 63.42],
    ],
  ],
};

const ranheimEditorial = {
  hverdagsliv: { body: "Tekst om Ranheim.", highlightCandidates: ["google-ChIJabc"] },
};

function buildMockSupabase(
  overrides: {
    rows?: AreaRow[];
    queryError?: { message: string } | null;
  } = {}
) {
  const error = overrides.queryError ?? null;
  // Registrerer .not()-kall slik at testene kan verifisere at queryen
  // faktisk filtrerer på boundary OG report_editorial server-side.
  const notCalls: Array<[string, string, unknown]> = [];

  // Mocken etterligner PostgREST: .not(col, "is", null) fjerner rader der
  // kolonnen er null — eksklusjons-testen verifiserer dermed QUERY-atferd,
  // ikke bare TypeScript-filtrering.
  function makeChain(rows: AreaRow[]): Record<string, unknown> {
    return {
      not: vi.fn((col: string, op: string, val: unknown) => {
        notCalls.push([col, op, val]);
        const filtered =
          op === "is" && val === null
            ? rows.filter((r) => (r as unknown as Record<string, unknown>)[col] != null)
            : rows;
        return makeChain(filtered);
      }),
      // Thenable — await på chain-objektet gir { data, error }
      then: (resolve: (v: { data: AreaRow[] | null; error: typeof error }) => void) =>
        resolve(error ? { data: null, error } : { data: rows, error: null }),
    };
  }

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => makeChain(overrides.rows ?? [])),
    })),
    notCalls,
  };
}

describe("findAreaForPoint — Unit 2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: punkt i Ranheim-polygon → riktig area-rad", async () => {
    const mockSupabase = buildMockSupabase({
      rows: [
        {
          id: "midtbyen",
          name_no: "Midtbyen",
          level: "strok",
          boundary: otherBoundary,
          report_editorial: { hverdagsliv: { body: "Midtbyen-tekst" } },
        },
        {
          id: "ranheim",
          name_no: "Ranheim",
          level: "strok",
          boundary: ranheimBoundary,
          report_editorial: ranheimEditorial,
        },
      ],
    });
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await findAreaForPoint({ lat: 63.43, lng: 10.52 });

    expect(result.area).not.toBeNull();
    expect(result.area?.id).toBe("ranheim");
    expect(result.area?.name_no).toBe("Ranheim");
    expect(result.area?.report_editorial).toEqual(ranheimEditorial);
    expect(result.warnings).toHaveLength(0);
  });

  it("punkt utenfor alle polygoner → null uten exception (nivå 1-fallback)", async () => {
    const mockSupabase = buildMockSupabase({
      rows: [
        {
          id: "ranheim",
          name_no: "Ranheim",
          level: "strok",
          boundary: ranheimBoundary,
          report_editorial: ranheimEditorial,
        },
      ],
    });
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    // Punkt i Trondheim sentrum — godt utenfor Ranheim-polygonet
    const result = await findAreaForPoint({ lat: 63.43, lng: 10.4 });

    expect(result.area).toBeNull();
    expect(result.warnings).toHaveLength(0);
  });

  it("rad med boundary men uten report_editorial → ekskludert fra oppslaget", async () => {
    const mockSupabase = buildMockSupabase({
      rows: [
        {
          id: "ranheim",
          name_no: "Ranheim",
          level: "strok",
          boundary: ranheimBoundary,
          report_editorial: null, // boundary satt, men ingen kuratering
        },
      ],
    });
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    // Punktet ligger i polygonet — men raden er ikke kuratert og skal ikke arves fra
    const result = await findAreaForPoint({ lat: 63.43, lng: 10.52 });

    expect(result.area).toBeNull();
    // Verifiser at eksklusjonen skjer i QUERYEN (server-side filter), ikke bare i TS
    expect(mockSupabase.notCalls).toContainEqual(["boundary", "is", null]);
    expect(mockSupabase.notCalls).toContainEqual(["report_editorial", "is", null]);
  });

  it("Supabase-feil → null + warning, ingen exception", async () => {
    const mockSupabase = buildMockSupabase({
      queryError: { message: "connection refused" },
    });
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await findAreaForPoint({ lat: 63.43, lng: 10.52 });

    expect(result.area).toBeNull();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("connection refused");
  });

  it("flere overlappende treff → første velges med warning", async () => {
    const overlapping = { ...ranheimBoundary };
    const mockSupabase = buildMockSupabase({
      rows: [
        {
          id: "ranheim",
          name_no: "Ranheim",
          level: "strok",
          boundary: ranheimBoundary,
          report_editorial: ranheimEditorial,
        },
        {
          id: "ranheim-fjaera",
          name_no: "Ranheim fjæra",
          level: "strok",
          boundary: overlapping,
          report_editorial: { transport: { body: "Fjæra-tekst" } },
        },
      ],
    });
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await findAreaForPoint({ lat: 63.43, lng: 10.52 });

    expect(result.area?.id).toBe("ranheim");
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("2 områder");
    expect(result.warnings[0]).toContain("ranheim");
  });

  it("ugyldig boundary-geometri → raden hoppes over med warning", async () => {
    const mockSupabase = buildMockSupabase({
      rows: [
        {
          id: "korrupt",
          name_no: "Korrupt område",
          level: "strok",
          boundary: { type: "Point", coordinates: [10.52, 63.43] },
          report_editorial: ranheimEditorial,
        },
      ],
    });
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await findAreaForPoint({ lat: 63.43, lng: 10.52 });

    expect(result.area).toBeNull();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("korrupt");
  });

  it("ugyldige koordinater → null + warning uten Supabase-kall", async () => {
    const mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await findAreaForPoint({ lat: 999, lng: 10.52 });

    expect(result.area).toBeNull();
    expect(result.warnings).toHaveLength(1);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("Supabase ikke konfigurert → kaster (config-feil, ikke runtime-fallback)", async () => {
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(null);

    await expect(findAreaForPoint({ lat: 63.43, lng: 10.52 })).rejects.toThrow(
      /Supabase ikke konfigurert/
    );
  });
});
