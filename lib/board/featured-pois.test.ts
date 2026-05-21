import { describe, it, expect } from "vitest";
import { pickFeaturedPOIs } from "./featured-pois";
import type {
  BoardPOI,
  BoardPOIId,
  BoardCategoryId,
} from "@/components/variants/report/board/board-data";
import type { POI } from "@/lib/types";

function makePOI(name: string): BoardPOI {
  return {
    id: name as unknown as BoardPOIId,
    name,
    coordinates: { lat: 0, lng: 0 },
    categoryId: "test-cat" as unknown as BoardCategoryId,
    raw: {} as POI,
  };
}

const POOL: BoardPOI[] = [
  makePOI("Lily"),
  makePOI("Solsiden"),
  makePOI("Bryggen"),
  makePOI("Verkstedhallen"),
  makePOI("Skarpsno"),
  makePOI("Bakeriet"),
  makePOI("Aroma"),
  makePOI("Nidaros"),
];

describe("pickFeaturedPOIs", () => {
  it("returnerer count POIs når pool er stor nok", () => {
    const out = pickFeaturedPOIs(POOL, 5, "mat-drikke");
    expect(out).toHaveLength(5);
  });

  it("er deterministisk for samme seed", () => {
    const a = pickFeaturedPOIs(POOL, 5, "mat-drikke");
    const b = pickFeaturedPOIs(POOL, 5, "mat-drikke");
    expect(a.map((p) => p.name)).toEqual(b.map((p) => p.name));
  });

  it("gir ulik rekkefølge for ulik seed", () => {
    const a = pickFeaturedPOIs(POOL, 5, "mat-drikke");
    const b = pickFeaturedPOIs(POOL, 5, "hverdagsliv");
    expect(a.map((p) => p.name)).not.toEqual(b.map((p) => p.name));
  });

  it("returnerer alle POIs når pool er mindre enn count", () => {
    const small = POOL.slice(0, 3);
    const out = pickFeaturedPOIs(small, 5, "any");
    expect(out).toHaveLength(3);
  });

  it("returnerer tom array for tom input", () => {
    expect(pickFeaturedPOIs([], 5, "any")).toEqual([]);
  });

  it("returnerer tom array for count <= 0", () => {
    expect(pickFeaturedPOIs(POOL, 0, "any")).toEqual([]);
    expect(pickFeaturedPOIs(POOL, -1, "any")).toEqual([]);
  });

  it("muterer ikke input-array", () => {
    const snapshot = POOL.map((p) => p.name);
    pickFeaturedPOIs(POOL, 5, "mat-drikke");
    expect(POOL.map((p) => p.name)).toEqual(snapshot);
  });

  it("returnerer faktiske POI-referanser fra input", () => {
    const out = pickFeaturedPOIs(POOL, 3, "test");
    for (const p of out) {
      expect(POOL).toContain(p);
    }
  });
});
