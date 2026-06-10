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

/** Rå rad fra Supabase før boundary/editorial-validering. */
interface RawAreaRow {
  id: string;
  name_no: string;
  level: string | null;
  boundary: unknown;
  report_editorial: unknown;
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
  // `areas` er ikke i de genererte Database-typene (kun public-client-
  // konsumenter til nå) — cast forbi table-name-unionen, radene valideres
  // runtime under (repo-presedens: create-report-project.ts).
  const { data, error }: {
    data: RawAreaRow[] | null;
    error: { message: string } | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = await (supabase.from as any)("areas")
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
    // Defensivt: query-filteret garanterer non-null, men en ikke-objekt-verdi
    // (f.eks. feillagret streng) skal aldri gi arv.
    if (row.report_editorial === null || typeof row.report_editorial !== "object") {
      warnings.push(
        `⚠️  Område ${row.id} har ugyldig report_editorial — hoppet over`
      );
      continue;
    }
    // GeoJSON-koordinater er [lng, lat] → x = lng, y = lat
    if (pointInGeometry(lng, lat, row.boundary)) {
      matches.push(row as CuratedArea);
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
