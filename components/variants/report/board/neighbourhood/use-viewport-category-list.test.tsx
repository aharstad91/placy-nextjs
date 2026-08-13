import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useEffect } from "react";
import type { ViewportRect } from "@/lib/board/board-types";
import type { BoardCategory, BoardData, BoardPOI } from "../board-data";
import { BoardProvider, useBoard } from "../board-state";
import { useViewportCategoryList } from "./use-viewport-category-list";
import type { ViewportCategoryList } from "./use-viewport-category-list";

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
  opts: { lat?: number; lng?: number; walk?: number; sub?: string } = {},
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
      travelTime: opts.walk === undefined ? undefined : { walk: opts.walk },
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
    poi("naer", { walk: 3 }),
    poi("mellom", { walk: 7 }),
    poi("langt", { ...FAR, walk: 25 }),
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
}: {
  rect: ViewportRect | null;
  category: BoardCategory | null;
  openPoiId?: string;
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

  return null;
}

function setup(
  rect: ViewportRect | null,
  { category = MAT, openPoiId }: { category?: BoardCategory | null; openPoiId?: string } = {},
) {
  spy.list = null;
  spy.visibleIdsSource = null;
  return render(
    <BoardProvider data={boardData()}>
      <Probe rect={rect} category={category} openPoiId={openPoiId} />
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
    expect(list().minWalk).toBe(3);
    expect(list().maxWalk).toBe(7);
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
    expect(list().rows[1].walkMinutes).toBeUndefined();
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
    expect(list().activeRow?.walkMinutes).toBe(25);
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
