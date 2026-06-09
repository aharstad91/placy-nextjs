import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEventBoardFilter } from "./useEventBoardFilter";
import type { TimeSlot } from "@/lib/kompass-store";
import type { POI } from "@/lib/types";

function poi(
  id: string,
  catId: string,
  eventDates: string[] | undefined,
  eventTimeStart?: string,
): POI {
  return {
    id,
    name: id,
    coordinates: { lat: 0, lng: 0 },
    category: { id: catId, name: catId, icon: "MapPin", color: "#000" },
    eventDates,
    eventTimeStart,
  };
}

function render(
  pois: POI[],
  themes: string[] = [],
  day: string | null = null,
  slots: TimeSlot[] = [],
) {
  return renderHook(() =>
    useEventBoardFilter(pois, themes, day, slots),
  ).result.current;
}

describe("useEventBoardFilter (Unit 4)", () => {
  it("uten filter: alle events synlige, dato-bevisst sortert (D6/R16)", () => {
    const pois = [
      poi("musikk-kveld", "kn-musikk", ["2025-09-12"], "20:00"),
      poi("kunst-tidlig", "kn-kunst", ["2025-09-12"], "18:00"),
    ];
    const r = render(pois);
    expect(r.filteredCount).toBe(2);
    expect(r.hasActiveFilter).toBe(false);
    // Tid-sortert innen samme dag.
    expect(r.recommended.map((p) => p.id)).toEqual([
      "kunst-tidlig",
      "musikk-kveld",
    ]);
    expect(r.visiblePoiIds).toEqual(new Set(["kunst-tidlig", "musikk-kveld"]));
  });

  it("velg tema → kun matchende events i liste OG visiblePoiIds", () => {
    const pois = [
      poi("m1", "kn-musikk", ["2025-09-12"], "20:00"),
      poi("k1", "kn-kunst", ["2025-09-12"], "18:00"),
      poi("m2", "kn-musikk", ["2025-09-12"], "21:00"),
    ];
    const r = render(pois, ["kn-musikk"]);
    expect(r.hasActiveFilter).toBe(true);
    expect(r.recommended.map((p) => p.id)).toEqual(["m1", "m2"]);
    expect(r.visiblePoiIds).toEqual(new Set(["m1", "m2"]));
    // Listen og markør-settet matcher (samme sett).
    expect(r.recommended.length).toBe(r.visiblePoiIds.size);
  });

  it("fler-dags: dag1-15:00 og dag3-15:00 adskilt i seksjoner (ikke kollapset)", () => {
    const pois = [
      poi("d3-15", "t", ["2026-05-25"], "15:00"),
      poi("d1-15", "t", ["2026-05-23"], "15:00"),
      poi("d1-09", "t", ["2026-05-23"], "09:00"),
    ];
    const r = render(pois);
    expect(r.isSingleDay).toBe(false);
    expect(r.days).toEqual(["2026-05-23", "2026-05-25"]);
    expect(r.sections.map((s) => s.dateKey)).toEqual([
      "2026-05-23",
      "2026-05-25",
    ]);
    expect(r.sections[0].pois.map((p) => p.id)).toEqual(["d1-09", "d1-15"]);
    expect(r.sections[1].pois.map((p) => p.id)).toEqual(["d3-15"]);
  });

  it("single-day (Kulturnatt) → isSingleDay true (R13: read-only dag-label)", () => {
    const pois = [
      poi("a", "t", ["2025-09-12"], "18:00"),
      poi("b", "t", ["2025-09-12"], "20:00"),
    ];
    const r = render(pois);
    expect(r.isSingleDay).toBe(true);
    expect(r.days).toEqual(["2025-09-12"]);
  });

  it("tid-filter + event uten starttid → vises (fail-open, R14)", () => {
    const pois = [
      poi("kveld", "t", ["2025-09-12"], "20:00"),
      poi("timeless", "t", ["2025-09-12"], undefined),
      poi("morgen", "t", ["2025-09-12"], "09:00"),
    ];
    // Velg "evening" (≥17): kveld matcher, morgen filtreres bort, timeless beholdes.
    const r = render(pois, [], null, ["evening"]);
    const ids = r.recommended.map((p) => p.id);
    expect(ids).toContain("kveld");
    expect(ids).toContain("timeless");
    expect(ids).not.toContain("morgen");
  });

  it("0 treff (umulig tema-kombo) → tomtilstand-signal (R12)", () => {
    const pois = [poi("a", "kn-musikk", ["2025-09-12"], "20:00")];
    const r = render(pois, ["finnes-ikke"]);
    expect(r.filteredCount).toBe(0);
    expect(r.hasActiveFilter).toBe(true);
    expect(r.visiblePoiIds.size).toBe(0);
    expect(r.recommended).toEqual([]);
  });

  it("udaterte POIer (permanente venues) regnes ikke som events — useKompassFilter dropper dem", () => {
    // useKompassFilter vurderer KUN POIer med eventDates (line 24-26). En POI uten
    // dato er en permanent venue, ikke et programpunkt, så den dukker ikke opp i
    // event-lista. (buildDaySections sin udatert-seksjon dekkes i day-sections-testen
    // for Program-view som kan mate raw POIer direkte.)
    const pois = [
      poi("dated", "t", ["2026-05-23"], "10:00"),
      poi("perm", "t", undefined, undefined),
    ];
    const r = render(pois);
    expect(r.recommended.map((p) => p.id)).toEqual(["dated"]);
    expect(r.sections.every((s) => !s.isUndated)).toBe(true);
  });
});
