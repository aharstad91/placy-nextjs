"use client";

import { useMemo } from "react";
import type { POI } from "@/lib/types";
import type { TimeSlot } from "@/lib/kompass-store";
import { useKompassFilter } from "@/lib/hooks/useKompassFilter";
import { useEventDays } from "@/lib/hooks/useEventDayFilter";
import { buildDaySections, type EventDaySection } from "./event-day-sections";

/**
 * Event-board filtreringslag (Unit 4). Komponerer de eksisterende, UENDREDE
 * hookene til den delte tilstanden både sidebar-lista og `BoardMap` leser:
 *
 * - D5: filtreringen kjører på `raw`-POIene (`BoardPOI.raw`). Kalleren mater inn
 *   `boardData.categories.flatMap(c => c.pois.map(p => p.raw))` — `useKompassFilter`
 *   forblir `POI[]`-basert, ingen hook-refaktor.
 * - D6: resultatet sorteres DATO-bevisst (`eventDates[0] + eventTimeStart`) og
 *   eksponeres BÅDE som flat liste og som dag-seksjons-aggregat (`buildDaySections`)
 *   — fler-dags-korrekt fra fundamentet, brukbart av både liste og fremtidig
 *   Program-view.
 * - R13: `isSingleDay` (én unik event-dag) → kalleren viser dag-kontrollen som
 *   read-only dato-label i stedet for en velger.
 * - R12: `hasActiveFilter` + `filteredCount` → kalleren rendrer tomtilstand + en
 *   "nullstill filter"-CTA når antall = 0 og minst ett filter er aktivt.
 * - R14: tid-filter er fail-open (events uten starttid vises) — arvet fra
 *   `useKompassFilter` (linje 57: `if (!startTime) return true`).
 */
export interface EventBoardFilterResult {
  /** Dato-bevisst sorterte, filtrerte events (R16). */
  recommended: POI[];
  /** Synlige POI-IDer — mates til `BoardMap`s `visiblePoiIds`-prop (markør-søm). */
  visiblePoiIds: Set<string>;
  /** Dato-seksjons-aggregat (D6) for liste + fremtidig Program-view. */
  sections: EventDaySection[];
  /** Unike event-dager, kronologisk sortert (fra `useEventDays`). */
  days: string[];
  /** R13: nøyaktig én event-dag → dag-kontroll vises read-only (Kulturnatt). */
  isSingleDay: boolean;
  /** Antall events etter filtrering (R12 tomtilstand-signal). */
  filteredCount: number;
  /** True når minst ett filter er aktivt (tema/dag/tid) — gater R12-CTA. */
  hasActiveFilter: boolean;
}

export function useEventBoardFilter(
  /** `raw`-POIer (D5). Kalleren henter dem fra `BoardPOI.raw`. */
  rawPois: POI[],
  selectedThemes: string[],
  selectedDay: string | null,
  selectedTimeSlots: TimeSlot[],
): EventBoardFilterResult {
  // D5: useKompassFilter (uendret) gjør tema/dag/tid-filtreringen på raw-POIene.
  const { recommended: kompassRecommended } = useKompassFilter(
    rawPois,
    selectedThemes,
    selectedDay,
    selectedTimeSlots,
  );

  // D6: bygg dag-seksjons-aggregatet dato-bevisst. `useKompassFilter` sorterer
  // KUN på tid (HH:MM), dato-blindt — DEN indre sorten er bevisst en no-op her:
  // `buildDaySections` re-sorterer dato-bevisst (dato-anker + tid) internt og
  // OVERSKRIVER rekkefølgen fra `kompassRecommended` fullstendig (C3). En
  // fremtidig leser skal derfor IKKE anta at rekkefølgen ut av `useKompassFilter`
  // betyr noe for event-board — kun medlemskapet (hvilke POIer som passerte
  // filteret) brukes. (useKompassFilter er delt med Explorer og forblir urørt.)
  //
  // C1: `selectedDay` mates inn så fler-dags-POIer som kjører den valgte dagen
  // ankres til DEN dagens seksjon — seksjons-overskriften matcher dag-filteret.
  const sections = useMemo(
    () => buildDaySections(kompassRecommended, selectedDay),
    [kompassRecommended, selectedDay],
  );

  const recommended = useMemo(
    () => sections.flatMap((s) => s.pois),
    [sections],
  );

  const visiblePoiIds = useMemo(
    () => new Set(recommended.map((p) => p.id)),
    [recommended],
  );

  // R13: unike event-dager fra alle raw-POIer (ikke det filtrerte settet — vi vil
  // vite om PROSJEKTET er én- eller fler-dags, uavhengig av aktivt filter).
  const days = useEventDays(rawPois);
  const isSingleDay = days.length === 1;

  const hasActiveFilter =
    selectedThemes.length > 0 || selectedDay !== null || selectedTimeSlots.length > 0;

  return {
    recommended,
    visiblePoiIds,
    sections,
    days,
    isSingleDay,
    filteredCount: recommended.length,
    hasActiveFilter,
  };
}
