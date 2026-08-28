import { describe, it, expect } from "vitest";
import {
  computeFitBounds,
  rectFromCamera,
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

describe("rectFromCamera (Google Maps 3D)", () => {
  // Ankeret er valgt så matten kan regnes i hodet: fov 90 gir tan(45°) = 1, så
  // halv dybde = range. Kvadratisk flate gir samme halve bredde. På ekvator er
  // en lengdegrad like lang som en breddegrad (111 320 m), så begge akser
  // spenner range/111320 grader.
  const EQUATOR = { lat: 0, lng: 0, rangeM: 1000, headingDeg: 0, fovDeg: 90 };
  const SQUARE = { widthPx: 1000, heightPx: 1000, occludedBottomPx: 0 };
  /** 1000 m uttrykt i grader. */
  const D = 1000 / 111320;

  it("ser rett ned uten okklusjon: symmetrisk rundt sikte­punktet", () => {
    const rect = rectFromCamera(EQUATOR, SQUARE)!;
    expect(rect.north).toBeCloseTo(D, 9);
    expect(rect.south).toBeCloseTo(-D, 9);
    expect(rect.east).toBeCloseTo(D, 9);
    expect(rect.west).toBeCloseTo(-D, 9);
  });

  it("sheeten spiser NEDENFRA: halv flate → båndet slutter på sikte­punktet", () => {
    // Synlig andel 0,5 → båndet går fra senter og bort fra brukeren. Sør-kanten
    // faller nøyaktig på senterlinja; nord-kanten står stille.
    const rect = rectFromCamera(EQUATOR, { ...SQUARE, occludedBottomPx: 500 })!;
    expect(rect.south).toBeCloseTo(0, 9);
    expect(rect.north).toBeCloseTo(D, 9);
    // Bredden er upåvirket av en bunn-okklusjon.
    expect(rect.east).toBeCloseTo(D, 9);
    expect(rect.west).toBeCloseTo(-D, 9);
  });

  it("sidekolonnen spiser FRA VENSTRE: halv flate → båndet begynner på sikte­punktet", () => {
    // Desktop-panelet ligger oppå kartet, så venstre halvdel er skjult. Med
    // heading 0 er «venstre» vest: vest-kanten faller på senterlinja, og dybden
    // står stille.
    const rect = rectFromCamera(EQUATOR, { ...SQUARE, occludedLeftPx: 500 })!;
    expect(rect.west).toBeCloseTo(0, 9);
    expect(rect.east).toBeCloseTo(D, 9);
    expect(rect.north).toBeCloseTo(D, 9);
    expect(rect.south).toBeCloseTo(-D, 9);
  });

  it("overhenget til høyre er usett og skal ikke være med i scopet", () => {
    // Google-elementet strekkes forbi vindukanten for å få sikte­punktet i midten
    // av det synlige kartet. Den stripen er rendret, men ingen ser den.
    const rect = rectFromCamera(EQUATOR, { ...SQUARE, overhangRightPx: 500 })!;
    expect(rect.east).toBeCloseTo(0, 9);
    expect(rect.west).toBeCloseTo(-D, 9);
  });

  it("panelet og overhenget klipper hver sin side av båndet", () => {
    // Sammen er de den faktiske sannheten på desktop: elementet er bredere enn
    // vinduet OG delvis dekket. Fjerdedelen på hver side gir halve bredden.
    const rect = rectFromCamera(EQUATOR, {
      ...SQUARE,
      occludedLeftPx: 250,
      overhangRightPx: 250,
    })!;
    expect(rect.west).toBeCloseTo(-D / 2, 9);
    expect(rect.east).toBeCloseTo(D / 2, 9);
  });

  it("de to okklusjonene virker på hver sin akse samtidig", () => {
    const rect = rectFromCamera(EQUATOR, {
      ...SQUARE,
      occludedLeftPx: 500,
      occludedBottomPx: 500,
    })!;
    expect(rect.west).toBeCloseTo(0, 9);
    expect(rect.south).toBeCloseTo(0, 9);
    expect(rect.east).toBeCloseTo(D, 9);
    expect(rect.north).toBeCloseTo(D, 9);
  });

  it("en sidekolonne som dekker mer enn halve flaten gir et smalt scope, ikke et speilvendt", () => {
    // Klemmingen på 0,5: uten den ville venstre kant passert høyre og
    // rektangelet snudd — en «utsnitt» som ligger på feil side av kameraet.
    const rect = rectFromCamera(EQUATOR, { ...SQUARE, occludedLeftPx: 900 })!;
    expect(rect.west).toBeCloseTo(0, 9);
    expect(rect.east).toBeCloseTo(D, 9);
  });

  it("heading roterer båndet: ser man øst, vokser utsnittet østover", () => {
    const rect = rectFromCamera(
      { ...EQUATOR, headingDeg: 90 },
      { ...SQUARE, occludedBottomPx: 500 },
    )!;
    // Blikket peker øst → det synlige båndet ligger øst for sikte­punktet.
    expect(rect.west).toBeCloseTo(0, 9);
    expect(rect.east).toBeCloseTo(D, 9);
    // Bredden ligger nå på nord/sør-aksen.
    expect(rect.north).toBeCloseTo(D, 9);
    expect(rect.south).toBeCloseTo(-D, 9);
  });

  it("sideforholdet bestemmer bredden, ikke dybden", () => {
    // Halvt så bred flate → halvparten så bredt utsnitt, samme dybde.
    const rect = rectFromCamera(EQUATOR, { ...SQUARE, widthPx: 500 })!;
    expect(rect.north).toBeCloseTo(D, 9);
    expect(rect.east).toBeCloseTo(D / 2, 9);
  });

  it("skalerer lineært med range — å trekke seg ut utvider scopet", () => {
    const near = rectFromCamera(EQUATOR, SQUARE)!;
    const far = rectFromCamera({ ...EQUATOR, rangeM: 2000 }, SQUARE)!;
    expect(far.north).toBeCloseTo(near.north * 2, 9);
    expect(far.east).toBeCloseTo(near.east * 2, 9);
  });

  it("lengdegrader krymper mot polene: samme meter gir større lng-span", () => {
    const trondheim = rectFromCamera({ ...EQUATOR, lat: 63.43 }, SQUARE)!;
    // Samme utstrekning i meter, men en lengdegrad er kortere her oppe.
    expect(trondheim.north - trondheim.south).toBeCloseTo(2 * D, 9);
    expect(trondheim.east - trondheim.west).toBeGreaterThan(2 * D);
  });

  it("sheeten dekker hele kartet → null (vis alt, aldri tom liste)", () => {
    expect(
      rectFromCamera(EQUATOR, { ...SQUARE, occludedBottomPx: 1000 }),
    ).toBeNull();
  });

  it("returnerer null når kameraet ikke er lesbart ennå", () => {
    expect(rectFromCamera({ ...EQUATOR, rangeM: 0 }, SQUARE)).toBeNull();
    expect(rectFromCamera({ ...EQUATOR, lat: NaN }, SQUARE)).toBeNull();
    expect(rectFromCamera({ ...EQUATOR, fovDeg: NaN }, SQUARE)).toBeNull();
    expect(rectFromCamera(EQUATOR, { ...SQUARE, heightPx: 0 })).toBeNull();
  });
});
