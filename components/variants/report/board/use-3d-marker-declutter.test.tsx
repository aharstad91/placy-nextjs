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

import {
  useMarker3DDeclutter,
  CAMERA_SETTLE_MS,
} from "./use-3d-marker-declutter";
import { POI_PIN_MAX_SCALE } from "@/components/map/poi-pin-scale";

/** Trondheim — samme breddegrad boardene står på. */
const LAT = 63.44;
const WIDTH = 1200;
const HEIGHT = 900;

/** Ro-vinduet i hooken, med litt margin. Leses fra kilden så testene ikke blir
 *  usanne påstander i det tallet justeres. */
const SETTLE = CAMERA_SETTLE_MS + 50;

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
  textureIds?: ReadonlySet<string> | undefined;
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
        textureIds: props.textureIds,
        enabled: props.enabled,
        suppressActiveLabel: props.suppressActiveLabel,
      }),
    {
      initialProps: {
        pois,
        activePOIId: overrides.activePOIId ?? null,
        enabled: overrides.enabled ?? true,
        suppressActiveLabel: overrides.suppressActiveLabel ?? false,
        textureIds: overrides.textureIds,
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

describe("useMarker3DDeclutter — markør-skala fra kamera-avstand", () => {
  // Skalaen bor i denne hooken og ikke i en egen kamera-lytter fordi den som
  // RESERVERER plass må være den som bestemmer hvor stort det tegnes. Testene
  // her er derfor både på tallet OG på at tallet når geometrien.
  it("oversikt og strøkszoom står på basis (samme markør som 2D)", () => {
    for (const range of [3000, 1600, 900]) {
      const { result, unmount } = setup(makeMap(range), [poi("a", 100, 100, 4)]);
      settle();
      expect(result.current.pinScale).toBe(1);
      unmount();
    }
  });

  it("gatezoom vokser, og maks flater ut", () => {
    const gate = setup(makeMap(322), [poi("a", 100, 100, 4)]);
    settle();
    const nær = setup(makeMap(120), [poi("b", 100, 100, 4)]);
    settle();
    expect(gate.result.current.pinScale).toBeGreaterThan(1);
    expect(nær.result.current.pinScale).toBeGreaterThan(
      gate.result.current.pinScale,
    );
    expect(nær.result.current.pinScale).toBe(POI_PIN_MAX_SCALE);
  });

  it("skalaen når kollisjonen: samme to pins, flippet label på nær zoom", () => {
    // Projeksjonen er identitet i disse testene, så skjermposisjonene er LIKE i
    // begge tilfeller — det eneste som skiller dem er at pinnen (og navnet)
    // tegnes større. Naboens disc rekker da borti «langtnavnet»s label, som må
    // flippe til venstre. Feiler denne, reserverer kullingen plass til en annen
    // markør enn den som står på skjermen.
    const par = () => [poi("aaaaaaaaaa", 200, 300, 5), poi("nabo", 310, 300, 1)];
    const fjern = setup(makeMap(900), par());
    settle();
    const nær = setup(makeMap(120), par());
    settle();
    expect(fjern.result.current.labels.aaaaaaaaaa.side).toBe("right");
    expect(nær.result.current.labels.aaaaaaaaaa.side).toBe("left");
  });

  it("ulesbart kamera → basis, ingen gjettet oppskalering ved mount", () => {
    const { result } = setup(makeMap(null), [poi("a", 100, 100, 4)]);
    settle();
    expect(result.current.pinScale).toBe(1);
  });
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
        textureIds: undefined,
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
    settle(CAMERA_SETTLE_MS - 20);
    expect(result.current.labels).toEqual({});
    settle(40);
    expect(Object.keys(result.current.labels)).toEqual(["a"]);
  });

  it("plasseringen FRYSES mens kameraet er i bevegelse", () => {
    const map = makeMap(900);
    const { result } = setup(map, [poi("a", 100, 100, 4)]);
    settle();
    expect(Object.keys(result.current.labels)).toEqual(["a"]);

    // Brukeren zoomer helt ut — langt forbi prikk-terskelen. Så lenge gesten
    // pågår skal svaret stå stille. Labelen følger uansett sin egen pin gjennom
    // bevegelsen, så en omregning midt i draget ville bare fått navn til å hoppe
    // mellom sider under fingeren.
    map.range = 15000;
    // Steget må ligge UNDER ro-vinduet, ellers tester vi ro og ikke bevegelse.
    const duringGesture = Math.max(1, Math.floor(CAMERA_SETTLE_MS / 2));
    for (let i = 0; i < 10; i++) {
      act(() => {
        map.dispatchEvent(new Event("gmp-camerapositionchange"));
        vi.advanceTimersByTime(duringGesture);
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
        textureIds: undefined,
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

describe("useMarker3DDeclutter — omvisningens tekstur", () => {
  /**
   * 3D-motoren har ingen opacity-spak, så nabolaget rundt et stopp uttrykkes som
   * prikker. Uten dette sto de mountede kontekst-punktene som fulle pins med
   * navn, og stoppets egne steder forsvant i mengden — eller, før teksturen i
   * det hele tatt ble mountet: hvert annet tema forsvant fra kartet i det du
   * trykket på en pinne (2026-08-28).
   */
  it("tegner tekstur-punkter som prikk, uansett hvor god plass det er", () => {
    const { result } = setup(
      makeMap(900),
      [poi("scene", 100, 100, 4), poi("tekstur", 600, 600, 5)],
      { textureIds: new Set(["tekstur"]) },
    );
    settle();
    expect([...result.current.demotedIds]).toEqual(["tekstur"]);
    // Prikken bærer ikke navn; stoppets eget sted gjør det.
    expect(result.current.labels["tekstur"]).toBeUndefined();
    expect(result.current.labels["scene"]?.text).toBe("scene");
  });

  it("lar aldri en tekstur-prikk ta pin-plassen fra stoppets sted", () => {
    // Samme punkt på skjermen: teksturen har HØYERE rating, og ville vunnet
    // plassen i den grådige kullingen om den fikk delta.
    const { result } = setup(
      makeMap(900),
      [poi("scene", 300, 300, 3), poi("tekstur", 305, 305, 5)],
      { textureIds: new Set(["tekstur"]) },
    );
    settle();
    expect(result.current.demotedIds.has("scene")).toBe(false);
    expect(result.current.demotedIds.has("tekstur")).toBe(true);
  });

  it("regner på nytt når teksturen endrer seg, selv om markørsettet er likt", () => {
    // Stoppbytte flytter kameraet ikke lenger, og på et board uten voice-over er
    // markørsettet det SAMME i hvert stopp. Da er teksturen den eneste endringen
    // — fanger ikke datasett-timeren den, står forrige stopps pins igjen.
    const pois = [poi("a", 100, 100, 4), poi("b", 600, 600, 5)];
    const { result, rerender } = setup(makeMap(900), pois, {
      textureIds: new Set(["b"]),
    });
    settle();
    expect([...result.current.demotedIds]).toEqual(["b"]);
    act(() => {
      rerender({
        pois,
        activePOIId: null,
        enabled: true,
        suppressActiveLabel: false,
        textureIds: new Set(["a"]),
      });
    });
    settle();
    expect([...result.current.demotedIds]).toEqual(["a"]);
    expect(result.current.labels["b"]?.text).toBe("b");
  });

  it("holder det ÅPNE punktet som full pin, også når det er tekstur", () => {
    // Du trykket på det, popupen står over det — da er det ikke kontekst lenger.
    const { result } = setup(
      makeMap(900),
      [poi("scene", 100, 100, 4), poi("tekstur", 600, 600, 5)],
      { textureIds: new Set(["tekstur"]), activePOIId: "tekstur" },
    );
    settle();
    expect(result.current.demotedIds.has("tekstur")).toBe(false);
  });
});
