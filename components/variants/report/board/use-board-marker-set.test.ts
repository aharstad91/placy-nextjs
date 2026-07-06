import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  computeHasVoiceOver,
  selectOverviewPOIs,
  selectAllPOIs,
  selectLegendPOIs,
  selectMarkerPOIs,
  selectRevealItems,
  type MarkerSelectionInput,
} from "./use-board-marker-set";
import type { BoardCategory, BoardData } from "./board-data";
import type { EstablishingPathConfig } from "./board-establishing-flythrough";
import type { POI } from "@/lib/types";

// ---------------------------------------------------------------------------
// Minimal POI/kategori-fabrikker — bare feltene selektorene leser.
// ---------------------------------------------------------------------------
function poi(id: string, catId = "cat", lat = 0, lng = 0): POI {
  return {
    id,
    coordinates: { lat, lng },
    category: { id: catId, color: "#abc", icon: "MapPin" },
  } as unknown as POI;
}
function bp(p: POI) {
  return { id: p.id, raw: p } as unknown as BoardCategory["pois"][number];
}
function cat(
  over: Omit<Partial<BoardCategory>, "pois" | "topRankedPois"> & {
    pois?: POI[];
    topRanked?: POI[];
  } = {},
): BoardCategory {
  const { pois = [], topRanked = [], ...rest } = over;
  return {
    id: "c1",
    pois: pois.map(bp),
    topRankedPois: topRanked.map(bp),
    ...rest,
  } as unknown as BoardCategory;
}

// ---------------------------------------------------------------------------
// computeHasVoiceOver — data-drevet (PRD 6 §9 #5), styrer BÅDE markørsett OG
// autoOrbit. Hver av de fem OR-grenene gir true; tomt board gir false.
// ---------------------------------------------------------------------------
describe("computeHasVoiceOver", () => {
  const empty = {
    categories: [cat()],
    welcome: undefined,
    outro: undefined,
    home: { audio: undefined },
  } as unknown as BoardData;

  it("false når ingen lyd-kilde finnes", () => {
    expect(computeHasVoiceOver(empty)).toBe(false);
  });
  it("true når en kategori har audio", () => {
    const d = { ...empty, categories: [cat({ audio: {} as never })] } as BoardData;
    expect(computeHasVoiceOver(d)).toBe(true);
  });
  it("true når en kategori har reelsAudio", () => {
    const d = {
      ...empty,
      categories: [cat({ reelsAudio: {} as never })],
    } as BoardData;
    expect(computeHasVoiceOver(d)).toBe(true);
  });
  it("true når welcome finnes", () => {
    expect(computeHasVoiceOver({ ...empty, welcome: {} as never } as BoardData)).toBe(
      true,
    );
  });
  it("true når home.audio finnes", () => {
    expect(
      computeHasVoiceOver({ ...empty, home: { audio: {} } } as unknown as BoardData),
    ).toBe(true);
  });
  it("true når outro finnes", () => {
    expect(computeHasVoiceOver({ ...empty, outro: {} as never } as BoardData)).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// Oversikts-/nabolags-/legend-sett.
// ---------------------------------------------------------------------------
describe("selectOverviewPOIs", () => {
  const a = poi("a"), b = poi("b"), c = poi("c"), d = poi("d");
  const categories = [cat({ pois: [a, b, c, d], topRanked: [c, a, b, d] })];

  it("voice-over → top-3 score-rangert (topRankedPois), maks 3 per kategori", () => {
    expect(selectOverviewPOIs(categories, true).map((p) => p.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });
  it("uten voice-over → hele nabolaget (alle pois, distanse-rekkefølge)", () => {
    expect(selectOverviewPOIs(categories, false).map((p) => p.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });
});

describe("selectAllPOIs", () => {
  it("dedupliserer på tvers av kategorier (beholder første forekomst)", () => {
    const shared = poi("shared");
    const cats = [
      cat({ pois: [poi("a"), shared] }),
      cat({ pois: [shared, poi("b")] }),
    ];
    expect(selectAllPOIs(cats).map((p) => p.id)).toEqual(["a", "shared", "b"]);
  });
});

describe("selectLegendPOIs", () => {
  it("tar de 3 nærmeste (slice 0..3) per kategori", () => {
    const cats = [
      cat({ pois: [poi("a"), poi("b"), poi("c"), poi("d"), poi("e")] }),
    ];
    expect(selectLegendPOIs(cats).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
});

// ---------------------------------------------------------------------------
// selectMarkerPOIs — render-nivå pin-drop + alle grener (AC1 + AC3).
// ---------------------------------------------------------------------------
describe("selectMarkerPOIs", () => {
  const over = [poi("ov1"), poi("ov2")];
  const all = [poi("a1"), poi("a2"), poi("a3")];
  const activeCat = cat({ pois: [poi("p1", "k1"), poi("p2", "k2")] });

  const base: MarkerSelectionInput = {
    filmMode: false,
    flyMode: false,
    establishingMode: false,
    activeCategory: null,
    statePhase: "default",
    hiddenIds: new Set<string>(),
    isWelcomeBeat: false,
    isHomeBeat: false,
    isOutroBeat: false,
    basicIntroActive: false,
    hasVoiceOver: true,
    overviewPOIs: over,
    allPOIs: all,
  };

  it("?film=1 → rent kart [] (også når kategori er valgt) — render-nivå pin-drop", () => {
    expect(
      selectMarkerPOIs({ ...base, filmMode: true, activeCategory: activeCat }),
    ).toEqual([]);
  });
  it("?fly=1 → []", () => {
    expect(selectMarkerPOIs({ ...base, flyMode: true })).toEqual([]);
  });
  it("establishing → []", () => {
    expect(selectMarkerPOIs({ ...base, establishingMode: true })).toEqual([]);
  });

  it("aktiv kategori i default-fase → alle kategoriens pois (ingen filtrering)", () => {
    expect(
      selectMarkerPOIs({ ...base, activeCategory: activeCat, statePhase: "default" }).map(
        (p) => p.id,
      ),
    ).toEqual(["p1", "p2"]);
  });
  it("aktiv kategori med sub-filter (ikke-default fase) skjuler hidden category-id", () => {
    expect(
      selectMarkerPOIs({
        ...base,
        activeCategory: activeCat,
        statePhase: "active",
        hiddenIds: new Set(["k2"]),
      }).map((p) => p.id),
    ).toEqual(["p1"]);
  });
  it("aktiv kategori med tomt hiddenIds → ingen filtrering selv i active-fase", () => {
    expect(
      selectMarkerPOIs({
        ...base,
        activeCategory: activeCat,
        statePhase: "active",
        hiddenIds: new Set<string>(),
      }).map((p) => p.id),
    ).toEqual(["p1", "p2"]);
  });

  it("welcome-beat (ingen kategori) → [] (reveal-kaskaden eier markørene)", () => {
    expect(selectMarkerPOIs({ ...base, isWelcomeBeat: true })).toEqual([]);
  });
  it("home-beat → hele nabolaget (allPOIs)", () => {
    expect(selectMarkerPOIs({ ...base, isHomeBeat: true }).map((p) => p.id)).toEqual([
      "a1",
      "a2",
      "a3",
    ]);
  });
  it("outro-beat → hele nabolaget (allPOIs)", () => {
    expect(selectMarkerPOIs({ ...base, isOutroBeat: true }).map((p) => p.id)).toEqual([
      "a1",
      "a2",
      "a3",
    ]);
  });

  it("basic-tier mens intro flyr → [] (reveal eier), ellers overview", () => {
    expect(
      selectMarkerPOIs({ ...base, hasVoiceOver: false, basicIntroActive: true }),
    ).toEqual([]);
    expect(
      selectMarkerPOIs({
        ...base,
        hasVoiceOver: false,
        basicIntroActive: false,
      }).map((p) => p.id),
    ).toEqual(["ov1", "ov2"]);
  });

  it("audio-tier idle / megler → ankersettet (overviewPOIs)", () => {
    expect(selectMarkerPOIs(base).map((p) => p.id)).toEqual(["ov1", "ov2"]);
  });
});

// ---------------------------------------------------------------------------
// selectRevealItems — establishing (fly-over-blobs) + default (distanse-sortert).
// ---------------------------------------------------------------------------
describe("selectRevealItems", () => {
  it("establishing → kun blobs i fly-over-orden, INGEN legend-pins", () => {
    const shot = {
      waypoints: [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 0.02 },
      ],
      durationMs: 34000,
      bloomAtProgress: 0.02,
    } as unknown as EstablishingPathConfig;
    const categories = [
      cat({ pois: [poi("near1", "k", 0.0003, 0.005), poi("near2", "k", 0.0003, 0.015)] }),
    ];
    const items = selectRevealItems({
      establishingMode: true,
      establishingShot: shot,
      home: { lat: 0, lng: 0 },
      categories,
      legendPOIs: [],
      legendIds: new Set<string>(),
    });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.kind === "blob")).toBe(true);
    // `at` stigende = fly-over-orden (near1 før near2).
    expect(items.map((i) => i.poi.id)).toEqual(["near1", "near2"]);
  });

  it("default → legend-pins + blobs slått sammen, DISTANSE-sortert (nærmest først)", () => {
    const home = { lat: 0, lng: 0 };
    const legend = poi("legend", "k", 0.001, 0); // ~110 m
    const blobNear = poi("blobNear", "k", 0.0005, 0); // ~55 m
    const blobFar = poi("blobFar", "k", 0.003, 0); // ~330 m
    const categories = [cat({ pois: [legend, blobNear, blobFar] })];
    const items = selectRevealItems({
      establishingMode: false,
      establishingShot: undefined,
      home,
      categories,
      legendPOIs: [legend],
      legendIds: new Set(["legend"]),
    });
    // legend rendres som pin, resten som blob; sortert på avstand fra home.
    expect(items.map((i) => `${i.kind}:${i.poi.id}`)).toEqual([
      "blob:blobNear",
      "pin:legend",
      "blob:blobFar",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Source-guard (AC4/AC7): board-/motor-filene importerer IKKE PendingCamera fra
// den døde scroll-modalen UnifiedMapModal. Leser kilde via process.cwd() (ikke
// import.meta.url) så testen ikke kaster under jsdom.
// ---------------------------------------------------------------------------
describe("Unit 06.7 — ingen @/-import fra UnifiedMapModal i board/motor-filene", () => {
  const files = [
    "components/variants/report/board/BoardMap3D.tsx",
    "components/variants/report/board/BoardMap.tsx",
    "components/variants/report/board/use-board-marker-set.ts",
    "components/variants/report/board/board-flythrough-orchestrator.ts",
    "components/map/motor-camera.ts",
  ];
  for (const f of files) {
    it(`${f} importerer ikke fra UnifiedMapModal`, () => {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(/import[^;]*from\s+["'][^"']*UnifiedMapModal["']/.test(src)).toBe(false);
    });
  }

  it("BoardMap3D + BoardMap henter PendingCamera fra motor-laget (motor-camera)", () => {
    for (const f of [
      "components/variants/report/board/BoardMap3D.tsx",
      "components/variants/report/board/BoardMap.tsx",
    ]) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src).toMatch(
        /import\s+(type\s+)?\{[^}]*PendingCamera[^}]*\}\s+from\s+["']@\/components\/map\/motor-camera["']/,
      );
    }
  });

  it("DEFAULT_CAMERA_LOCK eies av motor-laget (report-3d-config døde ved cutover 2026-07-06)", () => {
    // Den gamle eieren (blocks/report-3d-config.ts) ble slettet som dead code
    // ved cutover-trimmen — vakta er nå kun at motor-laget eier konstanten.
    expect(
      existsSync(join(process.cwd(), "components/variants/report/blocks/report-3d-config.ts")),
    ).toBe(false);
    const motor = readFileSync(
      join(process.cwd(), "components/map/motor-camera.ts"),
      "utf8",
    );
    expect(motor).toMatch(/export const DEFAULT_CAMERA_LOCK/);
  });
});
