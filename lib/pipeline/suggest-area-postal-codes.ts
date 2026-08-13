/**
 * Foreslå `postal_codes` for områder som har polygon men tom postnummerliste.
 *
 * Motsatt retning av `derive-area-boundary.ts`: der leses postnumre og lages
 * geometri, her leses geometri og foreslås postnumre.
 *
 * HVORFOR DET TRENGS: Straumen og Oppdal er ferdig kuraterte områder med polygon
 * og alle seks temaer, men tom `postal_codes`. Dekningsregnskapet slår opp
 * postnummer → område, så uten tilknytning ville to av våre ni beste områder vært
 * usynlige i regnskapet.
 *
 * FORESLÅR, SKRIVER IKKE. Grunnen er ikke risiko — ingenting er shippet — men at
 * postnummer-tilknytning er en påstand om hvor et strøk *er*, og det er kurators
 * beslutning, ikke en geometrisk bieffekt. Samme prinsipp som at
 * `scripts/curate-pois.ts --list` lager en arbeidsliste framfor å skrive tekst.
 *
 * METODEN ER TILNÆRMET. To tester i hver sin retning, fordi begge har en blindsone:
 *
 *   1. Postnummerets ringpunkter mot områdets polygon — fanger delvis overlapp,
 *      men ser ikke et lite område som ligger helt inne i et stort postnummer
 *      (da er ingen av postnummerets hjørner innenfor det lille området).
 *   2. Områdets senterpunkt mot postnummerets polygon — fanger nettopp det
 *      tilfellet.
 *
 * Det som fortsatt kan overses er et postnummer som overlapper området i et smalt
 * bånd uten at noe ringpunkt havner innenfor og uten at senteret treffer. For en
 * håndfull områder er kurator-bekreftelse billigere enn en eksakt
 * polygon-skjæring, som ville krevd et clipping-bibliotek vi ellers ikke trenger
 * (samme avveining som «ingen ekte union» i derive-area-boundary.ts).
 */

import { pointInGeometry, type GeoJsonPolygonGeometry } from "@/lib/utils/geo";

export interface PostalAreaWithMeta {
  postnummer: string;
  poststed: string;
  kommunenavn: string;
  boundary: { type: "MultiPolygon"; coordinates: number[][][][] };
}

export interface AreaForSuggestion {
  id: string;
  name_no: string;
  boundary: GeoJsonPolygonGeometry | null;
  postal_codes: string[] | null;
  center_lat: number | null;
  center_lng: number | null;
}

export interface PostalCandidate {
  postnummer: string;
  poststed: string;
  kommunenavn: string;
  /** Hvor mange av postnummerets ringpunkter som ligger inne i området. */
  treffpunkter: number;
  /** Om områdets senterpunkt ligger inne i postnummeret. */
  senterTreff: boolean;
}

export interface Suggestion {
  id: string;
  name: string;
  /** Sortert med mest sannsynlige først. */
  kandidater: PostalCandidate[];
}

export type SkipReason = "har-postnummer" | "mangler-boundary";

export interface SuggestionResult {
  suggestions: Suggestion[];
  /** Vurdert, men ingen postnummer overlappet. Rapporteres, ikke utelates. */
  utenTreff: Array<{ id: string; name: string }>;
  hoppetOver: Array<{ id: string; name: string; reason: SkipReason }>;
}

/** Alle ringpunkter i en MultiPolygon, på tvers av flater og ringer. */
function everyVertex(geometry: PostalAreaWithMeta["boundary"]): number[][] {
  const points: number[][] = [];
  for (const flate of geometry.coordinates) {
    for (const ring of flate) {
      points.push(...ring);
    }
  }
  return points;
}

export function suggestPostalCodes(
  areas: AreaForSuggestion[],
  postalAreas: PostalAreaWithMeta[]
): SuggestionResult {
  const suggestions: Suggestion[] = [];
  const utenTreff: Array<{ id: string; name: string }> = [];
  const hoppetOver: Array<{ id: string; name: string; reason: SkipReason }> = [];

  for (const area of areas) {
    const name = area.name_no;

    if ((area.postal_codes ?? []).length > 0) {
      hoppetOver.push({ id: area.id, name, reason: "har-postnummer" });
      continue;
    }
    if (!area.boundary) {
      hoppetOver.push({ id: area.id, name, reason: "mangler-boundary" });
      continue;
    }
    const areaBoundary = area.boundary;

    const harSenter = area.center_lat !== null && area.center_lng !== null;
    const kandidater: PostalCandidate[] = [];

    for (const postal of postalAreas) {
      // Retning 1: postnummerets hjørner inne i området.
      let treffpunkter = 0;
      for (const [lng, lat] of everyVertex(postal.boundary)) {
        if (pointInGeometry(lng, lat, areaBoundary)) treffpunkter++;
      }

      // Retning 2: områdets senter inne i postnummeret.
      const senterTreff =
        harSenter && pointInGeometry(area.center_lng!, area.center_lat!, postal.boundary);

      if (treffpunkter === 0 && !senterTreff) continue;

      kandidater.push({
        postnummer: postal.postnummer,
        poststed: postal.poststed,
        kommunenavn: postal.kommunenavn,
        treffpunkter,
        senterTreff,
      });
    }

    if (kandidater.length === 0) {
      utenTreff.push({ id: area.id, name });
      continue;
    }

    // Et sentertreff er et sterkere signal enn ett tilfeldig ringpunkt: det sier
    // at områdets midtpunkt faktisk ligger i postnummeret.
    kandidater.sort(
      (a, b) =>
        Number(b.senterTreff) - Number(a.senterTreff) ||
        b.treffpunkter - a.treffpunkter ||
        a.postnummer.localeCompare(b.postnummer)
    );

    suggestions.push({ id: area.id, name, kandidater });
  }

  return { suggestions, utenTreff, hoppetOver };
}
