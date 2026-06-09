/**
 * Tid-bøtte-grenser for event-board-filtreringen — ÉN delt kilde mellom
 * filter-chipsene (Unit 4) og det fremtidige Program-view (varianter-planen).
 *
 * `useKompassFilter` (D5, uendret) bruker de samme time-of-day-grensene internt
 * (morning < 12, afternoon 12–17, evening ≥ 17). Vi speiler dem her som data
 * + en ren `bucketForTime`-helper slik at både chip-rendering, dag-seksjons-
 * aggregatet og en senere agenda-/tidslinje-view leser de samme tallene i stedet
 * for å duplisere magiske konstanter. Endrer man grensen ett sted, endres den
 * overalt.
 */

import type { TimeSlot } from "@/lib/kompass-store";

export interface TimeBucketDef {
  /** Maskinell nøkkel — matcher `TimeSlot` i kompass-store (filter-kontrakt). */
  slot: TimeSlot;
  /** Norsk etikett for chip / seksjons-overskrift. */
  label: string;
  /** Inklusiv nedre time-grense (24t). */
  startHour: number;
  /** Eksklusiv øvre time-grense (24t). `endHour: 24` = ut døgnet. */
  endHour: number;
}

/**
 * Kanonisk rekkefølge + grenser for tid-på-døgnet-bøttene. Grensene MÅ holde seg
 * synkronisert med `useKompassFilter`s `selectedTimeSlots`-logikk:
 *   morning  → hour < 12
 *   afternoon→ 12 ≤ hour < 17
 *   evening  → hour ≥ 17
 */
export const TIME_BUCKETS: readonly TimeBucketDef[] = [
  { slot: "morning", label: "Morgen", startHour: 0, endHour: 12 },
  { slot: "afternoon", label: "Ettermiddag", startHour: 12, endHour: 17 },
  { slot: "evening", label: "Kveld", startHour: 17, endHour: 24 },
] as const;

/**
 * Etikett for events uten oppgitt starttid (R14, fail-open). Disse filtreres
 * ALDRI bort av et tid-filter, og samles i en egen "timeless"-gruppe som
 * sorteres sist (R16).
 */
export const TIMELESS_BUCKET_LABEL = "Tidspunkt ikke oppgitt";

/**
 * Plasser en `HH:MM`-starttid i riktig tid-bøtte. Returnerer `null` for
 * manglende/ugyldig tid (timeless — håndteres som egen gruppe av kalleren,
 * fail-open per R14). Ren funksjon — ingen React, trygt å dele med Program-view.
 */
export function bucketForTime(timeStart?: string): TimeSlot | null {
  if (!timeStart) return null;
  const hour = parseInt(timeStart.split(":")[0], 10);
  if (Number.isNaN(hour)) return null;
  const bucket = TIME_BUCKETS.find(
    (b) => hour >= b.startHour && hour < b.endHour,
  );
  return bucket?.slot ?? null;
}
