import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  discoverGooglePlaces,
  discoverAnchorCandidates,
  probeAnchorMembers,
  discoverEnturStops,
  discoverBysykkelStations,
  generatePoiId,
  subdivideCircle,
  ANCHOR_SEARCH_RADIUS_M,
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

describe("discoverGooglePlaces — containment (anker-oppløsning)", () => {
  it("ber om places.containingPlaces i feltmasken", async () => {
    fetchMock.mockResolvedValueOnce(
      placesResponse([googlePlace({ id: "p1", name: "H&M", types: ["clothing_store"] })])
    );
    await discoverGooglePlaces(baseConfig(["clothing_store"]), "key");

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["X-Goog-FieldMask"]).toContain("places.containingPlaces");
  });

  it("oversetter Googles container-id-er til Placy-id-er", async () => {
    // Google svarer { id, name } der name er ressursnavnet «places/ChIJ…».
    // Vi bruker id-en og bygger den samme `google-`-id-en stedene selv får,
    // slik at pekeren kan sammenlignes med v2.pois.id uten oppslag.
    fetchMock.mockResolvedValueOnce(
      placesResponse([
        {
          ...googlePlace({ id: "p1", name: "H&M", types: ["clothing_store"] }),
          containingPlaces: [
            { id: "ChIJVZdRQJoxbUYRTcToJ4smjeM", name: "places/ChIJVZdRQJoxbUYRTcToJ4smjeM" },
          ],
        },
      ])
    );

    const result = await discoverGooglePlaces(baseConfig(["clothing_store"]), "key");
    expect(result[0].containedInIds).toEqual(["google-ChIJVZdRQJoxbUYRTcToJ4smjeM"]);
  });

  it("lar feltet være udefinert når Google ikke sier noe", async () => {
    // «Google sa ingenting» og «ligger ikke i noe bygg» er ikke samme påstand.
    // Et tomt array ville blitt lagret som det siste.
    fetchMock.mockResolvedValueOnce(
      placesResponse([
        { ...googlePlace({ id: "p1", name: "H&M", types: ["clothing_store"] }), containingPlaces: [] },
        googlePlace({ id: "p2", name: "Cubus", types: ["clothing_store"] }),
      ])
    );

    const result = await discoverGooglePlaces(baseConfig(["clothing_store"]), "key");
    expect(result).toHaveLength(2);
    for (const poi of result) expect(poi.containedInIds).toBeUndefined();
  });
});

/**
 * Ekte koordinater, hentet fra Places API 2026-08-27. Sundsøya på Inderøy er
 * det eneste målte boardet der nærmeste kjøpesenter ligger utenfor både
 * prosjektsirkelen (3 km) og kvalitetskjedens eget avstandstak (4 km).
 */
const SUNDSOYA = { lat: 63.865218, lng: 11.303152 };
const VERDAL_MALLS = [
  { id: "ChIJjxqC94N8bUYR3lzOf1Jw3e4", name: "Thon Senter Verdal", lat: 63.791835, lng: 11.486321 },
  { id: "ChIJW9CeMmN7bUYRFSJm3kR7INU", name: "Alti Verdal", lat: 63.782054, lng: 11.470842 },
  { id: "ChIJqcq4QqVlbUYRtWC7hu6FDU4", name: "Alti Magneten Mall", lat: 63.732664, lng: 11.281753 },
];

function mallPlace(m: { id: string; name: string; lat: number; lng: number }, over: Record<string, unknown> = {}) {
  return {
    ...googlePlace({
      id: m.id,
      name: m.name,
      location: { latitude: m.lat, longitude: m.lng },
      types: ["shopping_mall"],
    }),
    ...over,
  };
}

describe("discoverAnchorCandidates — anker-søk utenfor sirkelen", () => {
  it("ber Google rangere på AVSTAND, ikke popularitet", async () => {
    // Uten dette er «de tre nærmeste» uleselig: et popularitets-rangert
    // utvalg av 20 kan hoppe over nabosenteret til fordel for storsenteret.
    fetchMock.mockResolvedValueOnce(placesResponse([mallPlace(VERDAL_MALLS[0])]));

    await discoverAnchorCandidates({ center: SUNDSOYA }, "key");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.rankPreference).toBe("DISTANCE");
    expect(body.includedTypes).toEqual(["shopping_mall"]);
    expect(body.locationRestriction.circle.radius).toBe(ANCHOR_SEARCH_RADIUS_M);
  });

  it("standardpasset rangerer FORTSATT på popularitet (ingen lekkasje)", async () => {
    fetchMock.mockResolvedValueOnce(placesResponse([]));
    await discoverGooglePlaces(baseConfig(["cafe"]), "key");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.rankPreference).toBeUndefined();
  });

  it("slipper gjennom sentre langt utenfor MAX_POI_DISTANCE_METERS (4 km)", async () => {
    // Dette er hele grunnen til at passet ikke kan være discoverGooglePlaces
    // med større radius: kvalitetskjedens avstandstak gjelder alle kategorier
    // og ville drept alle tre uansett hvor stor sirkelen var.
    fetchMock.mockResolvedValueOnce(
      placesResponse(VERDAL_MALLS.map((m) => mallPlace(m)))
    );

    const hits = await discoverAnchorCandidates({ center: SUNDSOYA }, "key");

    expect(hits.map((h) => h.poi.name)).toEqual([
      "Thon Senter Verdal",
      "Alti Verdal",
      "Alti Magneten Mall",
    ]);
    for (const h of hits) expect(h.distanceMeters).toBeGreaterThan(4000);
    expect(Math.round(hits[0].distanceMeters / 100) / 10).toBeCloseTo(12.1, 1);
    expect(Math.round(hits[2].distanceMeters / 100) / 10).toBeCloseTo(14.8, 1);
  });

  it("sorterer stigende på avstand uansett Googles egen rekkefølge", async () => {
    fetchMock.mockResolvedValueOnce(
      placesResponse([...VERDAL_MALLS].reverse().map((m) => mallPlace(m)))
    );

    const hits = await discoverAnchorCandidates({ center: SUNDSOYA }, "key");
    const distances = hits.map((h) => h.distanceMeters);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it("beholder resten av kvalitetskjeden — stengt senter blir ikke anker", async () => {
    fetchMock.mockResolvedValueOnce(
      placesResponse([
        mallPlace(VERDAL_MALLS[0], { businessStatus: "CLOSED_PERMANENTLY" }),
        mallPlace(VERDAL_MALLS[1]),
      ])
    );

    const hits = await discoverAnchorCandidates({ center: SUNDSOYA }, "key");
    expect(hits.map((h) => h.poi.name)).toEqual(["Alti Verdal"]);
  });

  it("senter UTEN rating droppes ikke — det merkes, og utvalget avgjør", async () => {
    // Vikhammer senteret har verken rating eller anmeldelser hos Google (målt
    // 2026-08-27). Det er grunnen til at det ikke finnes i basen i dag: rating-
    // gaten i standardpasset tar det. For et lite nærsenter er stillhet på
    // Google normalen, så anker-passet rapporterer i stedet for å dømme.
    fetchMock.mockResolvedValueOnce(
      placesResponse([
        {
          ...mallPlace(VERDAL_MALLS[0], { businessStatus: "OPERATIONAL" }),
          displayName: { text: "Vikhammer senteret" },
          rating: undefined,
          userRatingCount: undefined,
        },
        mallPlace(VERDAL_MALLS[1]),
      ])
    );

    const hits = await discoverAnchorCandidates({ center: SUNDSOYA }, "key");
    expect(hits).toHaveLength(2);
    expect(hits.find((h) => h.poi.name === "Vikhammer senteret")!.hasQualitySignals).toBe(
      false
    );
    expect(hits.find((h) => h.poi.name === "Alti Verdal")!.hasQualitySignals).toBe(true);
  });

  it("navn-blokklista står — «Parkering ikea leangen» blir aldri anker-kandidat", async () => {
    fetchMock.mockResolvedValueOnce(
      placesResponse([
        { ...mallPlace(VERDAL_MALLS[0]), displayName: { text: "Parkering ikea leangen" } },
        mallPlace(VERDAL_MALLS[1]),
      ])
    );

    const hits = await discoverAnchorCandidates({ center: SUNDSOYA }, "key");
    expect(hits.map((h) => h.poi.name)).toEqual(["Alti Verdal"]);
  });

  it("kaster ut treff uten shopping_mall-typen", async () => {
    fetchMock.mockResolvedValueOnce(
      placesResponse([
        { ...mallPlace(VERDAL_MALLS[0]), types: ["parking"] },
        mallPlace(VERDAL_MALLS[1]),
      ])
    );

    const hits = await discoverAnchorCandidates({ center: SUNDSOYA }, "key");
    expect(hits.map((h) => h.poi.name)).toEqual(["Alti Verdal"]);
  });

  it("bærer containment videre — et anker kan selv ligge i et større bygg", async () => {
    fetchMock.mockResolvedValueOnce(
      placesResponse([
        mallPlace(VERDAL_MALLS[0], {
          containingPlaces: [{ id: "ChIJcontainer", name: "places/ChIJcontainer" }],
        }),
      ])
    );

    const hits = await discoverAnchorCandidates({ center: SUNDSOYA }, "key");
    expect(hits[0].poi.containedInIds).toEqual(["google-ChIJcontainer"]);
    expect(hits[0].poi.category.id).toBe("shopping");
  });

  it("tomt svar gir tom liste, ikke kast", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    await expect(discoverAnchorCandidates({ center: SUNDSOYA }, "key")).resolves.toEqual([]);
  });
});

describe("probeAnchorMembers — teller uten å importere", () => {
  const THON = "ChIJjxqC94N8bUYR3lzOf1Jw3e4";
  const ANCHOR = {
    googlePlaceId: THON,
    coordinates: { lat: 63.791835, lng: 11.486321 },
  };

  function tenant(name: string, types: string[], containerId: string | null = THON) {
    return {
      id: `place-${name}`,
      displayName: { text: name },
      location: { latitude: 63.791835, longitude: 11.486321 },
      types,
      businessStatus: "OPERATIONAL",
      ...(containerId ? { containingPlaces: [{ id: containerId }] } : {}),
    };
  }

  it("søker UTEN typefilter — spørsmålet er «hva ligger i bygget»", async () => {
    fetchMock.mockResolvedValueOnce(placesResponse([]));
    await probeAnchorMembers(ANCHOR, "key");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.includedTypes).toBeUndefined();
    expect(body.rankPreference).toBe("DISTANCE");
    expect(body.locationRestriction.circle.radius).toBe(120);
  });

  it("teller bare det som peker PÅ ankeret, og ikke ankeret selv", async () => {
    // Målt mot Thon Senter Verdal 2026-08-27: 20 steder innen 120 m, 19 med
    // containingPlaces mot senteret — det tjuende var senteret selv.
    fetchMock.mockResolvedValueOnce(
      placesResponse([
        { ...tenant("Thon Senter Verdal", ["shopping_mall"], null), id: THON },
        tenant("REMA 1000 VERDAL", ["grocery_store", "food_store"]),
        tenant("Vitusapotek Innherred", ["pharmacy", "health"]),
        tenant("INTERSPORT", ["sportswear_store", "sporting_goods_store"]),
        tenant("Nille", ["home_goods_store", "store"]),
        tenant("Nabobygget AS", ["store"], "ChIJannen"),
      ])
    );

    const probe = await probeAnchorMembers(ANCHOR, "key");
    expect(probe.memberCount).toBe(4);
    expect(probe.saturated).toBe(false);
  });

  it("bygger kategorinavn av medlemmenes typer — første kjente type eier", async () => {
    fetchMock.mockResolvedValueOnce(
      placesResponse([
        tenant("REMA 1000", ["grocery_store"]),
        tenant("Vitusapotek", ["pharmacy"]),
        tenant("INTERSPORT", ["sportswear_store", "sporting_goods_store"]),
        tenant("Moxie Skjønnhet AS", ["point_of_interest", "establishment"]),
      ])
    );

    const probe = await probeAnchorMembers(ANCHOR, "key");
    // Alle fire teller som medlemmer ...
    expect(probe.memberCount).toBe(4);
    // ... men bare de tre med en kategori vi kjenner bidrar til teksten.
    // «sportswear_store» er ukjent, «sporting_goods_store» er butikk.
    expect(probe.categoryNames).toEqual(["Dagligvare", "Apotek", "Butikk"]);
  });

  it("fullt svar merkes som «minst» — Googles tak er 20", async () => {
    fetchMock.mockResolvedValueOnce(
      placesResponse(
        Array.from({ length: 20 }, (_, i) => tenant(`Butikk ${i}`, ["clothing_store"]))
      )
    );

    const probe = await probeAnchorMembers(ANCHOR, "key");
    expect(probe.memberCount).toBe(20);
    expect(probe.saturated).toBe(true);
  });

  it("permanent stengte leietakere teller ikke", async () => {
    fetchMock.mockResolvedValueOnce(
      placesResponse([
        { ...tenant("Nedlagt Butikk", ["clothing_store"]), businessStatus: "CLOSED_PERMANENTLY" },
        tenant("REMA 1000", ["grocery_store"]),
      ])
    );

    const probe = await probeAnchorMembers(ANCHOR, "key");
    expect(probe.memberCount).toBe(1);
  });

  it("bygg uten containment gir null — gaten er presis, ikke geometrisk", async () => {
    fetchMock.mockResolvedValueOnce(
      placesResponse([
        tenant("Butikk over gata", ["clothing_store"], null),
        tenant("Annen butikk", ["clothing_store"], null),
      ])
    );

    const probe = await probeAnchorMembers(ANCHOR, "key");
    expect(probe).toEqual({ memberCount: 0, categoryNames: [], saturated: false });
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
