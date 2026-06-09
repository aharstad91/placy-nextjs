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

/**
 * Dato-anker for en POI: hvilken dag-seksjon den havner under (D6).
 *
 * Semantikk:
 * - Default (`selectedDay == null`): den TIDLIGSTE (leksikografisk minste, dvs.
 *   kronologisk første for ISO-datoer) av POIens `eventDates` brukes som anker.
 *   En fler-dags-POI ankres da til sin første dag. `[...].sort()` muterer ikke
 *   kilde-arrayet — `poi.eventDates` forblir urørt.
 * - Når et dag-filter er aktivt (`selectedDay` satt) OG POIen kjører den dagen
 *   (`eventDates.includes(selectedDay)`): bruk `selectedDay` som anker. Dette
 *   gjør at en fler-dags-POI (f.eks. Festspillene/Olavsfest over flere dager)
 *   havner under DEN VALGTE dagens seksjon — så seksjons-overskriften matcher
 *   det aktive filteret i stedet for å motsi det (C1). Matcher POIen ikke den
 *   valgte dagen, faller den tilbake til tidligste-dato-ankeret (men den er da
 *   uansett filtrert bort av `useKompassFilter` før den når hit).
 * - Ingen `eventDates`: `UNDATED_KEY` (sorteres sist).
 */
function dateAnchorKey(poi: POI, selectedDay: string | null): string {
  if (poi.eventDates && poi.eventDates.length > 0) {
    if (selectedDay && poi.eventDates.includes(selectedDay)) {
      return selectedDay;
    }
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
 * sentinel-nøklene er leksikografisk størst. `selectedDay` styrer dato-ankeret
 * for fler-dags-POIer (se `dateAnchorKey`).
 */
export function compareByDateThenTime(
  a: POI,
  b: POI,
  selectedDay: string | null = null,
): number {
  const dateCmp = dateAnchorKey(a, selectedDay).localeCompare(
    dateAnchorKey(b, selectedDay),
  );
  if (dateCmp !== 0) return dateCmp;
  const timeCmp = timeKey(a).localeCompare(timeKey(b));
  if (timeCmp !== 0) return timeCmp;
  return a.name.localeCompare(b.name);
}

/**
 * Dato-bevisst flat sortering (R16). Erstatter `useKompassFilter`s dato-blinde
 * tid-sortering når event-board konsumerer resultatet — sorterer på
 * dato-anker + `eventTimeStart`, ikke tid alene. `selectedDay` (valgfri) ankrer
 * fler-dags-POIer til den valgte dagen (C1).
 */
export function sortByDateThenTime(
  pois: POI[],
  selectedDay: string | null = null,
): POI[] {
  return [...pois].sort((a, b) => compareByDateThenTime(a, b, selectedDay));
}

/**
 * Grupper events i dato-seksjoner, hver internt dato-/tid-sortert (R16).
 * Seksjons-rekkefølgen er kronologisk; den udaterte seksjonen (hvis noen) sist.
 *
 * Dette er aggregatet både den flate filter-lista (Variant A) og et fremtidig
 * Program-view (Variant B) bygger på — fler-dags-korrekt fra fundamentet (D6).
 *
 * `selectedDay` (valgfri): når et dag-filter er aktivt, ankres fler-dags-POIer
 * som kjører den valgte dagen til DEN dagens seksjon (via `dateAnchorKey`), så
 * seksjons-overskriften matcher det aktive dag-filteret i stedet for å motsi
 * det (C1). Uten `selectedDay` ankres hver POI til sin tidligste dato.
 */
export function buildDaySections(
  pois: POI[],
  selectedDay: string | null = null,
): EventDaySection[] {
  const byDate = new Map<string, POI[]>();
  for (const poi of pois) {
    const key = dateAnchorKey(poi, selectedDay);
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
    pois: sortByDateThenTime(byDate.get(dateKey)!, selectedDay),
  }));
}

/** Re-eksport så Program-view kan importere timeless-etiketten herfra også. */
export { TIMELESS_BUCKET_LABEL };
