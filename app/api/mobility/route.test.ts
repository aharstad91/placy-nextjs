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
 * Kontrakt-vakter for r11.2 (PRD 11 Unit 2): fri-flytende mikromobilitet-proxyen
 * ble portet NÆR-VERBATIM — koden fantes alt og matchet alle AC 1:1.
 *
 * Maskinifiserer AC3: koordinat-bounds + radius-guard + `VALID_FORM_FACTORS`-
 * whitelist + `MAX_RADIUS=2000`-klemming, `ET-Client-Name`-header, `byOperator`-
 * aggregat + `positions[]`, og 500-error-håndtering. Distinkt-rute mot hyre (AC4).
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

const vehicle = (id: string, lat: number, lon: number, sysId: string, sysName: string) => ({
  id,
  lat,
  lon,
  system: { id: sysId, name: { translation: [{ value: sysName }] } },
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("mobility GET — aggregat + positions (AC3)", () => {
  it("aggregerer byOperator (sortert desc) og returnerer positions[] + ekko av radius/formFactors", async () => {
    const fn = stubFetchOk({
      data: {
        vehicles: [
          vehicle("v1", 63.42, 10.45, "ryde", "Ryde"),
          vehicle("v2", 63.421, 10.451, "ryde", "Ryde"),
          vehicle("v3", 63.422, 10.452, "voi", "Voi"),
        ],
      },
    });
    const res = await GET(
      new NextRequest(
        "http://localhost/api/mobility?lat=63.42&lng=10.45&radius=750&formFactors=SCOOTER",
      ),
    );
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.total).toBe(3);
    expect(json.byOperator).toEqual([
      { systemId: "ryde", name: "Ryde", count: 2 },
      { systemId: "voi", name: "Voi", count: 1 },
    ]);
    expect(json.positions).toEqual([
      { lat: 63.42, lng: 10.45 },
      { lat: 63.421, lng: 10.451 },
      { lat: 63.422, lng: 10.452 },
    ]);
    expect(json.radius).toBe(750);
    expect(json.formFactors).toEqual(["SCOOTER"]);

    // formFactors-whitelist sendes til API.
    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(init.body as string);
    expect(sent.variables.formFactors).toEqual(["SCOOTER"]);
  });

  it("default formFactors = SCOOTER,SCOOTER_STANDING når param mangler", async () => {
    const fn = stubFetchOk({ data: { vehicles: [] } });
    const res = await GET(
      new NextRequest("http://localhost/api/mobility?lat=63.42&lng=10.45"),
    );
    expect(res.status).toBe(200);
    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(init.body as string);
    expect(sent.variables.formFactors).toEqual(["SCOOTER", "SCOOTER_STANDING"]);
  });
});

describe("mobility GET — input-guards (AC3)", () => {
  it("400 ved koordinater utenfor Norge-bounds (treffer aldri ekstern API)", async () => {
    const fn = stubFetchOk({});
    const res = await GET(
      new NextRequest("http://localhost/api/mobility?lat=10&lng=10&radius=500"),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/coordinates/i);
    expect(fn).not.toHaveBeenCalled();
  });

  it("400 ved radius under 100m", async () => {
    const fn = stubFetchOk({});
    const res = await GET(
      new NextRequest("http://localhost/api/mobility?lat=63.42&lng=10.45&radius=50"),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/radius/i);
    expect(fn).not.toHaveBeenCalled();
  });

  it("400 når ingen gyldige formFactors er igjen etter whitelist-filter", async () => {
    const fn = stubFetchOk({});
    const res = await GET(
      new NextRequest(
        "http://localhost/api/mobility?lat=63.42&lng=10.45&formFactors=PLANE,BOAT",
      ),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/formFactors/i);
    expect(fn).not.toHaveBeenCalled();
  });

  it("MAX_RADIUS=2000 klemmer for stor radius", async () => {
    const fn = stubFetchOk({ data: { vehicles: [] } });
    const res = await GET(
      new NextRequest("http://localhost/api/mobility?lat=63.42&lng=10.45&radius=9999"),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).radius).toBe(2000);
    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).variables.range).toBe(2000);
  });
});

describe("mobility GET — header + caching (AC3)", () => {
  it("sender ET-Client-Name i HEADER, URL uten querystring-nøkkel, revalidate:30", async () => {
    const fn = stubFetchOk({ data: { vehicles: [] } });
    await GET(
      new NextRequest("http://localhost/api/mobility?lat=63.42&lng=10.45"),
    );
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

describe("mobility GET — error-håndtering (AC3)", () => {
  it("500 ved ekstern feil (!response.ok)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) })) as unknown as typeof fetch,
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(
      new NextRequest("http://localhost/api/mobility?lat=63.42&lng=10.45"),
    );
    expect(res.status).toBe(500);
  });

  it("500 ved GraphQL-errors i body", async () => {
    stubFetchOk({ errors: [{ message: "boom" }] });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(
      new NextRequest("http://localhost/api/mobility?lat=63.42&lng=10.45"),
    );
    expect(res.status).toBe(500);
  });
});

describe("mobility source-vakt — whitelist, MAX_RADIUS + distinkt rute (AC3, AC4)", () => {
  const src = readFileSync(
    join(process.cwd(), "app", "api", "mobility", "route.ts"),
    "utf8",
  );

  it("MAX_RADIUS=2000 og VALID_FORM_FACTORS inkluderer CAR (fri-flytende støtter bil)", () => {
    expect(src).toContain("MAX_RADIUS = 2000");
    expect(src).toMatch(/VALID_FORM_FACTORS\s*=\s*new Set\(/);
    expect(src).toContain('"CAR"');
  });

  it("er fri-flytende (vehicles-query) — distinkt fra station-basert hyre (AC4)", () => {
    expect(src).toContain("vehicles(");
    // Bekrefter at mobility IKKE bruker hyre sin station-query.
    expect(src).not.toContain('systems: ["hyrenorge"]');
  });

  it("nøkkel/klient-ID kun i ET-Client-Name-header, ingen querystring-nøkkel", () => {
    expect(src).toContain('"ET-Client-Name": "placy-neighborhood-stories"');
    expect(src).not.toMatch(/key=/);
  });
});
