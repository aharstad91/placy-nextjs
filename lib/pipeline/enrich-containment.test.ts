import { describe, it, expect } from "vitest";
import {
  clusterPoints,
  clusterCircle,
  isWorthProbing,
  CLUSTER_LINK_M,
  type ContainmentPoint,
} from "./enrich-containment";

const p = (id: string, name: string, lat: number, lng: number): ContainmentPoint => ({
  id, name, lat, lng, googlePlaceId: null, containedInIds: null,
});

describe("clusterPoints — hvem spørres i samme kall", () => {
  it("binder sammen over avstand, ikke over navn", () => {
    // Charlottenlund: hallen, svømmehallen og banene ligger 100–200 m fra
    // hverandre og har fire ulike navn. De skal spørres i ETT kall.
    const cluster = clusterPoints([
      p("a", "Charlottenlundhallen", 63.42535, 10.48878),
      p("b", "Svømmehall", 63.42615, 10.48820),
      p("c", "Charlottenlund kunstgrasbane", 63.42524, 10.48717),
      p("d", "Charlottenlund skatepark", 63.42620, 10.48771),
    ]);
    expect(cluster).toHaveLength(1);
    expect(cluster[0]).toHaveLength(4);
  });

  it("holder to anlegg fra hverandre når de ligger lenger unna enn lenken", () => {
    // Charlottenlund og Brundalen: 520 m, altså to kall.
    const clusters = clusterPoints([
      p("a", "Charlottenlundhallen", 63.42551, 10.48790),
      p("b", "Brundalen fotballbane", 63.42084, 10.48669),
    ]);
    expect(clusters).toHaveLength(2);
  });

  it("er deterministisk — omstokket input gir samme klynger", () => {
    const points = [
      p("a", "En", 63.4255, 10.4879),
      p("b", "To", 63.4258, 10.4881),
      p("c", "Tre", 63.4300, 10.4990),
    ];
    const key = (cs: ContainmentPoint[][]) =>
      cs.map((c) => c.map((x) => x.id).sort().join(",")).sort();
    expect(key(clusterPoints(points))).toEqual(key(clusterPoints([...points].reverse())));
  });

  it("lenker transitivt — A–B og B–C gir én klynge selv om A og C er for langt fra hverandre", () => {
    const step = CLUSTER_LINK_M * 0.8 / 111320;
    const clusters = clusterPoints([
      p("a", "A", 63.4, 10.5),
      p("b", "B", 63.4 + step, 10.5),
      p("c", "C", 63.4 + 2 * step, 10.5),
    ]);
    expect(clusters).toHaveLength(1);
  });
});

describe("clusterCircle — søkesirkelen", () => {
  it("dekker hele klyngen med margin", () => {
    const circle = clusterCircle([
      p("a", "A", 63.42551, 10.48790),
      p("b", "B", 63.42084, 10.48669),
    ]);
    // Spennet er ~520 m, så halve spennet + 120 m padding ≈ 380 m.
    expect(circle.radius).toBeGreaterThan(300);
    expect(circle.radius).toBeLessThanOrEqual(500);
    expect(circle.depth).toBe(0);
  });

  it("har tak på 500 m — et kall skal ikke bli et discovery-sveip", () => {
    const circle = clusterCircle([
      p("a", "A", 63.40, 10.40),
      p("b", "B", 63.45, 10.50),
    ]);
    expect(circle.radius).toBe(500);
  });

  it("gir en gyldig sirkel også for én POI", () => {
    const circle = clusterCircle([p("a", "A", 63.42551, 10.48790)]);
    expect(circle.radius).toBe(120);
    expect(circle.lat).toBeCloseTo(63.42551, 5);
  });
});

describe("isWorthProbing — hvilke klynger som er verdt et kall", () => {
  it("hopper over en klynge som bare er kopier av samme sted", () => {
    // Tre rader, ett sted: poolen har samme OSM-objekt under flere id-former.
    const kopier = [
      p("osm-way-1", "Charlottenlundhallen", 63.4253, 10.4887),
      p("osm-w-1", "Charlottenlundhallen", 63.4253, 10.4887),
      p("google-1", "charlottenlundhallen", 63.4253, 10.4887),
    ];
    expect(isWorthProbing(kopier)).toBe(false);
  });

  it("spør når tre ULIKE steder ligger sammen", () => {
    expect(
      isWorthProbing([
        p("a", "Charlottenlundhallen", 63.4253, 10.4887),
        p("b", "Svømmehall", 63.4261, 10.4882),
        p("c", "Charlottenlund skatepark", 63.4262, 10.4877),
      ]),
    ).toBe(true);
  });

  it("hopper over en enslig bane", () => {
    expect(isWorthProbing([p("a", "Jakobsli skøytebane", 63.4155, 10.4915)])).toBe(false);
  });
});
