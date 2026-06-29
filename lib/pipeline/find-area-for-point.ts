/**
 * Område-oppslag for editorial-arv (R2): gitt et punkt (lat/lng), finn
 * `areas`-raden hvis boundary-polygon inneholder punktet.
 *
 * Kun kuraterte områder er relevante for arv — raden må ha BÅDE `boundary`
 * OG `report_editorial` satt (query-filtrert server-side). Point-in-polygon
 * kjøres i TypeScript per rad (`pointInGeometry` — GeoJSON er [lng, lat]).
 *
 * Fail-soft: Supabase-feil eller ugyldig boundary gir `area: null` + warning,
 * aldri exception — kalleren (arve-steget, Unit 4) behandler null som
 * «ingen kuratert område» og faller til nivå 1 (R2).
 */

import { createServerClient } from "@/lib/supabase/client";
import {
  pointInGeometry,
  isValidCoordinates,
  type GeoJsonPolygonGeometry,
} from "@/lib/utils/geo";

/**
 * Kuratert editorial per tema-id. Retningsgivende form:
 * `{ "<theme-id>": { body, highlightCandidates, image? } }` — eksakt feltform
 * låses av Zod-skjemaet i kurateringsverktøyet (Unit 5), så raden types løst her.
 */
export type AreaReportEditorial = Record<string, unknown>;

/** `areas`-rad med garantert boundary + report_editorial (query-filtrert). */
export interface CuratedArea {
  id: string;
  name_no: string;
  level: string | null;
  boundary: GeoJsonPolygonGeometry;
  report_editorial: AreaReportEditorial;
}

export interface FindAreaForPointResult {
  /** Treff-raden, eller null → kalleren faller til nivå 1 (R2) */
  area: CuratedArea | null;
  warnings: string[];
}

function isPolygonGeometry(value: unknown): value is GeoJsonPolygonGeometry {
  if (typeof value !== "object" || value === null) return false;
  const geom = value as { type?: unknown; coordinates?: unknown };
  return (
    (geom.type === "Polygon" || geom.type === "MultiPolygon") &&
    Array.isArray(geom.coordinates)
  );
}

export async function findAreaForPoint(options: {
  lat: number;
  lng: number;
}): Promise<FindAreaForPointResult> {
  const { lat, lng } = options;
  const warnings: string[] = [];

  if (!isValidCoordinates(lat, lng)) {
    warnings.push(
      `⚠️  Ugyldige koordinater (${lat}, ${lng}) — område-oppslag hoppet over`
    );
    return { area: null, warnings };
  }

  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase ikke konfigurert");
  }

  // Kun kuraterte områder: boundary OG report_editorial må være satt.
  // supabase-js kaster aldri — { data, error } håndteres eksplisitt.
  // v2-lesesti (PRD 8 Unit 1 / INDEX note #7): `areas` finnes KUN i v2-schemaet
  // (re-provisjonert via PRD 3, ikke i `public`). v2-typene (r01.6) gjør
  // `.schema("v2").from("areas")` fullt typet → det tidligere
  // `(supabase.from as any)`-castet er fjernet (Unit 1 AC5). boundary/
  // report_editorial er `Json | null` i typene og valideres runtime under.
  const { data, error } = await supabase
    .schema("v2")
    .from("areas")
    .select("id, name_no, level, boundary, report_editorial")
    .not("boundary", "is", null)
    .not("report_editorial", "is", null);

  if (error) {
    warnings.push(
      `⚠️  Område-oppslag feilet: ${error.message} — faller til nivå 1`
    );
    return { area: null, warnings };
  }

  const rows = data ?? [];
  const matches: CuratedArea[] = [];

  for (const row of rows) {
    if (!isPolygonGeometry(row.boundary)) {
      warnings.push(
        `⚠️  Område ${row.id} har ugyldig boundary-geometri — hoppet over`
      );
      continue;
    }
    // Fang den narrowede boundary i en lokal const før videre kall (TS mister
    // property-narrowing av row.boundary over funksjonskall ellers).
    const boundary = row.boundary;

    // Defensivt: query-filteret garanterer non-null, men en ikke-objekt-verdi
    // (f.eks. feillagret streng eller array — typeof [] === "object") skal
    // aldri gi arv.
    const editorial = row.report_editorial;
    if (
      editorial === null ||
      typeof editorial !== "object" ||
      Array.isArray(editorial)
    ) {
      warnings.push(
        `⚠️  Område ${row.id} har ugyldig report_editorial — hoppet over`
      );
      continue;
    }
    // GeoJSON-koordinater er [lng, lat] → x = lng, y = lat
    if (pointInGeometry(lng, lat, boundary)) {
      // boundary/editorial er runtime-validert over → bygg CuratedArea
      // eksplisitt (ingen cast; v2-typene gir resten).
      matches.push({
        id: row.id,
        name_no: row.name_no,
        level: row.level,
        boundary,
        report_editorial: editorial,
      });
    }
  }

  if (matches.length === 0) {
    return { area: null, warnings };
  }

  if (matches.length > 1) {
    warnings.push(
      `⚠️  Punktet (${lat}, ${lng}) treffer ${matches.length} områder (${matches
        .map((m) => m.id)
        .join(", ")}) — bruker første: ${matches[0].id}`
    );
  }

  return { area: matches[0], warnings };
}
