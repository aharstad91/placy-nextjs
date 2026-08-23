import { describe, it, expect } from "vitest";
import {
  computePinDemotions,
  DEFAULT_PIN_SEPARATION_PX,
  type PinBlocker,
  type PinCandidate,
} from "./pin-declutter";

const pin = (id: string, x: number, y: number, priority = 0): PinCandidate => ({
  id,
  x,
  y,
  priority,
});

describe("computePinDemotions", () => {
  it("lar godt spredte pins være i fred", () => {
    const res = computePinDemotions([
      pin("a", 0, 0),
      pin("b", 200, 0),
      pin("c", 0, 200),
    ]);
    expect(res.size).toBe(0);
  });

  it("demoterer den med lavest prioritet når to skiver overlapper", () => {
    // 20 px fra hverandre — to 40 px-skiver stablet halvveis oppå hverandre.
    const res = computePinDemotions([
      pin("svak", 100, 100, 3.1),
      pin("sterk", 120, 100, 4.6),
    ]);
    expect([...res]).toEqual(["svak"]);
  });

  it("Grilstad-klynga: fem steder i samme bygg → én beholder ikonet", () => {
    // Fem POI-er innenfor ~30 px, som i kjøpesenteret på Strindfjordvegen.
    const cluster = [
      pin("apotek", 100, 100, 4.1),
      pin("nille", 112, 104, 3.4),
      pin("mall", 96, 116, 4.5),
      pin("blomster", 118, 92, 4.9),
      pin("marina", 106, 110, 2.8),
    ];
    const res = computePinDemotions(cluster);
    const kept = cluster.filter((c) => !res.has(c.id)).map((c) => c.id);
    // Høyest rating eier plassen; resten blir prikker.
    expect(kept).toEqual(["blomster"]);
    expect(res.size).toBe(4);
  });

  it("aktiv POI (Infinity) demoteres aldri — og eier plassen sin", () => {
    const res = computePinDemotions([
      pin("aktiv", 100, 100, Number.POSITIVE_INFINITY),
      pin("nabo", 108, 100, 5),
    ]);
    expect(res.has("aktiv")).toBe(false);
    expect(res.has("nabo")).toBe(true);
  });

  it("en demotert prikk blokkerer ikke videre — klynger sprer seg ikke utover", () => {
    // b demoteres av a. c ligger 30 px fra b, men 60 px fra a: hadde b (som
    // prikk) fortsatt blokkert, ville c urettmessig blitt demotert også.
    const res = computePinDemotions([
      pin("a", 0, 0, 9),
      pin("b", 30, 0, 8),
      pin("c", 60, 0, 7),
    ]);
    expect([...res]).toEqual(["b"]);
  });

  it("er deterministisk uavhengig av input-rekkefølge", () => {
    const pins = [
      pin("a", 0, 0, 5),
      pin("b", 10, 0, 5),
      pin("c", 300, 0, 5),
    ];
    const forward = [...computePinDemotions(pins)].sort();
    const backward = [...computePinDemotions([...pins].reverse())].sort();
    expect(forward).toEqual(backward);
    // Lik prioritet → tiebreak på id, så "a" vinner over "b".
    expect(forward).toEqual(["b"]);
  });

  it("demoterer pins som ligger bak prosjekt-chipen", () => {
    const chip: PinBlocker = {
      x: 400,
      y: 200,
      halfWidth: 160,
      halfHeight: 52,
    };
    const res = computePinDemotions(
      [pin("bak", 380, 210, 5), pin("under", 400, 300, 5)],
      [chip],
    );
    expect(res.has("bak")).toBe(true);
    // 100 px under chip-senteret = utenfor halv-høyden 52 → uberørt.
    expect(res.has("under")).toBe(false);
  });

  it("terskelen er justerbar; default er DEFAULT_PIN_SEPARATION_PX", () => {
    const pins = [pin("a", 0, 0, 9), pin("b", DEFAULT_PIN_SEPARATION_PX - 1, 0, 8)];
    expect(computePinDemotions(pins).has("b")).toBe(true);
    expect(
      computePinDemotions(pins, [], { minSeparationPx: 10 }).has("b"),
    ).toBe(false);
  });

  it("tomt inn → tomt ut", () => {
    expect(computePinDemotions([]).size).toBe(0);
  });
});
