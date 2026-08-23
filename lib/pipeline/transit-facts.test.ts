import { describe, expect, it } from "vitest";
import {
  MAX_STOPS,
  parseNearestStops,
  parseQuayDirections,
  parseTripPatterns,
} from "./transit-facts";

/**
 * Fixturene er kopiert fra ekte svar mot Strindfjordvegen 10 på Ranheim
 * (2026-08-22), ikke oppdiktet. Det er hele poenget med å skille parserne fra
 * fetch: de kan holdes mot faktiske responskropper uten nett.
 */

const NEAREST_RESPONSE = {
  nearest: {
    edges: [
      {
        node: {
          distance: 28.4,
          place: { id: "NSR:StopPlace:60260", name: "Strindfjordvegen", transportMode: ["bus"] },
        },
      },
      {
        node: {
          distance: 289.1,
          place: { id: "NSR:StopPlace:60261", name: "Skonnertvegen", transportMode: ["bus"] },
        },
      },
      {
        node: {
          distance: 294.7,
          place: { id: "NSR:StopPlace:42157", name: "Grilstadkleiva", transportMode: ["bus"] },
        },
      },
    ],
  },
};

const DEPARTURES_RESPONSE = {
  stopPlace: {
    id: "NSR:StopPlace:60260",
    name: "Strindfjordvegen",
    quays: [
      {
        id: "NSR:Quay:102724",
        estimatedCalls: [
          {
            destinationDisplay: { frontText: "Grillstad" },
            serviceJourney: { line: { publicCode: "20" } },
          },
          {
            destinationDisplay: { frontText: "Grillstad" },
            serviceJourney: { line: { publicCode: "20" } },
          },
        ],
      },
      {
        id: "NSR:Quay:102725",
        estimatedCalls: [
          {
            destinationDisplay: { frontText: "Romolslia via Strindh.-Ladeham." },
            serviceJourney: { line: { publicCode: "20" } },
          },
        ],
      },
      // Quay uten avganger i vinduet — skal ikke bli en tom retning.
      { id: "NSR:Quay:999999", estimatedCalls: [] },
    ],
  },
};

const TRIP_RESPONSE = {
  trip: {
    tripPatterns: [
      {
        duration: 1500,
        walkDistance: 294.2,
        legs: [
          { mode: "foot", line: null },
          { mode: "bus", line: { publicCode: "1" } },
          { mode: "foot", line: null },
          { mode: "bus", line: { publicCode: "311" } },
          { mode: "foot", line: null },
        ],
      },
      {
        duration: 1740,
        walkDistance: 728.4,
        legs: [
          { mode: "foot", line: null },
          { mode: "bus", line: { publicCode: "1" } },
          { mode: "foot", line: null },
        ],
      },
      {
        duration: 1260,
        walkDistance: 294.2,
        legs: [
          { mode: "foot", line: null },
          { mode: "bus", line: { publicCode: "1" } },
          { mode: "foot", line: null },
          { mode: "bus", line: { publicCode: "70" } },
        ],
      },
    ],
  },
};

describe("parseNearestStops", () => {
  it("plukker id, navn, avstand og transportmiddel", () => {
    const stops = parseNearestStops(NEAREST_RESPONSE);
    expect(stops).toHaveLength(3);
    expect(stops[0]).toEqual({
      stopPlaceId: "NSR:StopPlace:60260",
      name: "Strindfjordvegen",
      distanceM: 28,
      modes: ["bus"],
      directions: [],
    });
  });

  it("beholder den rå NSR-id-en med kolon", () => {
    // Den matcher `POI.enturStopplaceId`. POI-id-en er en annen streng
    // (`entur-NSR-StopPlace-60260`), og kolon→bindestrek-omskrivingen i
    // generatePoiId er ingen kontrakt vi kan reversere.
    expect(parseNearestStops(NEAREST_RESPONSE)[0].stopPlaceId).toContain(":");
  });

  it("kapper på taket så et bysentrum ikke gir en holdeplassliste", () => {
    const many = {
      nearest: {
        edges: Array.from({ length: 12 }, (_, i) => ({
          node: { distance: i * 10, place: { id: `NSR:StopPlace:${i}`, name: `Stopp ${i}` } },
        })),
      },
    };
    expect(parseNearestStops(many)).toHaveLength(MAX_STOPS);
  });

  it("dedupliserer samme stoppested", () => {
    const dupes = {
      nearest: {
        edges: [
          { node: { distance: 10, place: { id: "NSR:StopPlace:1", name: "A" } } },
          { node: { distance: 20, place: { id: "NSR:StopPlace:1", name: "A" } } },
        ],
      },
    };
    expect(parseNearestStops(dupes)).toHaveLength(1);
  });

  it("hopper over noder uten id eller navn i stedet for å kaste", () => {
    const rot = {
      nearest: {
        edges: [
          { node: { distance: 10, place: null } },
          { node: { distance: 20, place: { id: "NSR:StopPlace:2" } } },
          { node: { distance: 30, place: { id: "NSR:StopPlace:3", name: "C" } } },
        ],
      },
    };
    expect(parseNearestStops(rot).map((s) => s.stopPlaceId)).toEqual(["NSR:StopPlace:3"]);
  });

  it("gir tom liste for tomt eller ugyldig svar", () => {
    expect(parseNearestStops(null)).toEqual([]);
    expect(parseNearestStops({})).toEqual([]);
    expect(parseNearestStops({ nearest: { edges: [] } })).toEqual([]);
  });
});

describe("parseQuayDirections", () => {
  it("grupperer per quay så de to retningene ikke smelter sammen", () => {
    // Læringen fra 2026-04-10: estimatedCalls på stoppestedet blander
    // retninger, og «linje 20» ser da ut som ett tilbud i stedet for to.
    const dirs = parseQuayDirections(DEPARTURES_RESPONSE);
    expect(dirs).toHaveLength(2);
    expect(dirs[0]).toEqual({
      quayId: "NSR:Quay:102724",
      destinations: ["Grillstad"],
      lines: ["20"],
    });
    expect(dirs[1].destinations).toEqual(["Romolslia via Strindh.-Ladeham."]);
  });

  it("utelater quay uten avganger i vinduet", () => {
    expect(parseQuayDirections(DEPARTURES_RESPONSE).map((d) => d.quayId)).not.toContain(
      "NSR:Quay:999999",
    );
  });

  it("sorterer linjer og destinasjoner på frekvens, deretter alfabetisk", () => {
    const raw = {
      stopPlace: {
        quays: [
          {
            id: "NSR:Quay:1",
            estimatedCalls: [
              { destinationDisplay: { frontText: "Sentrum" }, serviceJourney: { line: { publicCode: "3" } } },
              { destinationDisplay: { frontText: "Sentrum" }, serviceJourney: { line: { publicCode: "3" } } },
              { destinationDisplay: { frontText: "Lade" }, serviceJourney: { line: { publicCode: "1" } } },
            ],
          },
        ],
      },
    };
    const [dir] = parseQuayDirections(raw);
    expect(dir.lines).toEqual(["3", "1"]);
    expect(dir.destinations).toEqual(["Sentrum", "Lade"]);
  });

  it("håndterer stoppested med én quay og én retning som en flat retning", () => {
    const raw = {
      stopPlace: {
        quays: [
          {
            id: "NSR:Quay:7",
            estimatedCalls: [
              { destinationDisplay: { frontText: "Byen" }, serviceJourney: { line: { publicCode: "9" } } },
            ],
          },
        ],
      },
    };
    expect(parseQuayDirections(raw)).toEqual([
      { quayId: "NSR:Quay:7", destinations: ["Byen"], lines: ["9"] },
    ]);
  });

  it("tåler manglende linje eller destinasjon uten å kaste", () => {
    const raw = {
      stopPlace: {
        quays: [
          {
            id: "NSR:Quay:8",
            estimatedCalls: [
              { destinationDisplay: null, serviceJourney: { line: { publicCode: "9" } } },
              { destinationDisplay: { frontText: "Byen" }, serviceJourney: null },
            ],
          },
        ],
      },
    };
    expect(parseQuayDirections(raw)).toEqual([
      { quayId: "NSR:Quay:8", destinations: ["Byen"], lines: ["9"] },
    ]);
  });

  it("gir tom liste for tomt svar", () => {
    expect(parseQuayDirections(null)).toEqual([]);
    expect(parseQuayDirections({ stopPlace: null })).toEqual([]);
  });
});

describe("parseTripPatterns", () => {
  it("regner minutter opp og teller bare kollektiv-bein som bytter", () => {
    const patterns = parseTripPatterns(TRIP_RESPONSE);
    // Sortert på tid: 1260 s → 21 min er raskest.
    expect(patterns[0]).toEqual({
      minutes: 21,
      lines: ["1", "70"],
      transfers: 1,
      walkMeters: 294,
    });
  });

  it("gir null bytter for en direkte reise selv med gange i begge ender", () => {
    const direkte = parseTripPatterns(TRIP_RESPONSE).find((p) => p.lines.length === 1);
    expect(direkte).toEqual({ minutes: 29, lines: ["1"], transfers: 0, walkMeters: 728 });
  });

  it("sorterer raskeste først, og færrest bytter ved lik tid", () => {
    const raw = {
      trip: {
        tripPatterns: [
          { duration: 600, walkDistance: 100, legs: [{ mode: "bus", line: { publicCode: "1" } }, { mode: "bus", line: { publicCode: "2" } }] },
          { duration: 600, walkDistance: 100, legs: [{ mode: "bus", line: { publicCode: "3" } }] },
        ],
      },
    };
    expect(parseTripPatterns(raw).map((p) => p.transfers)).toEqual([0, 1]);
  });

  it("beholder en ren gangreise som mønster uten linjer", () => {
    const raw = {
      trip: { tripPatterns: [{ duration: 900, walkDistance: 1200, legs: [{ mode: "foot" }] }] },
    };
    expect(parseTripPatterns(raw)).toEqual([
      { minutes: 15, lines: [], transfers: 0, walkMeters: 1200 },
    ]);
  });

  it("kaster bort mønstre uten varighet i stedet for å oppgi 0 minutter", () => {
    const raw = { trip: { tripPatterns: [{ duration: 0, walkDistance: 0, legs: [] }] } };
    expect(parseTripPatterns(raw)).toEqual([]);
  });

  it("gir tom liste når ingen reise ble funnet", () => {
    expect(parseTripPatterns({ trip: { tripPatterns: [] } })).toEqual([]);
    expect(parseTripPatterns(undefined)).toEqual([]);
  });
});
