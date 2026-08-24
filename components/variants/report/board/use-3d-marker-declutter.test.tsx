import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { POI } from "@/lib/types";

// Projeksjonen mockes til identitet: POI-ens (lat, lng) ER skjerm-(y, x). Da
// kan testene uttrykke geometri direkte i piksler, som er det logikken faktisk
// resonnerer i. Selve perspektiv-matten er testet i project-latlng-to-screen.
vi.mock("@/components/map/project-latlng-to-screen", () => ({
  projectLatLngToScreen: (_map: unknown, lat: number, lng: number) => ({
    x: lng,
    y: lat,
  }),
}));

import { useMarker3DDeclutter } from "./use-3d-marker-declutter";

/** Trondheim — samme breddegrad boardene står på. */
const LAT = 63.44;
const WIDTH = 1200;
const HEIGHT = 900;

/** Ro-vinduet i hooken. Testene venter alltid litt lenger enn dette. */
const SETTLE = 500;

interface FakeMap extends HTMLElement {
  center: { lat: number; lng: number } | null;
  range: number | null;
  fov: number | null;
}

function makeMap(range: number | null = 900): FakeMap {
  const el = document.createElement("div") as unknown as FakeMap;
  el.center = { lat: LAT, lng: 10.4 };
  el.range = range;
  el.fov = 35;
  el.getBoundingClientRect = () =>
    ({ width: WIDTH, height: HEIGHT, x: 0, y: 0, top: 0, left: 0 }) as DOMRect;
  return el;
}

/** POI der koordinatet leses som skjermposisjon (se projeksjons-mocken). */
function poi(id: string, x: number, y: number, rating?: number): POI {
  return {
    id,
    name: id,
    coordinates: { lat: y, lng: x },
    googleRating: rating,
    category: { id: "mat", color: "#abc", icon: "MapPin" },
  } as unknown as POI;
}

/** Hjemmet legges langt unna POI-ene så prosjekt-chipen ikke forstyrrer. */
const HOME = { lat: 800, lng: 900 };

interface Props {
  pois: POI[];
  activePOIId: string | null;
  enabled: boolean;
  suppressActiveLabel: boolean;
}

function setup(
  map: FakeMap | null,
  pois: POI[],
  overrides: Partial<Omit<Props, "pois">> & {
    homeName?: string;
    homeSubtitle?: string;
  } = {},
) {
  return renderHook(
    (props: Props) =>
      useMarker3DDeclutter({
        map3d: map,
        pois: props.pois,
        home: HOME,
        homeName: overrides.homeName ?? "Testprosjektet",
        homeSubtitle: overrides.homeSubtitle,
        activePOIId: props.activePOIId,
        enabled: props.enabled,
        suppressActiveLabel: props.suppressActiveLabel,
      }),
    {
      initialProps: {
        pois,
        activePOIId: overrides.activePOIId ?? null,
        enabled: overrides.enabled ?? true,
        suppressActiveLabel: overrides.suppressActiveLabel ?? false,
      },
    },
  );
}

function settle(ms = SETTLE) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useMarker3DDeclutter — tier fra kamera-avstand", () => {
  const spread = [poi("a", 100, 100, 4), poi("b", 400, 100, 4), poi("c", 100, 300, 4)];

  it("nært (range 900): alle beholder ikonet OG får navn", () => {
    const { result } = setup(makeMap(900), spread);
    settle();
    expect(result.current.demotedIds.size).toBe(0);
    expect(Object.keys(result.current.labels).sort()).toEqual(["a", "b", "c"]);
    expect(result.current.labels.a).toEqual({ text: "a", side: "right" });
  });

  it("uttrukket (range 3000): ikoner uten navn — samme svar som 2D under zoom 16", () => {
    const { result } = setup(makeMap(3000), spread);
    settle();
    expect(result.current.labels).toEqual({});
    expect(result.current.demotedIds.size).toBe(0);
  });

  it("helt uttrukket (range 15000): alt blir prikker", () => {
    const { result } = setup(makeMap(15000), spread);
    settle();
    expect([...result.current.demotedIds].sort()).toEqual(["a", "b", "c"]);
    expect(result.current.labels).toEqual({});
  });
});

describe("useMarker3DDeclutter — klynger", () => {
  // Fem steder i samme bygg, innenfor ~30 px. Grilstad-kjøpesenteret.
  const cluster = [
    poi("apotek", 100, 100, 4.1),
    poi("nille", 112, 104, 3.4),
    poi("mall", 96, 116, 4.5),
    poi("blomster", 118, 92, 4.9),
    poi("marina", 106, 110, 2.8),
  ];

  it("beholder den best rangerte som ikon, resten blir prikker", () => {
    const { result } = setup(makeMap(900), cluster);
    settle();
    expect(result.current.demotedIds.has("blomster")).toBe(false);
    expect(result.current.demotedIds.size).toBe(4);
  });

  it("prikker bærer ikke navn — bare vinneren får label", () => {
    const { result } = setup(makeMap(900), cluster);
    settle();
    expect(Object.keys(result.current.labels)).toEqual(["blomster"]);
  });

  it("aktiv POI beholder ikon og navn selv i klynga", () => {
    const { result } = setup(makeMap(900), cluster, { activePOIId: "marina" });
    settle();
    expect(result.current.demotedIds.has("marina")).toBe(false);
    expect(result.current.labels.marina).toBeDefined();
  });

  it("mini-popup åpen → aktiv POI beholder ikonet, men ikke inline-navnet", () => {
    const { result } = setup(makeMap(900), cluster, {
      activePOIId: "marina",
      suppressActiveLabel: true,
    });
    settle();
    // Pinnen står — det er bare teksten popupen allerede viser som utgår.
    expect(result.current.demotedIds.has("marina")).toBe(false);
    expect(result.current.labels.marina).toBeUndefined();
  });
});

describe("useMarker3DDeclutter — prosjektmarkøren som hindring", () => {
  // Markøren er forankret i bunn-midten på hjemmet (x 900, y 800) og strekker
  // seg OPPOVER. Etter disc-redesignet (2026-08-24) er disc-en 52 px og teksten
  // står bare til HØYRE, så hindringen er asymmetrisk: for «Testprosjektet»
  // dekker den ca. x 874–1035 og y 749–800 ved range 900.
  //
  // POI-kandidatens y løftes til disc-senter (y − 20) før kollisjonen, så en POI
  // deklarert på y = 790 kolliderer som y = 770.
  it("POI bak markøren blir prikk; POI godt under den er uberørt", () => {
    const { result } = setup(makeMap(900), [
      poi("bak", 955, 790, 4),
      poi("langt-under", 955, 100, 4),
    ]);
    settle();
    expect(result.current.demotedIds.has("bak")).toBe(true);
    expect(result.current.demotedIds.has("langt-under")).toBe(false);
  });

  it("POI til VENSTRE for disc-en er uberørt — der står det ingen tekst", () => {
    // Regresjonstest: hindringen var tidligere den symmetriske SVG-rammen
    // sentrert på disc-en, så teksten ble speilet inn i tomrommet til venstre og
    // demoterte alt der. x = 820 ligger utenfor disc-ens venstre kant (874).
    const { result } = setup(makeMap(900), [poi("venstre", 820, 790, 4)]);
    settle();
    expect(result.current.demotedIds.has("venstre")).toBe(false);
  });

  it("hindringen blir bredere når prosjektnavnet er langt", () => {
    // Samme POI, to navnelengder. Med et langt navn strekker teksten seg forbi
    // x = 1100 og fanger POI-en; med et kort navn gjør den det ikke.
    const at = () => [poi("hoyre", 1100, 790, 4)];
    const kort = setup(makeMap(900), at(), { homeName: "Nav" });
    settle();
    expect(kort.result.current.demotedIds.has("hoyre")).toBe(false);

    const langt = setup(makeMap(900), at(), {
      homeName: "Strindfjordvegen 10 Ranheim",
    });
    settle();
    expect(langt.result.current.demotedIds.has("hoyre")).toBe(true);
  });

  it("uten undertittel reserveres ikke plass til en", () => {
    // `homeSubtitle: ""` er «ingen undertittel». Med et KORT navn er det
    // undertittelen som ellers setter bredden, så hindringen krymper uten den.
    const at = () => [poi("hoyre", 960, 790, 4)];
    const med = setup(makeMap(900), at(), { homeName: "Nav" });
    settle();
    expect(med.result.current.demotedIds.has("hoyre")).toBe(true);

    const uten = setup(makeMap(900), at(), {
      homeName: "Nav",
      homeSubtitle: "",
    });
    settle();
    expect(uten.result.current.demotedIds.has("hoyre")).toBe(false);
  });
});

describe("useMarker3DDeclutter — når den skal tie", () => {
  it("enabled=false gir tomt resultat", () => {
    const { result } = setup(makeMap(900), [poi("a", 100, 100, 4)], {
      enabled: false,
    });
    settle();
    expect(result.current.labels).toEqual({});
    expect(result.current.demotedIds.size).toBe(0);
  });

  it("slås den AV etterpå, blir ingen plassering stående igjen", () => {
    const { result, rerender } = setup(makeMap(900), [poi("a", 100, 100, 4)]);
    settle();
    expect(Object.keys(result.current.labels)).toEqual(["a"]);
    act(() => {
      rerender({
        pois: [poi("a", 100, 100, 4)],
        activePOIId: null,
        enabled: false,
        suppressActiveLabel: false,
      });
    });
    expect(result.current.labels).toEqual({});
  });

  it("ingen kart-instans → tomt, ingen krasj", () => {
    const { result } = setup(null, [poi("a", 100, 100, 4)]);
    settle();
    expect(result.current.labels).toEqual({});
  });

  it("kamera ikke lesbart ennå (range mangler) → ingen gjetning", () => {
    const { result } = setup(makeMap(null), [poi("a", 100, 100, 4)]);
    settle();
    expect(result.current.labels).toEqual({});
    expect(result.current.demotedIds.size).toBe(0);
  });
});

describe("useMarker3DDeclutter — ro-signalet", () => {
  it("regner ikke før kameraet har falt til ro", () => {
    const { result } = setup(makeMap(900), [poi("a", 100, 100, 4)]);
    settle(100);
    expect(result.current.labels).toEqual({});
    settle(400);
    expect(Object.keys(result.current.labels)).toEqual(["a"]);
  });

  it("plasseringen FRYSES mens kameraet er i bevegelse (ingen raster-churn)", () => {
    const map = makeMap(900);
    const { result } = setup(map, [poi("a", 100, 100, 4)]);
    settle();
    expect(Object.keys(result.current.labels)).toEqual(["a"]);

    // Brukeren zoomer helt ut — langt forbi prikk-terskelen. Så lenge gesten
    // pågår skal svaret stå stille: hver omregning er en re-rasterisering av
    // markør-teksturene, og labelen følger uansett sin egen pin gjennom
    // bevegelsen.
    map.range = 15000;
    for (let i = 0; i < 10; i++) {
      act(() => {
        map.dispatchEvent(new Event("gmp-camerapositionchange"));
        vi.advanceTimersByTime(100);
      });
      expect(Object.keys(result.current.labels)).toEqual(["a"]);
      expect(result.current.demotedIds.size).toBe(0);
    }

    // Gesten slipper → ro → prikk-tier lander.
    settle();
    expect(result.current.labels).toEqual({});
    expect([...result.current.demotedIds]).toEqual(["a"]);
  });

  it("nytt markørsett får plassering selv MENS kameraet er i bevegelse", () => {
    const map = makeMap(900);
    const { result, rerender } = setup(map, [poi("a", 100, 100, 4)]);
    settle();
    expect(Object.keys(result.current.labels)).toEqual(["a"]);

    // Kategori-bytte midt i en drone-orbit: kamera-timeren nullstilles i ett
    // sett, men datasett-timeren er egen og fyrer likevel.
    act(() => {
      rerender({
        pois: [poi("b", 300, 300, 4)],
        activePOIId: null,
        enabled: true,
        suppressActiveLabel: false,
      });
    });
    for (let i = 0; i < 5; i++) {
      act(() => {
        map.dispatchEvent(new Event("gmp-camerapositionchange"));
        vi.advanceTimersByTime(100);
      });
    }
    expect(Object.keys(result.current.labels)).toEqual(["b"]);
  });

  it("gmp-steadychange lander ankomsten når kamera-feltene blir lesbare", () => {
    const map = makeMap(null);
    const { result } = setup(map, [poi("a", 100, 100, 4)]);
    settle();
    expect(result.current.labels).toEqual({});
    // Google deriverer feltene, så fyrer steady.
    map.range = 900;
    act(() => {
      map.dispatchEvent(new Event("gmp-steadychange"));
      vi.advanceTimersByTime(SETTLE);
    });
    expect(Object.keys(result.current.labels)).toEqual(["a"]);
  });

  it("uendret scene gir samme objekt-identitet (ingen unødig re-render)", () => {
    const map = makeMap(900);
    const { result } = setup(map, [poi("a", 100, 100, 4)]);
    settle();
    const first = result.current;
    act(() => {
      map.dispatchEvent(new Event("gmp-camerapositionchange"));
      vi.advanceTimersByTime(SETTLE);
    });
    expect(result.current).toBe(first);
  });
});
