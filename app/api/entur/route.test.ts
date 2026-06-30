import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

/**
 * Kontrakt-vakter for r11.1 (PRD 11 Unit 1): Entur kollektiv-proxyen ble portet
 * NÆR-VERBATIM — koden fantes alt og matchet alle 5 AC 1:1, ingen omskriving.
 *
 * Disse testene maskinifiserer AC-sjekkene som tidligere kun var manuelle
 * (line-references + grep): den doble respons-formen (quays[] + flat
 * departures[]), POST-reiseplanlegging, nøkkel-i-header-aldri-URL-kontrakten,
 * `revalidate:30`-cachingen og 400/404/500-error-håndteringen.
 */

const ENTUR_API_URL = "https://api.entur.io/journey-planner/v3/graphql";

/** Bygg en rå estimatedCall (Entur JourneyPlanner v3-form). */
function rawCall(opts: {
  expected: string;
  actual?: string | null;
  realtime?: boolean;
  frontText?: string;
  publicCode?: string;
  transportMode?: string;
  colour?: string;
}) {
  return {
    expectedDepartureTime: opts.expected,
    actualDepartureTime: opts.actual ?? null,
    realtime: opts.realtime ?? true,
    destinationDisplay: { frontText: opts.frontText ?? "Sentrum" },
    serviceJourney: {
      line: {
        publicCode: opts.publicCode ?? "3",
        transportMode: opts.transportMode ?? "bus",
        presentation: { colour: opts.colour ?? "E60000", textColour: "FFFFFF" },
      },
    },
  };
}

/** Stub global.fetch med en GraphQL-respons (ok=true) og fang kall-argumentene. */
function stubFetchOk(body: unknown) {
  const fn = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fn as unknown as typeof fetch);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("entur GET — dobbel respons-form (AC1)", () => {
  beforeEach(() => {
    stubFetchOk({
      data: {
        stopPlace: {
          id: "NSR:StopPlace:1",
          name: "Prinsens gate",
          quays: [
            {
              id: "NSR:Quay:A",
              estimatedCalls: [
                rawCall({ expected: "2026-06-30T10:00:00+02:00", publicCode: "3" }),
                rawCall({ expected: "2026-06-30T10:10:00+02:00", publicCode: "3" }),
              ],
            },
            {
              id: "NSR:Quay:B",
              estimatedCalls: [
                rawCall({
                  expected: "2026-06-30T10:05:00+02:00",
                  actual: "2026-06-30T10:06:00+02:00",
                  publicCode: "9",
                }),
              ],
            },
            // Quay uten avganger — skal filtreres bort.
            { id: "NSR:Quay:C", estimatedCalls: [] },
          ],
        },
      },
    });
  });

  it("returnerer både quays[] (per retning) og flat departures[] (første per quay)", async () => {
    const req = new NextRequest("http://localhost/api/entur?stopPlaceId=NSR:StopPlace:1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    // quays[]: tomme quays filtrert bort (C droppet), to retninger igjen.
    expect(json.quays).toHaveLength(2);
    expect(json.quays[0].quayId).toBe("NSR:Quay:A");
    expect(json.quays[0].departures).toHaveLength(2);

    // flat departures[]: nøyaktig én per gjenværende quay (første), for tooltips.
    expect(json.departures).toHaveLength(2);
    expect(json.departures[0]).toEqual(json.quays[0].departures[0]);
    expect(json.departures[1]).toEqual(json.quays[1].departures[0]);

    // formatCall: actual vinner over expected, realtime + linje-felt bevart.
    expect(json.departures[1].departureTime).toBe("2026-06-30T10:06:00+02:00");
    expect(json.departures[1].lineCode).toBe("9");
    expect(json.departures[1].lineColor).toBe("E60000");
    expect(json.departures[1].isRealtime).toBe(true);
    expect(json.stopPlace).toEqual({ id: "NSR:StopPlace:1", name: "Prinsens gate" });
  });
});

describe("entur GET — nøkkel-i-header + caching (AC2 + AC4)", () => {
  it("sender ET-Client-Name i HEADER, treffer URL uten querystring, og cacher revalidate:30", async () => {
    const fn = stubFetchOk({
      data: { stopPlace: { id: "x", name: "y", quays: [] } },
    });
    const req = new NextRequest("http://localhost/api/entur?stopPlaceId=NSR:StopPlace:1");
    await GET(req);

    expect(fn).toHaveBeenCalledTimes(1);
    const [url, init] = fn.mock.calls[0] as unknown as [
      string,
      RequestInit & { next?: unknown },
    ];

    // Nøkkel/klient-ID i header, aldri i URL.
    expect(url).toBe(ENTUR_API_URL);
    expect(url).not.toContain("?");
    expect((init.headers as Record<string, string>)["ET-Client-Name"]).toBe(
      "placy-neighborhood-stories",
    );

    // Caching-kontrakt bevart.
    expect(init.next).toEqual({ revalidate: 30 });
  });
});

describe("entur GET — error-håndtering (AC3)", () => {
  it("400 når stopPlaceId mangler (treffer aldri ekstern API)", async () => {
    const fn = stubFetchOk({});
    const res = await GET(new NextRequest("http://localhost/api/entur"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/stopPlaceId/i);
    expect(fn).not.toHaveBeenCalled();
  });

  it("404 når stopPlace ikke finnes", async () => {
    stubFetchOk({ data: { stopPlace: null } });
    const res = await GET(
      new NextRequest("http://localhost/api/entur?stopPlaceId=ukjent"),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/not found/i);
  });

  it("500 ved ekstern feil (!response.ok)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch,
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(
      new NextRequest("http://localhost/api/entur?stopPlaceId=NSR:StopPlace:1"),
    );
    expect(res.status).toBe(500);
  });

  it("500 ved GraphQL-errors i body", async () => {
    stubFetchOk({ errors: [{ message: "boom" }] });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(
      new NextRequest("http://localhost/api/entur?stopPlaceId=NSR:StopPlace:1"),
    );
    expect(res.status).toBe(500);
  });
});

describe("entur POST — reiseplanlegging (AC1)", () => {
  it("returnerer trips[] med minutt-avrundet duration + ET-Client-Name-header", async () => {
    const fn = stubFetchOk({
      data: {
        trip: {
          tripPatterns: [
            {
              duration: 605,
              walkDistance: 123.4,
              legs: [
                {
                  mode: "foot",
                  distance: 100.6,
                  duration: 120,
                  fromPlace: { name: "Hjem" },
                  toPlace: { name: "Holdeplass" },
                  line: null,
                },
                {
                  mode: "bus",
                  distance: 2000,
                  duration: 480,
                  fromPlace: { name: "Holdeplass" },
                  toPlace: { name: "Sentrum" },
                  line: { publicCode: "3", name: "Buss 3", transportMode: "bus" },
                },
              ],
            },
          ],
        },
      },
    });

    const req = new NextRequest("http://localhost/api/entur", {
      method: "POST",
      body: JSON.stringify({ fromLat: 63.4, fromLng: 10.4, toLat: 63.43, toLng: 10.39 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.trips).toHaveLength(1);
    expect(json.trips[0].duration).toBe(11); // ceil(605/60)
    expect(json.trips[0].walkDistance).toBe(123); // round(123.4)
    expect(json.trips[0].legs).toHaveLength(2);
    expect(json.trips[0].legs[1].lineCode).toBe("3");

    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["ET-Client-Name"]).toBe(
      "placy-neighborhood-stories",
    );
  });

  it("400 når from/to-koordinater mangler", async () => {
    const fn = stubFetchOk({});
    const req = new NextRequest("http://localhost/api/entur", {
      method: "POST",
      body: JSON.stringify({ fromLat: 63.4 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("entur source-vakt — ingen nøkkel i URL (AC2, speiler grep)", () => {
  const src = readFileSync(join(process.cwd(), "app", "api", "entur", "route.ts"), "utf8");

  it("URL-konstanten har ingen auth-querystring", () => {
    expect(src).toContain('ENTUR_API_URL = "https://api.entur.io/journey-planner/v3/graphql"');
    expect(src).not.toMatch(/key=/);
    expect(src).not.toMatch(/access_token/);
  });

  it("klient-ID sendes kun i ET-Client-Name-header", () => {
    expect(src).toContain('"ET-Client-Name": "placy-neighborhood-stories"');
  });
});
