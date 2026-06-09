import { describe, it, expect } from "vitest";
import {
  sortByDateThenTime,
  buildDaySections,
  UNDATED_KEY,
} from "./event-day-sections";
import type { POI } from "@/lib/types";

function poi(
  id: string,
  eventDates: string[] | undefined,
  eventTimeStart?: string,
): POI {
  return {
    id,
    name: id,
    coordinates: { lat: 0, lng: 0 },
    category: { id: "c", name: "C", icon: "MapPin", color: "#000" },
    eventDates,
    eventTimeStart,
  };
}

describe("event-day-sections", () => {
  describe("sortByDateThenTime (R16, D6)", () => {
    it("sorterer DATO først, så tid (dato-bevisst) — ikke tid alene", () => {
      // Dato-blind tid-sortering ville plassert dag1-15:00 og dag3-15:00 likt.
      const day1_15 = poi("d1-15", ["2026-05-23"], "15:00");
      const day3_15 = poi("d3-15", ["2026-05-25"], "15:00");
      const day1_09 = poi("d1-09", ["2026-05-23"], "09:00");

      const sorted = sortByDateThenTime([day3_15, day1_15, day1_09]);
      expect(sorted.map((p) => p.id)).toEqual(["d1-09", "d1-15", "d3-15"]);
    });

    it("timeless (ingen starttid) sorteres sist innen sin dag (R14/R16)", () => {
      const timed = poi("timed", ["2026-05-23"], "10:00");
      const timeless = poi("timeless", ["2026-05-23"], undefined);
      const sorted = sortByDateThenTime([timeless, timed]);
      expect(sorted.map((p) => p.id)).toEqual(["timed", "timeless"]);
    });

    it("udaterte events sorteres sist (R16)", () => {
      const dated = poi("dated", ["2026-05-23"], "10:00");
      const undated = poi("undated", undefined, "08:00");
      const sorted = sortByDateThenTime([undated, dated]);
      expect(sorted.map((p) => p.id)).toEqual(["dated", "undated"]);
    });
  });

  describe("buildDaySections (D6)", () => {
    it("holder fler-dags adskilt — dag1-15:00 og dag3-15:00 i ulike seksjoner (ikke kollapset)", () => {
      const pois = [
        poi("d1-15", ["2026-05-23"], "15:00"),
        poi("d3-15", ["2026-05-25"], "15:00"),
        poi("d1-09", ["2026-05-23"], "09:00"),
      ];
      const sections = buildDaySections(pois);

      expect(sections.map((s) => s.dateKey)).toEqual([
        "2026-05-23",
        "2026-05-25",
      ]);
      expect(sections[0].pois.map((p) => p.id)).toEqual(["d1-09", "d1-15"]);
      expect(sections[1].pois.map((p) => p.id)).toEqual(["d3-15"]);
    });

    it("single-day (Kulturnatt) gir én seksjon, tid-sortert", () => {
      const pois = [
        poi("kveld", ["2025-09-12"], "20:00"),
        poi("tidlig", ["2025-09-12"], "18:00"),
      ];
      const sections = buildDaySections(pois);
      expect(sections).toHaveLength(1);
      expect(sections[0].dateKey).toBe("2025-09-12");
      expect(sections[0].isUndated).toBe(false);
      expect(sections[0].pois.map((p) => p.id)).toEqual(["tidlig", "kveld"]);
    });

    it("udaterte events havner i en egen seksjon sist (isUndated)", () => {
      const pois = [
        poi("undated", undefined, undefined),
        poi("dated", ["2026-05-23"], "10:00"),
      ];
      const sections = buildDaySections(pois);
      expect(sections.map((s) => s.dateKey)).toEqual([
        "2026-05-23",
        UNDATED_KEY,
      ]);
      expect(sections[1].isUndated).toBe(true);
      expect(sections[1].pois.map((p) => p.id)).toEqual(["undated"]);
    });

    it("tomt input → ingen seksjoner", () => {
      expect(buildDaySections([])).toEqual([]);
    });

    it("fler-dags-POI + selectedDay → ankres til den VALGTE dagen, ikke tidligste (C1)", () => {
      // Et arrangement som går dag1 OG dag3 (Festspillene/Olavsfest-virkelighet).
      // Uten selectedDay ankres det til tidligste dato (dag1). Med selectedDay=dag3
      // skal seksjons-overskriften matche dag-filteret → POIen under dag3-seksjonen.
      const flerDags = poi("fler-dags", ["2026-05-23", "2026-05-25"], "15:00");
      const kunDag3 = poi("kun-dag3", ["2026-05-25"], "12:00");

      // Default-anker (ingen valgt dag): fler-dags havner under dag1.
      const defaultSections = buildDaySections([flerDags, kunDag3]);
      expect(defaultSections.map((s) => s.dateKey)).toEqual([
        "2026-05-23",
        "2026-05-25",
      ]);
      expect(defaultSections[0].pois.map((p) => p.id)).toEqual(["fler-dags"]);
      expect(defaultSections[1].pois.map((p) => p.id)).toEqual(["kun-dag3"]);

      // Med selectedDay=dag3: fler-dags ankres til dag3 sammen med kun-dag3.
      const day3Sections = buildDaySections(
        [flerDags, kunDag3],
        "2026-05-25",
      );
      expect(day3Sections.map((s) => s.dateKey)).toEqual(["2026-05-25"]);
      // Tid-sortert innen dag3: kun-dag3 (12:00) før fler-dags (15:00).
      expect(day3Sections[0].pois.map((p) => p.id)).toEqual([
        "kun-dag3",
        "fler-dags",
      ]);
    });

    it("selectedDay som POIen IKKE kjører → faller tilbake til tidligste-anker", () => {
      // POI går kun dag1; selectedDay=dag2 (matcher ikke). Ankeret skal forbli
      // tidligste dato — i praksis er en slik POI uansett filtrert bort av
      // useKompassFilter før buildDaySections kalles, men funksjonen er robust.
      const kunDag1 = poi("kun-dag1", ["2026-05-23"], "10:00");
      const sections = buildDaySections([kunDag1], "2026-05-24");
      expect(sections.map((s) => s.dateKey)).toEqual(["2026-05-23"]);
      expect(sections[0].pois.map((p) => p.id)).toEqual(["kun-dag1"]);
    });
  });
});
