/**
 * Avled `v2.areas.boundary` fra områdets `postal_codes`.
 *
 * 37 av 46 områder mangler polygon, og geofencen (`find-area-for-point.ts`) krever
 * BÅDE `boundary` og `report_editorial`. Manglende form er derfor en hard stopp
 * som ikke har noe med kunnskap å gjøre — det er bare en form ingen har tegnet.
 * Postnummer-polygonene fra Kartverket (`v2.postal_areas`, migrasjon 086) gjør
 * formen avledbar.
 *
 * Ren logikk: bygger en plan. Lesing og skriving ligger i
 * `scripts/import-postal-areas.ts` (`--derive-boundaries`).
 *
 * INGEN EKTE UNION: et område med fire postnumre får en MultiPolygon med fire
 * flater, ikke én sammensmeltet ytterkontur. `pointInGeometry` itererer over alle
 * flater, så treff-oppførselen er identisk, og vi slipper et
 * polygon-clipping-bibliotek. Kostnaden er kosmetisk og dukker først opp om
 * formene tegnes i et kart, der indre grenser mellom postnumrene vil vises.
 *
 * DEN VIKTIGSTE REGELEN: rader som allerede HAR `boundary` røres aldri. Flere av
 * dem er kuratert med en presis grense som er finere enn postnummerformen, og en
 * avledning som «forbedret» dem ville degradert kuratert arbeid til grovere
 * geometri. Testene låser dette.
 */

import type { GeoJsonPolygonGeometry } from "@/lib/utils/geo";

/** GeoJSON MultiPolygon slik `postal_areas.boundary` alltid lagres (086). */
export interface PostalAreaGeometry {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

export interface AreaForDerivation {
  id: string;
  name_no: string;
  /** Vilkårlig form — vi leser den ikke, vi sjekker bare om den finnes. */
  boundary: unknown;
  boundary_source: string | null;
  postal_codes: string[] | null;
}

export type SkipReason =
  /** Har allerede en form. Kuratert eller avledet — begge er urørlige her. */
  | "har-boundary"
  /** Ingen postnumre å avlede fra. Typisk city/bydel-nivå, eller ukuratert. */
  | "mangler-postnummer"
  /** Har postnumre, men ingen av dem finnes i postal_areas (f.eks. Oslo/Akershus). */
  | "ingen-postnummer-funnet";

export interface Derivation {
  id: string;
  name: string;
  /** Postnumrene som faktisk ble funnet, i kurators rekkefølge. */
  postnumre: string[];
  boundary: PostalAreaGeometry;
  boundary_source: "derived";
}

export interface Skipped {
  id: string;
  name: string;
  reason: SkipReason;
}

export interface UnknownPostalCode {
  id: string;
  name: string;
  postnummer: string;
}

/** Flere avledede områder som ender opp med samme postnummer — og dermed form. */
export interface Collision {
  postnummer: string;
  areaIds: string[];
}

export interface DerivationPlan {
  derive: Derivation[];
  skipped: Skipped[];
  ukjentePostnumre: UnknownPostalCode[];
  kollisjoner: Collision[];
}

/**
 * Planlegg hvilke områder som skal få avledet form.
 *
 * Rapporterer fire ting fordi et regnskap som bare teller det som gikk bra,
 * skjuler hullene: hva som avledes, hva som hoppes over og hvorfor, hvilke
 * postnumre kurator har listet som vi ikke har geometri for, og hvilke områder
 * som ender med identisk form.
 */
export function planBoundaryDerivation(
  areas: AreaForDerivation[],
  postalAreas: Map<string, PostalAreaGeometry>
): DerivationPlan {
  const derive: Derivation[] = [];
  const skipped: Skipped[] = [];
  const ukjentePostnumre: UnknownPostalCode[] = [];

  for (const area of areas) {
    const name = area.name_no;

    // R4: håndtegnet (eller tidligere avledet) form er urørlig. Denne sjekken
    // står først med vilje — ingenting under den skal kunne overstyre den.
    if (area.boundary !== null && area.boundary !== undefined) {
      skipped.push({ id: area.id, name, reason: "har-boundary" });
      continue;
    }

    const listed = area.postal_codes ?? [];
    if (listed.length === 0) {
      skipped.push({ id: area.id, name, reason: "mangler-postnummer" });
      continue;
    }

    // Dedup bevarer kurators rekkefølge — den er en prioritering, ikke tilfeldig.
    const unike = [...new Set(listed)];
    const funnet: string[] = [];
    const coordinates: number[][][][] = [];

    for (const postnummer of unike) {
      const geometry = postalAreas.get(postnummer);
      if (!geometry) {
        ukjentePostnumre.push({ id: area.id, name, postnummer });
        continue;
      }
      funnet.push(postnummer);
      coordinates.push(...geometry.coordinates);
    }

    // En tom MultiPolygon ville gjort raden synlig for geofencen uten å treffe
    // noe — verre enn ingen form, fordi området da ser dekket ut i et regnskap.
    if (coordinates.length === 0) {
      skipped.push({ id: area.id, name, reason: "ingen-postnummer-funnet" });
      continue;
    }

    derive.push({
      id: area.id,
      name,
      postnumre: funnet,
      boundary: { type: "MultiPolygon", coordinates },
      boundary_source: "derived",
    });
  }

  return { derive, skipped, ukjentePostnumre, kollisjoner: findCollisions(derive) };
}

/**
 * Postnumre som havner i mer enn ett avledet område.
 *
 * Ekte tilfelle: Møllenberg, Rosenborg og Solsiden er alle 7014. Avledet får de
 * identisk geometri, og `findAreaForPoint` samler alle treff og bruker
 * `matches[0]` — altså vilkårlig valgt. I dag er det ufarlig fordi ingen av dem
 * har `report_editorial` (geofencen krever begge), men i det øyeblikket to av dem
 * kureres, avgjør rekkefølgen i et SQL-svar hvilken nabolagstekst en bolig får.
 *
 * Områder som alt har egen form er ikke med — de er ikke i `derive` i det hele
 * tatt, og deler ikke geometri med noen.
 */
function findCollisions(derive: Derivation[]): Collision[] {
  const byPostnummer = new Map<string, string[]>();
  for (const d of derive) {
    for (const postnummer of d.postnumre) {
      const ids = byPostnummer.get(postnummer);
      if (ids) ids.push(d.id);
      else byPostnummer.set(postnummer, [d.id]);
    }
  }

  const kollisjoner: Collision[] = [];
  for (const [postnummer, areaIds] of byPostnummer) {
    if (areaIds.length > 1) kollisjoner.push({ postnummer, areaIds });
  }
  return kollisjoner;
}

/**
 * Typebro: den avledede formen er en gyldig `GeoJsonPolygonGeometry`, som er det
 * `find-area-for-point.ts` og `pointInGeometry` forventer. Eksplisitt her slik at
 * en fremtidig endring av formen brekker ved kompilering i stedet for å gi et
 * polygon geofencen stille ignorerer.
 */
export function asGeofenceGeometry(boundary: PostalAreaGeometry): GeoJsonPolygonGeometry {
  return boundary;
}
