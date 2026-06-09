import { describe, it, expect } from "vitest";
import { intersectVisible } from "./marker-visibility";

describe("intersectVisible (markør-filter-søm, Unit 4)", () => {
  it("undefined visiblePoiIds → base uberørt (boligrapport / ingen aktivt filter)", () => {
    const base = new Set(["a", "b", "c"]);
    const out = intersectVisible(base, undefined);
    expect(out).toEqual(new Set(["a", "b", "c"]));
    // Returnerer en KOPI (muterer ikke input).
    expect(out).not.toBe(base);
  });

  it("intersekter base ∩ visiblePoiIds (komposisjon med phase/kategori-synlighet)", () => {
    const base = new Set(["a", "b", "c", "d"]);
    const visible = new Set(["b", "c", "x"]); // x finnes ikke i base
    const out = intersectVisible(base, visible);
    expect(out).toEqual(new Set(["b", "c"]));
  });

  it("tomt filter-sett → ingen markører synlige (0 treff)", () => {
    const base = new Set(["a", "b"]);
    expect(intersectVisible(base, new Set())).toEqual(new Set());
  });

  it("muterer ikke input-settene", () => {
    const base = new Set(["a", "b"]);
    const visible = new Set(["a"]);
    intersectVisible(base, visible);
    expect(base).toEqual(new Set(["a", "b"]));
    expect(visible).toEqual(new Set(["a"]));
  });
});
