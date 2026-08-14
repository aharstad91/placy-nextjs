import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useEffect } from "react";
import type { ViewportRect } from "@/lib/board/board-types";
import type { BoardCategory, BoardData, BoardPOI } from "../board-data";
import { BoardProvider, useBoard } from "../board-state";
import { useViewportCategoryList } from "./use-viewport-category-list";
import type { ViewportCategoryList } from "./use-viewport-category-list";
import type { TravelMode } from "@/lib/types";

/**
 * Desktop-sidebarens LESE-hook over nabolagsmodellen (2026-08-13).
 *
 * Testes mot en EKTE `BoardProvider`, ikke en mock: det som skal bevises er
 * sømmen mot contexten — at hooken leser utsnittet OG at den aldri skriver
 * markør-state (kilden til kamera-løkken mobilhooken må gate mot).
 */

afterEach(() => cleanup());

const RECT: ViewportRect = {
  west: 10.39,
  east: 10.41,
  south: 63.42,
  north: 63.44,
};
/** Utenfor RECT. */
const FAR = { lat: 63.505, lng: 10.51 };

function poi(
  id: string,
  opts: {
    lat?: number;
    lng?: number;
    walk?: number;
    bike?: number;
    car?: number;
    sub?: string;
  } = {},
): BoardPOI {
  const coordinates = { lat: opts.lat ?? 63.43, lng: opts.lng ?? 10.4 };
  return {
    id: id as BoardPOI["id"],
    name: id,
    coordinates,
    categoryId: "mat" as BoardPOI["categoryId"],
    raw: {
      id,
      name: id,
      coordinates,
      category: {
        id: opts.sub ?? "restaurant",
        name: "Restaurant",
        icon: "UtensilsCrossed",
        color: "#c33",
      },
      travelTime: {
        ...(opts.walk === undefined ? {} : { walk: opts.walk }),
        ...(opts.bike === undefined ? {} : { bike: opts.bike }),
        ...(opts.car === undefined ? {} : { car: opts.car }),
      },
    } as BoardPOI["raw"],
  };
}

const MAT: BoardCategory = {
  id: "mat" as never,
  label: "Mat & drikke",
  lead: "",
  body: "",
  icon: "UtensilsCrossed",
  color: "#cc3300",
  pois: [
    // Bil-tidene inverterer rekkefølgen med vilje: «naer» er nærmest til fots,
    // «mellom» er nærmest i bil. Da beviser en rekkefølge-påstand noe.
    poi("naer", { walk: 3, car: 6 }),
    poi("mellom", { walk: 7, car: 2 }),
    poi("langt", { ...FAR, walk: 25, car: 5 }),
  ],
  topRankedPois: [],
} as unknown as BoardCategory;

function boardData(): BoardData {
  return {
    projectSlug: "sundsoya",
    home: { name: "Hjem", coordinates: { lat: 63.43, lng: 10.4 }, address: "Gata 1" },
    categories: [MAT],
    poisById: new Map(),
    audioTourEnabled: false,
  } as unknown as BoardData;
}

const spy = {
  list: null as ViewportCategoryList | null,
  /** Diskriminatoren som ville blitt satt HVIS noen skrev markør-settet.
   *  Å lese den er en ærligere test enn å mocke funksjonen: den beviser
   *  konsekvensen (markørene ville blitt begrenset og kamera-fitten gatet). */
  visibleIdsSource: null as string | null,
};

function Probe({
  rect,
  category,
  openPoiId,
  travelMode,
}: {
  rect: ViewportRect | null;
  category: BoardCategory | null;
  openPoiId?: string;
  travelMode?: TravelMode;
}) {
  const ctx = useBoard();
  const { setViewportRect, dispatch } = ctx;
  spy.visibleIdsSource = ctx.visibleIdsSource;
  spy.list = useViewportCategoryList(category);

  useEffect(() => {
    setViewportRect(rect);
  }, [setViewportRect, rect]);

  useEffect(() => {
    if (openPoiId) dispatch({ type: "OPEN_POI", id: openPoiId as never });
  }, [dispatch, openPoiId]);

  useEffect(() => {
    if (travelMode) dispatch({ type: "SET_TRAVEL_MODE", mode: travelMode });
  }, [dispatch, travelMode]);

  return null;
}

function setup(
  rect: ViewportRect | null,
  {
    category = MAT,
    openPoiId,
    travelMode,
  }: {
    category?: BoardCategory | null;
    openPoiId?: string;
    travelMode?: TravelMode;
  } = {},
) {
  spy.list = null;
  spy.visibleIdsSource = null;
  return render(
    <BoardProvider data={boardData()}>
      <Probe rect={rect} category={category} openPoiId={openPoiId} travelMode={travelMode} />
    </BoardProvider>,
  );
}

const list = () => spy.list!;

describe("useViewportCategoryList", () => {
  it("lister kun kategoriens punkter i utsnittet, gangtidssortert", () => {
    setup(RECT);
    expect(list().rows.map((r) => r.poi.id)).toEqual(["naer", "mellom"]);
    expect(list().visibleCount).toBe(2);
    expect(list().totalCount).toBe(3);
    expect(list().hiddenCount).toBe(1);
    expect(list().scoped).toBe(true);
  });

  it("gir tidsspennet for de synlige (grunnlag for «2 av 3 synlig · 3–7 min»)", () => {
    setup(RECT);
    expect(list().minMinutes).toBe(3);
    expect(list().maxMinutes).toBe(7);
  });

  it("degraderer til «vis alt» — ikke tom liste — når utsnittet mangler", () => {
    setup(null);
    expect(list().rows.map((r) => r.poi.id)).toEqual(["naer", "mellom", "langt"]);
    expect(list().scoped).toBe(false);
    expect(list().hiddenCount).toBe(0);
  });

  it("gir tom liste (ikke «vis alt») når ingenting er i utsnittet", () => {
    setup({ west: 11, east: 11.1, south: 64, north: 64.1 });
    expect(list().rows).toEqual([]);
    expect(list().visibleCount).toBe(0);
    expect(list().hiddenCount).toBe(3);
    expect(list().scoped).toBe(true);
  });

  it("tar med punkter uten gangtid, uten minutt-tall og sist", () => {
    const utenTid = {
      ...MAT,
      pois: [poi("med", { walk: 4 }), poi("uten")],
    } as unknown as BoardCategory;
    setup(RECT, { category: utenTid });
    expect(list().rows.map((r) => r.poi.id)).toEqual(["med", "uten"]);
    expect(list().rows[1].minutes).toBeUndefined();
  });

  it("holder den åpne POI-en pinnet og ute av den scrollede lista", () => {
    setup(RECT, { openPoiId: "naer" });
    expect(list().activeRow?.poi.id).toBe("naer");
    expect(list().rows.map((r) => r.poi.id)).toEqual(["mellom"]);
  });

  it("beholder den åpne POI-en selv når den er panorert UT av utsnittet", () => {
    // Explorer-buggen fra februar: raden brukeren leste forsvant ved panorering.
    setup(RECT, { openPoiId: "langt" });
    expect(list().activeRow?.poi.id).toBe("langt");
    expect(list().activeRow?.minutes).toBe(25);
    // Den står ikke også i den scrollede lista.
    expect(list().rows.map((r) => r.poi.id)).toEqual(["naer", "mellom"]);
  });

  it("gir ingen aktiv rad når den åpne POI-en tilhører en annen kategori", () => {
    setup(RECT, { openPoiId: "poi-i-annen-kategori" });
    expect(list().activeRow).toBeNull();
    expect(list().rows.map((r) => r.poi.id)).toEqual(["naer", "mellom"]);
  });

  it("håndterer manglende kategori uten å kaste", () => {
    setup(RECT, { category: null });
    expect(list().rows).toEqual([]);
    expect(list().totalCount).toBe(0);
    expect(list().activeRow).toBeNull();
  });

  it("skriver ALDRI markør-state (ingen kamera-løkke)", () => {
    // Mobilhooken setter `viewport-scope` her, som både begrenser markørene og
    // gater kamera-fitten. Desktop-hooken skal la kanalen stå helt urørt.
    setup(RECT, { openPoiId: "naer" });
    expect(spy.visibleIdsSource).toBeNull();
  });
});

describe("useViewportCategoryList — reisemodus", () => {
  it("leser aktiv modus fra board-state (tall og rekkefølge)", () => {
    setup(RECT, { travelMode: "car" });
    expect(list().rows.map((r) => r.poi.id)).toEqual(["mellom", "naer"]);
    expect(list().rows.map((r) => r.minutes)).toEqual([2, 6]);
    expect([list().minMinutes, list().maxMinutes]).toEqual([2, 6]);
  });

  it("den pinnede raden utenfor utsnittet leser samme modus som resten", () => {
    // Bug-en fiksen fantes for: raden brukeren leser skal ikke forsvinne når
    // punktet glir ut av utsnittet. Den skal heller ikke vise gangtid mens
    // resten av lista viser biltid.
    setup(RECT, { openPoiId: "langt", travelMode: "car" });
    expect(list().activeRow?.poi.id).toBe("langt");
    expect(list().activeRow?.minutes).toBe(5);
  });

  it("modus uten data → den pinnede raden vises uten tall, ikke med et fremmed", () => {
    setup(RECT, { openPoiId: "langt", travelMode: "bike" });
    expect(list().activeRow?.poi.id).toBe("langt");
    expect(list().activeRow?.minutes).toBeUndefined();
  });

  it("modusbytte endrer ikke hvilke punkter som er synlige", () => {
    for (const travelMode of ["walk", "bike", "car"] as const) {
      setup(RECT, { travelMode });
      expect(list().visibleCount).toBe(2);
      expect(list().hiddenCount).toBe(1);
      cleanup();
    }
  });
});
