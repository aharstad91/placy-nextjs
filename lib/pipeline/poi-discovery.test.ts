import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  discoverGooglePlaces,
  discoverEnturStops,
  discoverBysykkelStations,
  generatePoiId,
  GOOGLE_CATEGORY_MAP,
} from "./poi-discovery";

/**
 * Regresjonsvern for discovery-motoren (601 linjer, tidligere 0 tester).
 * Fokus: STILLE feilmoduser — filtre som dropper eller slipper gjennom POI-er
 * uten å kaste, kategori-fallback uten tema-hjem, og ID-stabilitet (dedup-
 * nøkkelen på tvers av kjøringer).
 */

const CENTER = { lat: 63.43, lng: 10.4 };
// ~110 m nord for sentrum — godt innenfor alle kategori-avstandsgrenser
const NEAR = { latitude: 63.431, longitude: 10.4 };

function googlePlace(o: {
  id: string;
  name: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  rating?: number;
  reviews?: number;
  status?: string;
}) {
  return {
    id: o.id,
    displayName: { text: o.name },
    location: o.location ?? NEAR,
    ...(o.types !== undefined && { types: o.types }),
    rating: o.rating ?? 4.4,
    userRatingCount: o.reviews ?? 40,
    businessStatus: o.status ?? "OPERATIONAL",
  };
}

function placesResponse(places: unknown[]) {
  return { ok: true, status: 200, json: async () => ({ places }) };
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  fetchMock.mockReset();
  // Demp discovery-modulens console-logging i testene
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function baseConfig(categories: string[], overrides: Record<string, unknown> = {}) {
  return {
    center: CENTER,
    radius: 2000,
    googleCategories: categories,
    ...overrides,
  };
}

describe("discoverGooglePlaces — kategori-resolusjon", () => {
  it("ukjent kategori → fallback-kategori {id: <kategorinavn>, MapPin, grå} (stille — kan mangle tema-hjem)", async () => {
    // Fallbacken kaster ikke og varsler ikke. report-defaults.test.ts vokter at
    // bestilte kategorier finnes i GOOGLE_CATEGORY_MAP; denne pinner selve
    // fallback-formen så en endring i den er synlig.
    fetchMock.mockResolvedValueOnce(
      placesResponse([googlePlace({ id: "p1", name: "Blomsterbua", types: ["florist"] })])
    );

    const result = await discoverGooglePlaces(baseConfig(["florist"]), "key");

    expect(result).toHaveLength(1);
    expect(result[0].category).toEqual({
      id: "florist",
      name: "florist",
      icon: "MapPin",
      color: "#6b7280",
    });
  });

  it("kjent kategori → kategori-objektet fra GOOGLE_CATEGORY_MAP (movie_theater → cinema)", async () => {
    fetchMock.mockResolvedValueOnce(
      placesResponse([googlePlace({ id: "p1", name: "Nova Kino", types: ["movie_theater"] })])
    );

    const result = await discoverGooglePlaces(baseConfig(["movie_theater"]), "key");

    expect(result[0].category).toEqual(GOOGLE_CATEGORY_MAP.movie_theater);
    expect(result[0].category.id).toBe("cinema");
  });
});

describe("discoverGooglePlaces — filterkjeden (stille dropp/slipp)", () => {
  it("type-mismatch droppes stille (stadion returnert for hotel-søk)", async () => {
    fetchMock.mockResolvedValueOnce(
      placesResponse([
        googlePlace({ id: "stadium1", name: "Lerkendal Stadion", types: ["stadium"] }),
        googlePlace({ id: "hotel1", name: "Scandic Lerkendal", types: ["lodging"] }),
      ])
    );

    const result = await discoverGooglePlaces(baseConfig(["hotel"]), "key");

    expect(result.map((p) => p.name)).toEqual(["Scandic Lerkendal"]);
  });

  it("place UTEN types-felt passerer type-filteret (fail-open — pinnet bevisst)", async () => {
    fetchMock.mockResolvedValueOnce(
      placesResponse([googlePlace({ id: "h1", name: "Hotell Uten Types" })])
    );

    const result = await discoverGooglePlaces(baseConfig(["hotel"]), "key");

    expect(result).toHaveLength(1);
  });

  it("avstand > radius droppes (Google behandler radius som preferanse, vi håndhever)", async () => {
    fetchMock.mockResolvedValueOnce(
      placesResponse([
        googlePlace({ id: "far", name: "Fjern Kafé", types: ["cafe"], location: { latitude: 63.5, longitude: 10.4 } }), // ~7.8 km
        googlePlace({ id: "near", name: "Nær Kafé", types: ["cafe"] }),
      ])
    );

    const result = await discoverGooglePlaces(baseConfig(["cafe"]), "key");

    expect(result.map((p) => p.name)).toEqual(["Nær Kafé"]);
  });

  it("minRating: under terskel droppes, men POI UTEN rating passerer (fail-open — pinnet bevisst)", async () => {
    fetchMock.mockResolvedValueOnce(
      placesResponse([
        googlePlace({ id: "low", name: "Lav Kafé", types: ["cafe"], rating: 3.0 }),
        // Uten rating men med reviews — passerer både minRating (fail-open) og kvalitetssignal-sjekken
        { ...googlePlace({ id: "none", name: "Uratet Kafé", types: ["cafe"], reviews: 12 }), rating: undefined },
        googlePlace({ id: "high", name: "Høy Kafé", types: ["cafe"], rating: 4.6 }),
      ])
    );

    const result = await discoverGooglePlaces(baseConfig(["cafe"], { minRating: 4.0 }), "key");

    expect(result.map((p) => p.name).sort()).toEqual(["Høy Kafé", "Uratet Kafé"]);
  });

  it("delvise objekter (manglende navn/location) hoppes over uten kast", async () => {
    fetchMock.mockResolvedValueOnce(
      placesResponse([
        { id: "no-name", location: NEAR, types: ["cafe"] },
        { id: "no-loc", displayName: { text: "Uten Posisjon" }, types: ["cafe"] },
        googlePlace({ id: "ok", name: "Komplett Kafé", types: ["cafe"] }),
      ])
    );

    const result = await discoverGooglePlaces(baseConfig(["cafe"]), "key");

    expect(result.map((p) => p.name)).toEqual(["Komplett Kafé"]);
  });

  it("maxResultsPerCategory capper antallet per kategori", async () => {
    fetchMock.mockResolvedValueOnce(
      placesResponse([
        googlePlace({ id: "a", name: "Kafé A", types: ["cafe"] }),
        googlePlace({ id: "b", name: "Kafé B", types: ["cafe"] }),
        googlePlace({ id: "c", name: "Kafé C", types: ["cafe"] }),
      ])
    );

    const result = await discoverGooglePlaces(
      baseConfig(["cafe"], { maxResultsPerCategory: 2 }),
      "key"
    );

    expect(result).toHaveLength(2);
  });
});

describe("discoverGooglePlaces — feilhåndtering og dedup", () => {
  it("HTTP-feil for ÉN kategori → kategorien mangler STILLE, resten leveres, ingen kast (rapportert funn: ingen warnings-kanal til kalleren)", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) }) // restaurant feiler
      .mockResolvedValueOnce(
        placesResponse([googlePlace({ id: "c1", name: "Kafé OK", types: ["cafe"] })])
      );

    const result = await discoverGooglePlaces(baseConfig(["restaurant", "cafe"]), "key");

    // Hele restaurant-kategorien er borte fra boardet uten at kalleren kan
    // oppdage det (kun console.error) — samme klasse som Barn & Oppvekst-bugen.
    expect(result.map((p) => p.category.id)).toEqual(["cafe"]);
  });

  it("nettverksfeil (fetch kaster) for én kategori → samme stille fail-soft", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(
        placesResponse([googlePlace({ id: "c1", name: "Kafé OK", types: ["cafe"] })])
      );

    const result = await discoverGooglePlaces(baseConfig(["restaurant", "cafe"]), "key");

    expect(result).toHaveLength(1);
  });

  it("samme place.id i to kategorier → dedup, FØRSTE kategori i bestillingslista vinner", async () => {
    const shared = { id: "dual", name: "Bakeri & Kafé", types: ["bakery", "cafe"] };
    fetchMock
      .mockResolvedValueOnce(placesResponse([googlePlace(shared)])) // bakery-søk
      .mockResolvedValueOnce(placesResponse([googlePlace(shared)])); // cafe-søk

    const result = await discoverGooglePlaces(baseConfig(["bakery", "cafe"]), "key");

    expect(result).toHaveLength(1);
    expect(result[0].category.id).toBe("bakery");
  });

  it("API-nøkkel sendes i X-Goog-Api-Key-header, ALDRI i URL (CLAUDE.md-regel: nøkler leker i logs)", async () => {
    fetchMock.mockResolvedValueOnce(placesResponse([]));

    await discoverGooglePlaces(baseConfig(["cafe"]), "hemmelig-nokkel");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("hemmelig-nokkel");
    expect((init.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe("hemmelig-nokkel");
  });
});

describe("generatePoiId — ID-stabilitet (dedup-nøkkel på tvers av kjøringer)", () => {
  it("ekstern ID: kolon vaskes til bindestrek (Entur NSR:StopPlace:337)", () => {
    expect(generatePoiId("entur", "Rotvoll", "NSR:StopPlace:337")).toBe(
      "entur-NSR-StopPlace-337"
    );
  });

  it("google place-id brukes verbatim med source-prefiks", () => {
    expect(generatePoiId("google", "Kafé", "ChIJN1t_tDeu")).toBe("google-ChIJN1t_tDeu");
  });

  it("uten ekstern ID: fallback til slugifisert navn", () => {
    expect(generatePoiId("google", "Cafe Lokka")).toBe("google-cafe-lokka");
  });
});

describe("discoverEnturStops — transportmodus-mapping", () => {
  function enturResponse(places: Array<Record<string, unknown>>) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          nearest: {
            edges: places.map((place) => ({ node: { place, distance: 100 } })),
          },
        },
      }),
    };
  }

  const NEAR_STOP = { latitude: 63.431, longitude: 10.4 };

  it("rail → train-kategori + ' stasjon'-suffix; eksisterende 'stasjon' i navnet dobles ikke", async () => {
    fetchMock.mockResolvedValueOnce(
      enturResponse([
        { id: "NSR:StopPlace:1", name: "Rotvoll", ...NEAR_STOP, transportMode: ["rail"] },
        { id: "NSR:StopPlace:2", name: "Leangen stasjon", ...NEAR_STOP, transportMode: ["rail"] },
      ])
    );

    const result = await discoverEnturStops({ center: CENTER, radius: 2000 });

    expect(result.map((p) => p.name)).toEqual(["Rotvoll stasjon", "Leangen stasjon"]);
    expect(result.every((p) => p.category.id === "train")).toBe(true);
  });

  it("uten kjent modus (f.eks. water) → bus-kategori med bussholdeplass-suffix (pinnet nåværende fallback)", async () => {
    // Fergekaier blir stille «bussholdeplass» — pinnet slik at en bevisst
    // endring (egen ferge-kategori) blir synlig her.
    fetchMock.mockResolvedValueOnce(
      enturResponse([
        { id: "NSR:StopPlace:9", name: "Ravnkloa", ...NEAR_STOP, transportMode: ["water"] },
      ])
    );

    const result = await discoverEnturStops({ center: CENTER, radius: 2000 });

    expect(result[0].category.id).toBe("bus");
    expect(result[0].name).toBe("Ravnkloa bussholdeplass");
  });

  it("GraphQL-feil i responsen → [] uten kast (stille tap av transport)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ errors: [{ message: "rate limited" }] }),
    });

    const result = await discoverEnturStops({ center: CENTER, radius: 2000 });

    expect(result).toEqual([]);
  });

  it("bussholdeplass utenfor gangavstands-grensen (10 min × 80 m) droppes selv innenfor radius", async () => {
    fetchMock.mockResolvedValueOnce(
      enturResponse([
        // ~1.1 km — innenfor radius 2000, men over buss-grensen på 800 m
        { id: "NSR:StopPlace:5", name: "Fjern holdeplass", latitude: 63.44, longitude: 10.4, transportMode: ["bus"] },
        { id: "NSR:StopPlace:6", name: "Nær holdeplass", ...NEAR_STOP, transportMode: ["bus"] },
      ])
    );

    const result = await discoverEnturStops({ center: CENTER, radius: 2000 });

    expect(result.map((p) => p.enturStopplaceId)).toEqual(["NSR:StopPlace:6"]);
  });
});

describe("discoverBysykkelStations", () => {
  it("stasjoner innenfor radius prefikses 'Trondheim Bysykkel: ', utenfor filtreres", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          stations: [
            { station_id: "42", name: "Solsiden", address: "Beddingen 1", lat: 63.431, lon: 10.4, capacity: 20 },
            { station_id: "43", name: "Langt Unna", address: "Fjernveien 1", lat: 63.5, lon: 10.4, capacity: 10 },
          ],
        },
      }),
    });

    const result = await discoverBysykkelStations({ center: CENTER, radius: 2000 });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Trondheim Bysykkel: Solsiden");
    expect(result[0].category.id).toBe("bike");
    expect(result[0].bysykkelStationId).toBe("42");
  });

  it("API-feil → [] uten kast", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });

    const result = await discoverBysykkelStations({ center: CENTER, radius: 2000 });

    expect(result).toEqual([]);
  });
});
