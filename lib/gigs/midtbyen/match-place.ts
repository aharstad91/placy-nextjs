/**
 * Å knytte en katalogoppføring til riktig Google-sted.
 *
 * `midtbyen.no` gir navn og adresse, men ingen Google place-ID — og place-ID er
 * det Places API trenger for å svare med åpningstider. Broen er et tekstsøk,
 * og et tekstsøk gjetter gjerne: «Shine» finnes i flere byer, «Transit» er et
 * ord. Feil åpningstider i en demo er verre enn ingen åpningstider, så
 * utvelgelsen er bevisst streng og avviser heller enn å gjette.
 *
 * To kontroller må begge passere:
 *
 *  1. **Sted** — kandidaten må ligge nær butikkens kjente koordinat. Mangler
 *     koordinaten (de ni `g.page`-oppføringene), må kandidaten i det minste
 *     ligge innenfor Midtbyen.
 *  2. **Navn** — normalisert navnelikhet over en terskel, så «Shine» i Bergen
 *     ikke vinner bare fordi den lå nærmest tilfeldigvis.
 */

import { haversineDistance } from "@/lib/utils";
import type { Coordinates } from "@/lib/types";
import { MIDTBYEN_RADIUS_METERS, TORVET } from "@/lib/gigs/midtbyen/anchor";

/** Et treff fra `places:searchText`, redusert til feltene vi bedømmer på. */
export interface PlaceCandidate {
  placeId: string;
  displayName: string;
  formattedAddress?: string;
  location?: Coordinates;
}

/** Hvor langt fra butikkens kjente koordinat et treff kan ligge. */
export const MAX_MATCH_METERS = 150;

/** Laveste navnelikhet som godtas. Under denne avvises treffet. */
export const MIN_NAME_SCORE = 0.5;

/** Korteste navn (uten mellomrom) som får telle som treff ved komprimert
 *  sammenligning — se `nameScore`. */
const COMPACT_MIN_LENGTH = 5;

/**
 * Normaliser et butikknavn for sammenligning.
 *
 * Katalogen og Google skriver samme butikk ulikt: «Aagaard siden 1876» mot
 * «AAGAARD siden 1876», «Reimers Th. Angells gt.» mot «Reimers». Vi fjerner
 * derfor kasus, diakritikk og tegnsetting før vi sammenligner.
 *
 * Æ, ø og å translittereres EKSPLISITT. De er egne bokstaver i Unicode, ikke
 * bokstav pluss diakritisk tegn, så NFD lar dem stå — og tegnsettingsfjerningen
 * ville da gjort «Brattørkaia» til «bratt rkaia». Google skriver dessuten ofte
 * den translittererte formen, så «Brattorkaia» må bli samme streng.
 */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Navnelikhet i [0, 1].
 *
 * Full poengsum når det ene navnet inneholder det andre — det dekker
 * «Reimers» mot «Reimers Th. Angells gt.», som er samme butikk med
 * filialtillegg. Ellers andelen delte ord, målt mot det korteste navnet, slik
 * at et langt Google-navn ikke straffes for å være detaljert.
 */
export function nameScore(a: string, b: string): number {
  const x = normaliseName(a);
  const y = normaliseName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;

  // Ordmellomrom er ikke til å stole på: katalogen skriver «C. I. Pedersen»,
  // Google «CI Pedersen AS». Sammenligner vi ordvis, deles bare «pedersen»
  // (0,33) og et åpenbart treff avvises. Derfor sammenlignes navnene også uten
  // mellomrom.
  const cx = x.replace(/ /g, "");
  const cy = y.replace(/ /g, "");
  if (cx === cy) return 1;

  // Delvis treff («Reimers» inni «Reimers Th. Angells gt.») teller bare når det
  // korteste navnet er langt nok til å være særegent. Uten lengdekravet ville
  // «BAG» matchet «Bagarstuga» med full score.
  if (
    Math.min(cx.length, cy.length) >= COMPACT_MIN_LENGTH &&
    (cx.includes(cy) || cy.includes(cx))
  ) {
    return 1;
  }

  const xs = new Set(x.split(" "));
  const ys = new Set(y.split(" "));
  let shared = 0;
  for (const token of xs) if (ys.has(token)) shared++;
  return shared / Math.min(xs.size, ys.size);
}

export interface MatchTarget {
  name: string;
  coordinates?: Coordinates;
}

/**
 * Velg det beste Google-treffet for en oppføring, eller null.
 *
 * Null er et fullgodt svar: butikken beholdes uten åpningstider. Det eneste
 * utfallet vi ikke aksepterer er et treff som ser riktig ut og ikke er det.
 */
export function pickBestPlaceMatch(
  target: MatchTarget,
  candidates: PlaceCandidate[],
): PlaceCandidate | null {
  let best: { candidate: PlaceCandidate; score: number } | null = null;

  for (const candidate of candidates) {
    if (!withinAllowedArea(target, candidate)) continue;

    const score = nameScore(target.name, candidate.displayName);
    if (score < MIN_NAME_SCORE) continue;

    if (!best || score > best.score) best = { candidate, score };
  }

  return best?.candidate ?? null;
}

function withinAllowedArea(
  target: MatchTarget,
  candidate: PlaceCandidate,
): boolean {
  // Uten posisjon på kandidaten kan vi ikke stedskontrollere. Da er navnet
  // alene for tynt grunnlag til å knytte åpningstider til en butikk.
  if (!candidate.location) return false;

  if (target.coordinates) {
    return (
      haversineDistance(target.coordinates, candidate.location) <=
      MAX_MATCH_METERS
    );
  }

  return (
    haversineDistance(TORVET, candidate.location) <= MIDTBYEN_RADIUS_METERS
  );
}
