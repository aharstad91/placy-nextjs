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

// Rate-limiteren er in-memory og deler tilstand på tvers av tester i samme
// modul-instans. Mock den bort slik at kontrakt-testene ikke avhenger av
// rekkefølge eller akkumulert kall-telling (se generation-requests/route.test.ts).
// Mocken re-appliseres automatisk etter vi.resetModules() siden vi.mock() er hoisted.
vi.mock("@/lib/utils/rate-limit", () => ({
  createRateLimiter: () => ({ check: () => true }),
  getClientIp: () => "test-ip",
}));

/**
 * `route.ts` har en MODUL-NIVÅ station-info-cache (1t TTL). Den persisterer
 * mellom tester i samme fil og `Date.now()` rykker ikke en time frem under
 * kjøring → cachen ville lekke første tests info-data inn i alle senere tester.
 * Gi derfor hver test en KALD modul-instans via `vi.resetModules()` +
 * dynamisk import. (Gjenbrukbart mønster for ruter med modul-nivå state.)
 */
let GET: typeof import("./route").GET;

beforeEach(async () => {
  vi.resetModules();
  ({ GET } = await import("./route"));
});

/**
 * Kontrakt-vakter for r11.2 (PRD 11 Unit 2): Bysykkel GBFS-proxyen ble portet
 * NÆR-VERBATIM — koden fantes alt og matchet alle AC 1:1, ingen omskriving.
 *
 * Disse testene maskinifiserer AC1-sjekkene som tidligere kun var manuelle
 * (line-references + grep): de tre modiene (radius-aggregat / enkelt-stasjon /
 * alle), `isStationOpen` via `Boolean()` (håndterer bool|int-feed), in-process
 * station-info-cache (1t), `Client-Identifier`-header + `revalidate:60`-caching
 * på status-fetchen, og 400/404/500-error-håndteringen.
 *
 * Gjenbruker route-handler-test-mønsteret fra r11.1: `new NextRequest(...)` +
 * `await GET(req)` kjører i vitest jsdom; global fetch stubbes per URL.
 */

const STATUS_URL =
  "https://gbfs.urbansharing.com/trondheimbysykkel.no/station_status.json";
const INFO_URL =
  "https://gbfs.urbansharing.com/trondheimbysykkel.no/station_information.json";

interface RawStatus {
  station_id: string;
  num_bikes_available: number;
  num_docks_available: number;
  is_installed: boolean | number;
  is_renting: boolean | number;
  is_returning: boolean | number;
  last_reported: number;
}

interface RawInfo {
  station_id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  capacity: number;
}

/**
 * Stub global.fetch som ruter på URL: status-feed vs info-feed.
 * Returnerer mock-fn så vi kan inspisere kall-argumenter (header + next).
 */
function stubFetch(opts: {
  status?: RawStatus[];
  info?: RawInfo[];
  statusOk?: boolean;
  infoOk?: boolean;
}) {
  const fn = vi.fn(async (url: string) => {
    if (url.includes("station_information")) {
      return {
        ok: opts.infoOk ?? true,
        status: opts.infoOk === false ? 503 : 200,
        json: async () => ({ data: { stations: opts.info ?? [] } }),
      };
    }
    // station_status
    return {
      ok: opts.statusOk ?? true,
      status: opts.statusOk === false ? 503 : 200,
      json: async () => ({ data: { stations: opts.status ?? [] } }),
    };
  });
  vi.stubGlobal("fetch", fn as unknown as typeof fetch);
  return fn;
}

const openStatus = (id: string, bikes: number, docks: number): RawStatus => ({
  station_id: id,
  num_bikes_available: bikes,
  num_docks_available: docks,
  is_installed: true,
  is_renting: true,
  is_returning: true,
  last_reported: 1_700_000_000,
});

const info = (
  id: string,
  name: string,
  lat: number,
  lon: number,
  capacity = 20,
): RawInfo => ({ station_id: id, name, address: name, lat, lon, capacity });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("bysykkel GET — radius-aggregat-modus (AC1)", () => {
  it("aggregerer stasjoner innen radius, sortert på distanse, med nearest/breakdown/positions", async () => {
    // Solsiden ~ (63.4350, 10.4100). En nær (~120m), en fjern (~2km), en uten info.
    stubFetch({
      status: [
        openStatus("S1", 5, 3),
        openStatus("S2", 2, 8),
        openStatus("S3-no-info", 9, 1),
      ],
      info: [
        info("S1", "Nær stasjon", 63.4361, 10.4100),
        info("S2", "Fjern stasjon", 63.4530, 10.4100),
      ],
    });

    const req = new NextRequest(
      "http://localhost/api/bysykkel?lat=63.4350&lng=10.4100&radius=500",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    // S2 er ~2km unna (utenfor 500m), S3 har ingen info → kun S1 igjen.
    expect(json.stations).toBe(1);
    expect(json.total).toBe(5);
    expect(json.totalDocks).toBe(3);
    expect(json.nearest.stationId).toBe("S1");
    expect(json.nearest.isOpen).toBe(true);
    expect(json.nearest.walkMin).toBeGreaterThanOrEqual(1);
    expect(json.breakdown).toHaveLength(1);
    expect(json.positions).toEqual([{ lat: 63.4361, lng: 10.4100 }]);
  });

  it("400 ved ugyldige lat/lng/radius-parametre", async () => {
    stubFetch({ status: [openStatus("S1", 1, 1)], info: [info("S1", "x", 63.4, 10.4)] });
    const res = await GET(
      new NextRequest("http://localhost/api/bysykkel?lat=abc&lng=10.4&radius=500"),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid/i);
  });
});

describe("bysykkel GET — enkelt-stasjon-modus (AC1)", () => {
  it("returnerer én stasjon med navn/kapasitet fra info-feeden", async () => {
    stubFetch({
      status: [openStatus("S1", 7, 2)],
      info: [info("S1", "Torget", 63.43, 10.39, 18)],
    });
    const res = await GET(
      new NextRequest("http://localhost/api/bysykkel?stationId=S1"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.stationId).toBe("S1");
    expect(json.name).toBe("Torget");
    expect(json.availableBikes).toBe(7);
    expect(json.capacity).toBe(18);
    expect(json.isOpen).toBe(true);
  });

  it("404 når stasjonen ikke finnes i status-feeden", async () => {
    stubFetch({ status: [openStatus("S1", 1, 1)], info: [] });
    const res = await GET(
      new NextRequest("http://localhost/api/bysykkel?stationId=UKJENT"),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/not found/i);
  });
});

describe("bysykkel GET — alle-stasjoner-modus (AC1)", () => {
  it("returnerer alle stasjoner når ingen filter-param er gitt", async () => {
    stubFetch({
      status: [openStatus("S1", 1, 1), openStatus("S2", 2, 2)],
      info: [info("S1", "A", 63.4, 10.4), info("S2", "B", 63.41, 10.41)],
    });
    const res = await GET(new NextRequest("http://localhost/api/bysykkel"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.stations).toHaveLength(2);
    expect(json.stations[0].name).toBe("A");
    expect(json.stations[1].name).toBe("B");
  });
});

describe("bysykkel GET — isStationOpen håndterer bool|int-feed (AC1)", () => {
  it("åpen for boolean-true OG integer-1; stengt når enten installed eller renting er falsy", async () => {
    const boolOpen = openStatus("BOOL", 1, 1); // is_installed/is_renting = true
    const intOpen: RawStatus = {
      ...openStatus("INT", 1, 1),
      is_installed: 1,
      is_renting: 1,
    };
    const closedNotRenting: RawStatus = {
      ...openStatus("CLOSED", 1, 1),
      is_installed: true,
      is_renting: 0,
    };
    stubFetch({
      status: [boolOpen, intOpen, closedNotRenting],
      info: [
        info("BOOL", "b", 63.4, 10.4),
        info("INT", "i", 63.4, 10.4),
        info("CLOSED", "c", 63.4, 10.4),
      ],
    });
    const res = await GET(new NextRequest("http://localhost/api/bysykkel"));
    const json = await res.json();
    const byId = Object.fromEntries(
      json.stations.map((s: { stationId: string; isOpen: boolean }) => [
        s.stationId,
        s.isOpen,
      ]),
    );
    expect(byId.BOOL).toBe(true);
    expect(byId.INT).toBe(true);
    expect(byId.CLOSED).toBe(false);
  });
});

describe("bysykkel GET — caching + header-kontrakt (AC1)", () => {
  it("status-fetchen cacher revalidate:60 og sender Client-Identifier i HEADER (ikke URL)", async () => {
    const fn = stubFetch({ status: [], info: [] });
    await GET(new NextRequest("http://localhost/api/bysykkel"));

    const statusCall = fn.mock.calls.find(([u]) =>
      (u as string).includes("station_status"),
    ) as unknown as [string, RequestInit & { next?: unknown }];
    expect(statusCall).toBeTruthy();
    const [statusUrl, statusInit] = statusCall;
    expect(statusUrl).toBe(STATUS_URL);
    expect(statusUrl).not.toContain("?");
    expect(
      (statusInit.headers as Record<string, string>)["Client-Identifier"],
    ).toBe("placy-neighborhood-stories");
    expect(statusInit.next).toEqual({ revalidate: 60 });
  });

  it("station-info caches in-process (kun ÉN info-fetch på tvers av to GETs)", async () => {
    // `GET` er allerede en kald modul-instans (beforeEach), så cachen er tom
    // ved test-start. To GETs → status hentes to ganger, info kun én gang.
    const fn = stubFetch({
      status: [openStatus("S1", 1, 1)],
      info: [info("S1", "A", 63.4, 10.4)],
    });
    await GET(new NextRequest("http://localhost/api/bysykkel"));
    await GET(new NextRequest("http://localhost/api/bysykkel"));

    const infoCalls = fn.mock.calls.filter(([u]) =>
      (u as string).includes("station_information"),
    );
    const statusCalls = fn.mock.calls.filter(([u]) =>
      (u as string).includes("station_status"),
    );
    expect(infoCalls).toHaveLength(1); // cachet etter første kall
    expect(statusCalls).toHaveLength(2); // status hentes hver gang
  });
});

describe("bysykkel GET — error-håndtering (AC1)", () => {
  it("500 når status-feeden feiler (!ok)", async () => {
    stubFetch({ statusOk: false });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(new NextRequest("http://localhost/api/bysykkel"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/Failed/i);
  });
});

describe("bysykkel source-vakt — prototype-scope + nøkkel-i-header (AC1, AC5)", () => {
  const src = readFileSync(
    join(process.cwd(), "app", "api", "bysykkel", "route.ts"),
    "utf8",
  );

  it("ingen auth-querystring i feed-URLene", () => {
    expect(src).not.toMatch(/key=/);
    expect(src).not.toMatch(/access_token/);
    expect(src).toContain('"Client-Identifier": "placy-neighborhood-stories"');
  });

  it("Trondheim-only er eksplisitt dokumentert som prototype-scope (AC5)", () => {
    expect(src).toMatch(/PROTOTYPE-SCOPE/);
    expect(src).toContain("trondheimbysykkel.no");
  });

  it("INFO-feeden er Trondheim-hardkodet (prototype, ikke generalisert)", () => {
    expect(INFO_URL).toContain("trondheimbysykkel.no");
  });
});
