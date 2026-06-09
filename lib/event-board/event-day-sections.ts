/**
 * Dato-bevisst sortering + dag-seksjons-aggregat for event-board (D6, R16, R14).
 *
 * BAKGRUNN (D6): `useKompassFilter` sorterer på `eventTimeStart` (HH:MM) ALENE —
 * dato-blindt. For et fler-dags-prosjekt (f.eks. Festspillene i Bergen) kollapser
 * det da dag1-15:00 og dag3-15:00 til samme posisjon i lista. Dette laget løser
 * det ved å sortere/gruppere på `eventDates[0] + eventTimeStart` (DATO først, så
 * tid), og bygger et dag-seksjons-aggregat som BÅDE den flate filter-lista OG et
 * fremtidig Program-view (varianter-planen) kan konsumere — i fundamentet, ikke
 * i en variant.
 *
 * Rene funksjoner, ingen React — trygt å dele på tvers av liste, kart-fit og
 * agenda-view, og enkelt å enhetsteste.
 */

import type { POI } from "@/lib/types";
import { TIMELESS_BUCKET_LABEL } from "./event-filter-constants";

/**
 * Sentinel-dato for events uten `eventDates` (permanente venues / udaterte
 * events). Sorteres sist (R16: timeless/udatert sist). ISO-form så den fortsatt
 * `localeCompare`-er korrekt mot ekte datoer ("9999-..." > "2025-...").
 */
export const UNDATED_KEY = "9999-99-99";

/**
 * Sentinel-tid for events uten `eventTimeStart` (R14: "Tidspunkt ikke oppgitt").
 * Sorteres sist innen sin dag (timeless etter alle tidfestede). "99:99" >
 * enhver ekte HH:MM via `localeCompare`.
 */
export const TIMELESS_TIME = "99:99";

/**
 * En dato-seksjon i programmet. `dateKey` er ISO-datoen (eller `UNDATED_KEY` for
 * udaterte). `pois` er allerede dato-/tid-sortert (R16).
 */
export interface EventDaySection {
  /** ISO-dato ("2025-09-12") eller `UNDATED_KEY` for udaterte events. */
  dateKey: string;
  /** True når seksjonen samler udaterte events (rendres uten dato-overskrift). */
  isUndated: boolean;
  pois: POI[];
}

/** Første event-dato på en POI, eller `UNDATED_KEY` hvis ingen. */
function firstDateKey(poi: POI): string {
  if (poi.eventDates && poi.eventDates.length > 0) {
    // Bevar kilde-rekkefølgen, men bruk den TIDLIGSTE datoen som sorteringsanker
    // (en POI kan ha flere datoer — den sorteres på sin første forekomst).
    return [...poi.eventDates].sort()[0];
  }
  return UNDATED_KEY;
}

/** Start-tid for sortering, med timeless-sentinel sist (R14/R16). */
function timeKey(poi: POI): string {
  return poi.eventTimeStart ?? TIMELESS_TIME;
}

/**
 * Dato-bevisst sammenligning: DATO først (R16: dato+tid stigende), så tid;
 * stabilt navne-tiebreak så rekkefølgen er deterministisk på tvers av renders.
 * Udaterte (UNDATED_KEY) og timeless (TIMELESS_TIME) faller naturlig sist fordi
 * sentinel-nøklene er leksikografisk størst.
 */
export function compareByDateThenTime(a: POI, b: POI): number {
  const dateCmp = firstDateKey(a).localeCompare(firstDateKey(b));
  if (dateCmp !== 0) return dateCmp;
  const timeCmp = timeKey(a).localeCompare(timeKey(b));
  if (timeCmp !== 0) return timeCmp;
  return a.name.localeCompare(b.name);
}

/**
 * Dato-bevisst flat sortering (R16). Erstatter `useKompassFilter`s dato-blinde
 * tid-sortering når event-board konsumerer resultatet — sorterer på
 * `eventDates[0] + eventTimeStart`, ikke tid alene.
 */
export function sortByDateThenTime(pois: POI[]): POI[] {
  return [...pois].sort(compareByDateThenTime);
}

/**
 * Grupper events i dato-seksjoner, hver internt dato-/tid-sortert (R16).
 * Seksjons-rekkefølgen er kronologisk; den udaterte seksjonen (hvis noen) sist.
 *
 * Dette er aggregatet både den flate filter-lista (Variant A) og et fremtidig
 * Program-view (Variant B) bygger på — fler-dags-korrekt fra fundamentet (D6).
 */
export function buildDaySections(pois: POI[]): EventDaySection[] {
  const byDate = new Map<string, POI[]>();
  for (const poi of pois) {
    const key = firstDateKey(poi);
    const bucket = byDate.get(key);
    if (bucket) bucket.push(poi);
    else byDate.set(key, [poi]);
  }

  const sortedKeys = Array.from(byDate.keys()).sort((a, b) =>
    a.localeCompare(b),
  );

  return sortedKeys.map((dateKey) => ({
    dateKey,
    isUndated: dateKey === UNDATED_KEY,
    pois: sortByDateThenTime(byDate.get(dateKey)!),
  }));
}

/** Re-eksport så Program-view kan importere timeless-etiketten herfra også. */
export { TIMELESS_BUCKET_LABEL };
