"use client";

import { useMemo } from "react";
import type { POI } from "@/lib/types";

export interface OpeningHoursData {
  isOpen?: boolean;
  openingHours?: string[];
}

/**
 * Parse cached opening hours from POI data.
 *
 * Reads from poi.openingHoursJson (cached in Supabase) instead of
 * making runtime Google Places API calls. Computes isOpen client-side
 * from weekday_text to avoid stale snapshot values.
 */
export function useOpeningHours(visiblePOIs: POI[]) {
  const hoursData = useMemo(() => {
    const map = new Map<string, OpeningHoursData>();

    for (const poi of visiblePOIs) {
      const weekdayText = poi.openingHoursJson?.weekday_text;
      if (!weekdayText || weekdayText.length === 0) continue;

      map.set(poi.id, {
        openingHours: weekdayText,
        isOpen: computeIsOpen(weekdayText),
      });
    }

    return map;
  }, [visiblePOIs]);

  return { hoursData, loading: false };
}

/**
 * Er stedet åpent akkurat nå, lest ut av `weekday_text`.
 *
 * SPRÅKUAVHENGIG (2026-09-06). Fram til nå fant denne dagens linje ved å matche
 * engelske dagsnavn («Monday») og leste bare AM/PM-tider. Google svarer på
 * språket kallet ble gjort på, og nærhetssøket spør nå på norsk
 * (`SEARCH_LANGUAGE` i poi-discovery.ts) — hver eneste linje ville sluttet å
 * matche. Ikke med en feil: bare en åpent/stengt-markør som forsvant fra hvert
 * kort på boardet.
 *
 * Dagen finnes ved POSISJON i lista (Places-kontrakten er alltid mandag først),
 * ikke ved dagsnavn, og tidsmønsteret gjør AM/PM valgfritt. Flere intervaller
 * per dag (lunsjstengt) og åpent over midnatt beholdes — begge var håndtert før
 * og skal fortsatt være det.
 */
export function computeIsOpen(weekdayText: string[]): boolean | undefined {
  if (weekdayText.length !== 7) return undefined;
  // JS: 0 = søndag. Googles liste: 0 = mandag.
  const now = new Date();
  const line = weekdayText[(now.getDay() + 6) % 7];
  if (!line) return undefined;

  const idx = line.indexOf(": ");
  if (idx === -1) return undefined;
  // Googles engelske strenger bruker U+202F (narrow no-break) og U+2009 (thin).
  const value = line
    .slice(idx + 2)
    .replace(/[\u202f\u2009]/g, " ")
    .trim();

  if (/^(closed|stengt)$/i.test(value)) return false;
  if (/^(open 24 hours|døgnåpent)$/i.test(value)) return true;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let sawRange = false;

  for (const range of value.split(",").map((r) => r.trim())) {
    const m = /^(\d{1,2})[:.](\d{2})\s*(AM|PM)?\s*[–—-]\s*(\d{1,2})[:.](\d{2})\s*(AM|PM)?$/i.exec(
      range
    );
    if (!m) continue;
    sawRange = true;
    // Google dropper åpningstidens markør når begge ligger i samme døgnhalvdel:
    // «1:00 – 10:00 PM» er 13–22. Uten arven leses «1:00» som klokka 01.
    const open = toMinutes(Number(m[1]), Number(m[2]), m[3] ?? m[6]);
    const close = toMinutes(Number(m[4]), Number(m[5]), m[6]);
    if (open === null || close === null) continue;

    if (close <= open) {
      // Over midnatt (nattklubb): åpent fra i kveld til utpå natta.
      if (currentMinutes >= open || currentMinutes < close) return true;
    } else if (currentMinutes >= open && currentMinutes < close) {
      return true;
    }
  }

  // Ingen lesbar tidslinje = vi vet ikke. Bare et intervall vi FAKTISK leste,
  // og som ikke omsluttet klokka nå, betyr stengt.
  return sawRange ? false : undefined;
}

/** Klokkeslett → minutter fra midnatt. `null` når tallene ikke er en gyldig tid. */
function toMinutes(hours: number, minutes: number, ampm: string | undefined): number | null {
  let h = hours;
  if (ampm) {
    const upper = ampm.toUpperCase();
    if (h < 1 || h > 12) return null;
    if (upper === "AM") h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
  }
  if (h > 24 || minutes > 59) return null;
  return h * 60 + minutes;
}
