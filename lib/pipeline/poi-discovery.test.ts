import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  discoverGooglePlaces,
  discoverEnturStops,
  discoverBysykkelStations,
  generatePoiId,
  subdivideCircle,
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
    // florist ble kjent kategori i recall-fiksen 2026-08-12 — aquarium er
    // fortsatt umappet og pinner fallback-formen.
    fetchMock.mockResolvedValueOnce(
      placesResponse([googlePlace({ id: "p1", name: "Akvariet", types: ["aquarium"] })])
    );

    const result = await discoverGooglePlaces(baseConfig(["aquarium"]), "key");

    expect(result).toHaveLength(1);
    expect(result[0].category).toEqual({
      id: "aquarium",
      name: "aquarium",
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

  it("INGEN per-kategori-cap — alt som passerer filtrene leveres (cap fjernet 2026-08-24)", async () => {
    fetchMock.mockResolvedValueOnce(
      placesResponse([
        googlePlace({ id: "a", name: "Kafé A", types: ["cafe"] }),
        googlePlace({ id: "b", name: "Kafé B", types: ["cafe"] }),
        googlePlace({ id: "c", name: "Kafé C", types: ["cafe"] }),
      ])
    );

    const result = await discoverGooglePlaces(baseConfig(["cafe"]), "key");

    expect(result).toHaveLength(3);
  });
});

describe("subdivideCircle — dekning av modersirkelen", () => {
  it("gir fire delsirkler, ett hakk dypere", () => {
    const subs = subdivideCircle({ lat: 63.43, lng: 10.4, radius: 3000, depth: 0 });
    expect(subs).toHaveLength(4);
    expect(subs.every((c) => c.depth === 1)).toBe(true);
  });

  it("dekker HELE modersirkelen — verste punkt på kanten treffes", () => {
    // Kravet: for hvert punkt på modersirkelens kant finnes en delsirkel som
    // inneholder det. Verste tilfelle er kanten midt mellom to nabosentre.
    const root = { lat: 63.43, lng: 10.4, radius: 3000, depth: 0 };
    const subs = subdivideCircle(root);
    const mLat = 110_540;
    const mLng = 111_320 * Math.cos((root.lat * Math.PI) / 180);

    for (let deg = 0; deg < 360; deg += 1) {
      const rad = (deg * Math.PI) / 180;
      const edge = {
        lat: root.lat + (root.radius * Math.sin(rad)) / mLat,
        lng: root.lng + (root.radius * Math.cos(rad)) / mLng,
      };
      const covered = subs.some((c) => {
        const dx = (edge.lng - c.lng) * mLng;
        const dy = (edge.lat - c.lat) * mLat;
        return Math.hypot(dx, dy) <= c.radius;
      });
      expect(covered, `kantpunkt ved ${deg}° er udekket`).toBe(true);
    }
  });
});

describe("discoverGooglePlaces — metnings-drevet oppdeling", () => {
  /** 20 treff = API-taket → «det finnes mer her». */
  function saturatedResponse(prefix: string) {
    return placesResponse(
      Array.from({ length: 20 }, (_, i) =>
        googlePlace({ id: `${prefix}-${i}`, name: `Kafé ${prefix}${i}`, types: ["cafe"] })
      )
    );
  }

  it("ikke mettet (under 20 treff) → ETT kall, ingen oppdeling", async () => {
    fetchMock.mockResolvedValueOnce(
      placesResponse([googlePlace({ id: "a", name: "Kafé A", types: ["cafe"] })])
    );

    await discoverGooglePlaces(baseConfig(["cafe"]), "key");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("mettet rot → deles i fire; delsirklene er ikke mettet → 5 kall totalt", async () => {
    fetchMock.mockResolvedValueOnce(saturatedResponse("rot"));
    for (const q of ["q1", "q2", "q3", "q4"]) {
      fetchMock.mockResolvedValueOnce(
        placesResponse([googlePlace({ id: q, name: `Kafé ${q}`, types: ["cafe"] })])
      );
    }

    const result = await discoverGooglePlaces(baseConfig(["cafe"]), "key");

    expect(fetchMock).toHaveBeenCalledTimes(5);
    // 20 fra rota + 4 unike fra delsirklene
    expect(result).toHaveLength(24);
  });

  it("mettet hele veien ned → stopper på dybde 2 (1 + 4 + 16 = 21 kall)", async () => {
    let n = 0;
    fetchMock.mockImplementation(async () => saturatedResponse(`s${n++}`));

    await discoverGooglePlaces(baseConfig(["cafe"]), "key");

    expect(fetchMock).toHaveBeenCalledTimes(21);
  });

  it("dedupliserer på place-id på tvers av delsirkler (overlappet er ufarlig)", async () => {
    // Rota og alle fire delsirkler returnerer SAMME 20 steder.
    fetchMock.mockImplementation(async () => saturatedResponse("same"));

    const result = await discoverGooglePlaces(baseConfig(["cafe"]), "key");

    expect(result).toHaveLength(20);
  });

  it("treff i delsirkel MEN utenfor modersirkelen kastes (grensen flyttes ikke)", async () => {
    // Delsirklene rekker 1,26 × radius ut. Et sted 2 500 m unna ligger utenfor
    // config.radius = 2000 og skal falle på avstandsfilteret.
    fetchMock.mockResolvedValueOnce(saturatedResponse("rot"));
    fetchMock.mockResolvedValue(
      placesResponse([
        googlePlace({
          id: "far",
          name: "Kafé Langt Unna",
          types: ["cafe"],
          // ~2 500 m nord for CENTER
          location: { latitude: 63.4526, longitude: 10.4 },
        }),
      ])
    );

    const result = await discoverGooglePlaces(baseConfig(["cafe"]), "key");

    expect(result.map((p) => p.name)).not.toContain("Kafé Langt Unna");
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

  it("bussholdeplass utenfor avstandstaket droppes selv innenfor radius", async () => {
    fetchMock.mockResolvedValueOnce(
      enturResponse([
        // ~4,5 km nord — innenfor radius 5000, men over det felles taket
        // (MAX_POI_DISTANCE_METERS = 4 000 m, hevet fra 3 000 da bolig-radiusen
        // ble 3 000: taket skal alltid ligge OVER sirkelen, aldri på den).
        { id: "NSR:StopPlace:5", name: "Fjern holdeplass", latitude: 63.4705, longitude: 10.4, transportMode: ["bus"] },
        { id: "NSR:StopPlace:6", name: "Nær holdeplass", ...NEAR_STOP, transportMode: ["bus"] },
      ])
    );

    const result = await discoverEnturStops({ center: CENTER, radius: 5000 });

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
