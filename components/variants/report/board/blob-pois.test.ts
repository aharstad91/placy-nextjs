import { describe, it, expect } from "vitest";
import { selectFlyoverBlobs } from "./blob-pois";
import type { BoardCategory } from "./board-data";
import type { POI } from "@/lib/types";

// Minimal POI/kategori-fabrikk — bare feltene selectFlyoverBlobs leser.
function poi(id: string, lat: number, lng: number): POI {
  return {
    id,
    coordinates: { lat, lng },
    category: { id: "cat", color: "#abc", icon: "MapPin" },
  } as unknown as POI;
}
function cat(pois: POI[]): BoardCategory {
  return { pois: pois.map((raw) => ({ raw })) } as unknown as BoardCategory;
}

// Flylinje langs ekvator-ish: start (0,0) → slutt (0, 0.02) ≈ ren øst-vest.
const START = { lat: 0, lng: 0 };
const END = { lat: 0, lng: 0.02 };

describe("selectFlyoverBlobs — korridor + fly-over-orden", () => {
  it("beholder kun POI-er innenfor korridoren (perp-avstand til linja)", () => {
    // ~1 grad lat ≈ 110540 m → 0.01 grad ≈ 1105 m unna linja.
    const near = poi("near", 0.0005, 0.01); // ~55 m nord for linja
    const far = poi("far", 0.01, 0.01); // ~1105 m nord — utenfor 750 m
    const res = selectFlyoverBlobs(START, END, [cat([near, far])], 750, 50);
    const ids = res.map((r) => r.poi.id);
    expect(ids).toContain("near");
    expect(ids).not.toContain("far");
  });

  it("sorterer i fly-over-orden (at stigende = start→slutt)", () => {
    const a = poi("a", 0, 0.004); // at ≈ 0.2
    const b = poi("b", 0, 0.012); // at ≈ 0.6
    const c = poi("c", 0, 0.018); // at ≈ 0.9
    // gitt i vilkårlig rekkefølge
    const res = selectFlyoverBlobs(START, END, [cat([c, a, b])], 750, 50);
    expect(res.map((r) => r.poi.id)).toEqual(["a", "b", "c"]);
    for (let i = 1; i < res.length; i++) {
      expect(res[i].at).toBeGreaterThanOrEqual(res[i - 1].at);
    }
  });

  it("at klampes til [0,1] også for POI-er forbi endepunktene", () => {
    const before = poi("before", 0, -0.005); // bak start
    const after = poi("after", 0, 0.05); // forbi slutt (men nær linja-forlengelsen)
    const res = selectFlyoverBlobs(START, END, [cat([before, after])], 750, 50);
    for (const r of res) {
      expect(r.at).toBeGreaterThanOrEqual(0);
      expect(r.at).toBeLessThanOrEqual(1);
    }
  });

  it("respekterer limit ved å beholde de nærmeste linja, så sortere på at", () => {
    const pois = [
      poi("p0", 0.0001, 0.002), // svært nær linja
      poi("p1", 0.0001, 0.01),
      poi("p2", 0.0001, 0.018),
      poi("p3", 0.006, 0.006), // lenger fra linja (~660 m) → kuttes ved limit 3
    ];
    const res = selectFlyoverBlobs(START, END, [cat(pois)], 750, 3);
    expect(res).toHaveLength(3);
    expect(res.map((r) => r.poi.id)).not.toContain("p3");
    // fortsatt fly-over-sortert
    for (let i = 1; i < res.length; i++) {
      expect(res[i].at).toBeGreaterThanOrEqual(res[i - 1].at);
    }
  });

  it("dedupliserer POI-id på tvers av kategorier", () => {
    const shared = poi("dup", 0, 0.01);
    const res = selectFlyoverBlobs(
      START,
      END,
      [cat([shared]), cat([shared])],
      750,
      50,
    );
    expect(res.filter((r) => r.poi.id === "dup")).toHaveLength(1);
  });
});
