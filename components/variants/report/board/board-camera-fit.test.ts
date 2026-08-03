import { describe, it, expect } from "vitest";
import {
  computeFitBounds,
  rectFromCorners,
  shouldFitToFilter,
  shouldFitToProgram,
} from "./board-camera-fit";

const HOME = { lng: 10.39, lat: 63.43 }; // Trondheim sentrum (event-board home)

describe("computeFitBounds", () => {
  it("returnerer null uten POIer (behold posisjon)", () => {
    expect(computeFitBounds([], HOME)).toBeNull();
  });

  it("rammer inn POIer + home (home aldri utenfor bounds)", () => {
    const bounds = computeFitBounds(
      [
        { lng: 10.41, lat: 63.45 },
        { lng: 10.37, lat: 63.41 },
      ],
      HOME,
    );
    expect(bounds).not.toBeNull();
    // sw = [vest, sør], ne = [øst, nord]
    expect(bounds!.sw[0]).toBeCloseTo(10.37); // vestligste POI
    expect(bounds!.ne[0]).toBeCloseTo(10.41); // østligste POI
    expect(bounds!.sw[1]).toBeCloseTo(63.41); // sørligste POI
    expect(bounds!.ne[1]).toBeCloseTo(63.45); // nordligste POI
    // Home (10.39 / 63.43) ligger innenfor.
    expect(bounds!.sw[0]).toBeLessThanOrEqual(HOME.lng);
    expect(bounds!.ne[0]).toBeGreaterThanOrEqual(HOME.lng);
  });

  it("utvider bounds til home når alle POIene ligger på én side", () => {
    // Alle POIer nordøst for home → home setter sør/vest-kanten.
    const bounds = computeFitBounds(
      [
        { lng: 10.5, lat: 63.5 },
        { lng: 10.6, lat: 63.6 },
      ],
      HOME,
    );
    expect(bounds!.sw[0]).toBeCloseTo(HOME.lng); // home er vestligst
    expect(bounds!.sw[1]).toBeCloseTo(HOME.lat); // home er sørligst
    expect(bounds!.ne).toEqual([10.6, 63.6]);
  });
});

describe("shouldFitToProgram (B2/B3 ro-fit)", () => {
  const base = {
    eventMode: true,
    mapLoaded: true,
    tourActive: false,
    visibleIdsKey: null as string | null,
  };

  it("fitter til hele programmet i event-modus + ro-tilstand (B2: initial last)", () => {
    expect(shouldFitToProgram(base)).toBe(true);
  });

  it("fitter når et filter NULLSTILLES (B3: visibleIdsKey → null igjen)", () => {
    // Modellerer overgangen aktivt-filter → ro: nøkkelen er null på ny.
    expect(shouldFitToProgram({ ...base, visibleIdsKey: null })).toBe(true);
  });

  it("fitter IKKE mens et filter er aktivt (filter-fitten eier kameraet)", () => {
    expect(shouldFitToProgram({ ...base, visibleIdsKey: "a,b,c" })).toBe(false);
  });

  it("fitter IKKE i boligrapport-modus (eventMode=false) — behold default-senter", () => {
    expect(shouldFitToProgram({ ...base, eventMode: false })).toBe(false);
  });

  it("fitter IKKE før kartet er lastet", () => {
    expect(shouldFitToProgram({ ...base, mapLoaded: false })).toBe(false);
  });

  it("fitter IKKE mens en audio-tur eier kameraet", () => {
    expect(shouldFitToProgram({ ...base, tourActive: true })).toBe(false);
  });
});

describe("shouldFitToFilter (kamera-løkke-gaten)", () => {
  const base = {
    visibleIdsKey: "a,b,c" as string | null,
    tourActive: false,
    visibleIdsSource: "event-filter" as
      | "event-filter"
      | "viewport-scope"
      | null,
  };

  it("fitter på et brukervalgt event-filter (Kulturnatt-oppførselen)", () => {
    expect(shouldFitToFilter(base)).toBe(true);
  });

  it("fitter ALDRI på et viewport-avledet sett — det er feedback-løkken", () => {
    // Panorer → nytt sett → refit → nytt utsnitt → nytt sett → …
    expect(
      shouldFitToFilter({ ...base, visibleIdsSource: "viewport-scope" }),
    ).toBe(false);
  });

  it("fitter ikke i ro-tilstand (ingen nøkkel) — ro-fitten eier kameraet", () => {
    expect(shouldFitToFilter({ ...base, visibleIdsKey: null })).toBe(false);
  });

  it("fitter ikke mens en audio-tur eier kameraet", () => {
    expect(shouldFitToFilter({ ...base, tourActive: true })).toBe(false);
  });

  it("viewport-kilden vinner over tour-gaten også (dobbelt låst)", () => {
    expect(
      shouldFitToFilter({
        ...base,
        tourActive: true,
        visibleIdsSource: "viewport-scope",
      }),
    ).toBe(false);
  });

  it("et tomt filtrert sett («» som nøkkel) er fortsatt et aktivt filter", () => {
    // Tom streng er IKKE null — brukeren har filtrert bort alt, og kameraet
    // skal fortsatt reagere (fitToVisiblePois no-op-er selv på tomt sett).
    expect(shouldFitToFilter({ ...base, visibleIdsKey: "" })).toBe(true);
  });
});

describe("rectFromCorners (ikke-okkludert kartutsnitt)", () => {
  it("bygger den akse-justerte konvolutten av fire hjørner", () => {
    const rect = rectFromCorners([
      { lng: 10.3, lat: 63.5 }, // topp-venstre
      { lng: 10.4, lat: 63.5 }, // topp-høyre
      { lng: 10.3, lat: 63.42 }, // bunn-venstre
      { lng: 10.4, lat: 63.42 }, // bunn-høyre
    ]);
    expect(rect).toEqual({
      west: 10.3,
      south: 63.42,
      east: 10.4,
      north: 63.5,
    });
  });

  it("fanger ytterpunktene når viewportet er rotert (bearing ≠ 0)", () => {
    // Et rotert rektangel: ingen ENKELT diagonal-par gir ytterpunktene.
    // To-hjørners-varianten ville her gitt vest=10.32/øst=10.38 — for smalt.
    const rect = rectFromCorners([
      { lng: 10.32, lat: 63.5 },
      { lng: 10.4, lat: 63.47 },
      { lng: 10.3, lat: 63.45 },
      { lng: 10.38, lat: 63.42 },
    ]);
    expect(rect).toEqual({
      west: 10.3,
      south: 63.42,
      east: 10.4,
      north: 63.5,
    });
  });

  it("returnerer null for et tomt hjørnesett", () => {
    expect(rectFromCorners([])).toBeNull();
  });

  it("returnerer null når unproject gir ikke-endelige tall (kart ikke klart)", () => {
    expect(
      rectFromCorners([
        { lng: 10.3, lat: 63.5 },
        { lng: NaN, lat: 63.5 },
      ]),
    ).toBeNull();
  });

  it("degenerert til ett punkt gir et null-areal-rektangel, ikke null", () => {
    expect(rectFromCorners([{ lng: 10.3, lat: 63.5 }])).toEqual({
      west: 10.3,
      south: 63.5,
      east: 10.3,
      north: 63.5,
    });
  });
});
