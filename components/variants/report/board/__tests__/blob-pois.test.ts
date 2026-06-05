import { describe, it, expect } from "vitest";
import { selectBlobPOIs } from "../blob-pois";
import type { BoardCategory, BoardCategoryId, BoardPOI, BoardPOIId } from "../board-data";
import type { POI } from "@/lib/types";

const HOME = { lat: 63.4366, lng: 10.4 };

function makePOI(id: string, lat: number, lng: number, color = "#3b82f6"): POI {
  return {
    id,
    name: id,
    coordinates: { lat, lng },
    category: { id: "x", name: "x", icon: "MapPin", color },
  } as unknown as POI;
}

function makeCategory(id: string, pois: POI[]): BoardCategory {
  return {
    id: id as BoardCategoryId,
    label: id,
    lead: "",
    body: "",
    icon: "MapPin",
    color: "#3b82f6",
    pois: pois.map(
      (p): BoardPOI => ({
        id: p.id as BoardPOIId,
        name: p.name,
        coordinates: p.coordinates,
        categoryId: id as BoardCategoryId,
        raw: p,
      }),
    ),
    topRankedPois: [],
  };
}

describe("selectBlobPOIs", () => {
  it("returnerer POI-ene sortert etter avstand fra home, nærmeste først", () => {
    const cats = [
      makeCategory("a", [
        makePOI("far", 63.46, 10.45), // lengst unna
        makePOI("near", 63.4368, 10.4002), // nesten på home
      ]),
      makeCategory("b", [makePOI("mid", 63.442, 10.41)]),
    ];

    const result = selectBlobPOIs(HOME, cats, 10);

    expect(result.map((p) => p.id)).toEqual(["near", "mid", "far"]);
  });

  it("kapper på limit (de N nærmeste)", () => {
    const cats = [
      makeCategory("a", [
        makePOI("p1", 63.437, 10.4001),
        makePOI("p2", 63.438, 10.4002),
        makePOI("p3", 63.45, 10.44),
      ]),
    ];

    const result = selectBlobPOIs(HOME, cats, 2);

    expect(result.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("dedupliserer POI som finnes i flere kategorier (første forekomst vinner)", () => {
    const shared = makePOI("shared", 63.437, 10.4001, "#ff0000");
    const cats = [
      makeCategory("a", [shared]),
      makeCategory("b", [shared, makePOI("other", 63.44, 10.41)]),
    ];

    const result = selectBlobPOIs(HOME, cats, 10);

    expect(result.filter((p) => p.id === "shared")).toHaveLength(1);
    expect(result.map((p) => p.id)).toEqual(["shared", "other"]);
  });

  it("bevarer kategori-fargen på hver POI", () => {
    const cats = [makeCategory("a", [makePOI("p", 63.437, 10.4001, "#abcdef")])];

    const result = selectBlobPOIs(HOME, cats, 10);

    expect(result[0].category.color).toBe("#abcdef");
  });

  it("returnerer tom array ved limit 0 eller ingen kategorier", () => {
    const cats = [makeCategory("a", [makePOI("p", 63.437, 10.4001)])];
    expect(selectBlobPOIs(HOME, cats, 0)).toEqual([]);
    expect(selectBlobPOIs(HOME, [], 10)).toEqual([]);
  });

  it("ekskluderer POI-er i excludeIds (legend-pins blir ikke også blobs)", () => {
    const cats = [
      makeCategory("a", [
        makePOI("legend", 63.437, 10.4001),
        makePOI("blob1", 63.438, 10.4002),
        makePOI("blob2", 63.44, 10.41),
      ]),
    ];

    const result = selectBlobPOIs(HOME, cats, 10, new Set(["legend"]));

    expect(result.map((p) => p.id)).toEqual(["blob1", "blob2"]);
    expect(result.some((p) => p.id === "legend")).toBe(false);
  });
});
