import {
  describe,
  it,
  expect,
  vi,
  afterEach,
} from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { GET } from "./route";

/**
 * Kontrakt-vakter for r11.2 (PRD 11 Unit 2): Hyre car-share-proxyen ble portet
 * NÆR-VERBATIM — koden fantes alt og matchet alle AC 1:1, ingen omskriving.
 *
 * Maskinifiserer AC2: `STATION_ID_PATTERN`-input-guard (ugyldig→400),
 * Trondheim-vid query + filtrer på id, `ET-Client-Name`-header, `revalidate:30`
 * og 404/500-error-håndtering. Distinkt-rute-bekreftelse (AC4) mot mobility.
 */

const MOBILITY_URL = "https://api.entur.io/mobility/v2/graphql";

function stubFetchOk(body: unknown) {
  const fn = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fn as unknown as typeof fetch);
  return fn;
}

const station = (id: string, name: string, n: number) => ({
  id,
  name: { translation: [{ value: name }] },
  numVehiclesAvailable: n,
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("hyre GET — station-oppslag (AC2)", () => {
  it("filtrerer på id fra Trondheim-vid query og returnerer navn + antall", async () => {
    const fn = stubFetchOk({
      data: {
        stations: [
          station("YHY:Station:1", "Solsiden", 3),
          station("YHY:Station:2", "Bakklandet", 0),
        ],
      },
    });
    const res = await GET(
      new NextRequest("http://localhost/api/hyre?stationId=YHY:Station:1"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.stationName).toBe("Solsiden");
    expect(json.numVehiclesAvailable).toBe(3);

    // Trondheim-vid query (range 15000 rundt 63.43/10.4) sendes i POST-body.
    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(init.body as string);
    expect(sent.variables).toMatchObject({ lat: 63.43, lon: 10.4, range: 15000 });
  });

  it("numVehiclesAvailable defaulter til 0 når feltet mangler", async () => {
    stubFetchOk({
      data: { stations: [{ id: "YHY:Station:9", name: { translation: [] } }] },
    });
    const res = await GET(
      new NextRequest("http://localhost/api/hyre?stationId=YHY:Station:9"),
    );
    const json = await res.json();
    expect(json.stationName).toBe("Unknown");
    expect(json.numVehiclesAvailable).toBe(0);
  });
});

describe("hyre GET — input-guards (AC2)", () => {
  it("400 når stationId mangler (treffer aldri ekstern API)", async () => {
    const fn = stubFetchOk({});
    const res = await GET(new NextRequest("http://localhost/api/hyre"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/required/i);
    expect(fn).not.toHaveBeenCalled();
  });

  it("400 ved ugyldig stationId-format (STATION_ID_PATTERN, ingen ekstern fetch)", async () => {
    const fn = stubFetchOk({});
    const res = await GET(
      new NextRequest(
        "http://localhost/api/hyre?stationId=" + encodeURIComponent("bad id!"),
      ),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid/i);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("hyre GET — header + caching (AC2)", () => {
  it("sender ET-Client-Name i HEADER, URL uten querystring-nøkkel, revalidate:30", async () => {
    const fn = stubFetchOk({ data: { stations: [] } });
    await GET(new NextRequest("http://localhost/api/hyre?stationId=YHY:Station:1"));

    const [url, init] = fn.mock.calls[0] as unknown as [
      string,
      RequestInit & { next?: unknown },
    ];
    expect(url).toBe(MOBILITY_URL);
    expect(url).not.toContain("?");
    expect((init.headers as Record<string, string>)["ET-Client-Name"]).toBe(
      "placy-neighborhood-stories",
    );
    expect(init.next).toEqual({ revalidate: 30 });
  });
});

describe("hyre GET — error-håndtering (AC2)", () => {
  it("404 når stasjonen ikke finnes i resultatet", async () => {
    stubFetchOk({ data: { stations: [station("YHY:Station:2", "Annen", 1)] } });
    const res = await GET(
      new NextRequest("http://localhost/api/hyre?stationId=YHY:Station:1"),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/not found/i);
  });

  it("500 ved ekstern feil (!response.ok)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) })) as unknown as typeof fetch,
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(
      new NextRequest("http://localhost/api/hyre?stationId=YHY:Station:1"),
    );
    expect(res.status).toBe(500);
  });

  it("500 ved GraphQL-errors i body", async () => {
    stubFetchOk({ errors: [{ message: "boom" }] });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(
      new NextRequest("http://localhost/api/hyre?stationId=YHY:Station:1"),
    );
    expect(res.status).toBe(500);
  });
});

describe("hyre source-vakt — prototype-scope + distinkt rute (AC2, AC4, AC5)", () => {
  const src = readFileSync(
    join(process.cwd(), "app", "api", "hyre", "route.ts"),
    "utf8",
  );

  it("Trondheim-senter eksplisitt dokumentert som prototype-scope (AC5)", () => {
    expect(src).toMatch(/PROTOTYPE-SCOPE/);
    expect(src).toContain("Trondheim center");
  });

  it("nøkkel/klient-ID kun i ET-Client-Name-header, ingen querystring-nøkkel", () => {
    expect(src).toContain('"ET-Client-Name": "placy-neighborhood-stories"');
    expect(src).not.toMatch(/key=/);
  });

  it("er station-basert car-share (systems hyrenorge, availableFormFactors CAR) — distinkt fra fri-flytende mobility (AC4)", () => {
    expect(src).toContain('systems: ["hyrenorge"]');
    expect(src).toContain("availableFormFactors: [CAR]");
    expect(src).toContain("stations(");
    // Bekrefter at hyre IKKE bruker vehicles-queryen (det er mobility sin).
    expect(src).not.toContain("vehicles(");
  });
});
