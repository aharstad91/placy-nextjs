#!/usr/bin/env npx tsx
/**
 * Hent en kommunes ytre grense fra Kartverket som GeoJSON og skriv den inn i en
 * nabolags-staging-fil (data/areas/<id>.staging.json).
 *
 * Polygon-kilde for nabolags-editorial-arv (slice 2+): Kartverkets offisielle
 * kommunegrense (NLOD, rights-clean). Henter HELE kommunen som ÉN
 * Polygon/MultiPolygon — egnet for «ett område = hele kommunen»-modellen
 * (Malvik, typologi-test på kommune-skala). For kommune-SUBSETT (utvalgte
 * tettsteder i en stor/rural kommune) trengs grunnkrets-union — det verktøyet
 * er deferret til Stjørdal/Melhus faktisk krever et subsett (krever et
 * geometri-bibliotek for dissolve; ingen i repoet i dag).
 *
 * Usage:
 *   npx tsx scripts/fetch-area-boundary.ts --kommune 5031 --out data/areas/malvik.staging.json
 *   npx tsx scripts/fetch-area-boundary.ts --kommune 5031 --out <path> --area-id malvik --zoom 11
 *
 * Oppførsel:
 *   - Finnes ikke --out: opprett SKJELETT (areaId, meta forhåndsutfylt fra
 *     Kartverket, boundary, 6 tomme tema-templates) — fyll meta/editorial selv.
 *   - Finnes --out: oppdater KUN `boundary`, behold meta + report_editorial.
 *
 * Tredjeparts-kart (Scribblemaps o.l.) er KUN visuell referanse, aldri
 * polygon-kilde (rights-clean-kravet). Kartverket-data er NLOD.
 */

import * as fs from "node:fs";

import { BoundarySchema } from "@/lib/pipeline/area-staging";
import { REPORT_THEME_DEFAULTS } from "@/lib/pipeline/report-defaults";

/** Kartverket kommuneinfo — offisiell, krever ingen nøkkel. */
const KARTVERKET_BASE = "https://api.kartverket.no/kommuneinfo/v1";

/** Avrundingspresisjon på koordinater (6 desimaler ≈ 0,1 m) — holder fila lett. */
const COORD_DECIMALS = 6;

const FETCH_TIMEOUT_MS = 30_000;

// ── Arg-parsing ───────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  const kommune = get("--kommune");
  const out = get("--out");
  if (!kommune || !out) {
    console.error(
      "Bruk: --kommune <kommunenummer> --out <staging-fil> [--area-id <id>] [--zoom <n>]"
    );
    process.exit(1);
  }
  const zoomStr = get("--zoom");
  const zoom = zoomStr ? Number(zoomStr) : 11;
  if (!Number.isFinite(zoom)) {
    console.error("--zoom må være et tall");
    process.exit(1);
  }

  return {
    kommune: kommune.padStart(4, "0"),
    out,
    areaId: get("--area-id"),
    zoom,
  };
}

// ── Geometri-hjelpere ───────────────────────────────────────────────────────

type Ring = number[][];
type PolygonCoords = Ring[];

interface GeoGeometry {
  type: "Polygon" | "MultiPolygon";
  // Polygon: Ring[]; MultiPolygon: PolygonCoords[]
  coordinates: unknown;
}

const round = (n: number) => Number(n.toFixed(COORD_DECIMALS));

/** Avrund [lng, lat] (dropp evt. høyde) til COORD_DECIMALS. */
function roundPos(pos: number[]): number[] {
  return [round(pos[0]), round(pos[1])];
}

/** Lukk en ring hvis første ≠ siste punkt (GeoJSON krever lukkede ringer). */
function closeRing(ring: Ring): Ring {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return [...ring, [...first]];
  }
  return ring;
}

function normalizeRing(ring: Ring): Ring {
  return closeRing(ring.map(roundPos));
}

/** Normaliser hele geometrien: avrund alle punkter, lukk alle ringer. */
function normalizeGeometry(geom: GeoGeometry): GeoGeometry {
  if (geom.type === "Polygon") {
    const coords = geom.coordinates as PolygonCoords;
    return { type: "Polygon", coordinates: coords.map(normalizeRing) };
  }
  const coords = geom.coordinates as PolygonCoords[];
  return {
    type: "MultiPolygon",
    coordinates: coords.map((poly) => poly.map(normalizeRing)),
  };
}

/** Bounding-box-senter av alle ytre ringer (deterministisk, ingen ekstra API-kall). */
function bboxCenter(geom: GeoGeometry): { lat: number; lng: number } {
  let minLng = Infinity,
    maxLng = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;
  const outerRings: Ring[] =
    geom.type === "Polygon"
      ? [(geom.coordinates as PolygonCoords)[0]]
      : (geom.coordinates as PolygonCoords[]).map((poly) => poly[0]);
  for (const ring of outerRings) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return {
    lng: Number(((minLng + maxLng) / 2).toFixed(4)),
    lat: Number(((minLat + maxLat) / 2).toFixed(4)),
  };
}

function countOuterPoints(geom: GeoGeometry): number {
  if (geom.type === "Polygon") {
    return (geom.coordinates as PolygonCoords)[0].length;
  }
  return (geom.coordinates as PolygonCoords[]).reduce(
    (sum, poly) => sum + poly[0].length,
    0
  );
}

/** Slugifiser norsk kommunenavn til areas.id/slug-form. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Kartverket-henting ──────────────────────────────────────────────────────

interface KommuneOmrade {
  kommunenavn: string;
  kommunenummer: string;
  omrade: GeoGeometry;
}

async function fetchKommuneOmrade(kommunenummer: string): Promise<KommuneOmrade> {
  const url = `${KARTVERKET_BASE}/kommuner/${kommunenummer}/omrade?utkoordsys=4326`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(
      `Kartverket omrade-oppslag feilet (${res.status}) for kommune ${kommunenummer}`
    );
  }
  const data = (await res.json()) as Partial<KommuneOmrade>;
  if (!data.omrade || !data.omrade.type || !data.omrade.coordinates) {
    throw new Error(
      `Kartverket returnerte ingen 'omrade'-geometri for kommune ${kommunenummer}`
    );
  }
  return {
    kommunenavn: data.kommunenavn ?? kommunenummer,
    kommunenummer: data.kommunenummer ?? kommunenummer,
    omrade: data.omrade,
  };
}

// ── Staging-skriving ────────────────────────────────────────────────────────

function emptyThemeTemplates(): Record<string, { body: string; highlightCandidates: string[] }> {
  const out: Record<string, { body: string; highlightCandidates: string[] }> = {};
  for (const theme of REPORT_THEME_DEFAULTS) {
    out[theme.id] = { body: "", highlightCandidates: [] };
  }
  return out;
}

async function main() {
  const { kommune, out, areaId: areaIdFlag, zoom } = parseArgs();

  console.log(`Henter kommunegrense fra Kartverket (kommune ${kommune})…`);
  const komInfo = await fetchKommuneOmrade(kommune);
  const boundary = normalizeGeometry(komInfo.omrade);

  // Valider mot SAMME skjema som curate-area bruker — fang feil her, ikke i DB.
  const check = BoundarySchema.safeParse(boundary);
  if (!check.success) {
    console.error("Boundary fra Kartverket validerte ikke mot BoundarySchema:");
    for (const issue of check.error.issues) {
      console.error(`  ✗ ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  const polyCount =
    boundary.type === "MultiPolygon"
      ? (boundary.coordinates as PolygonCoords[]).length
      : 1;
  console.log(
    `✓ ${komInfo.kommunenavn}: ${boundary.type}, ${polyCount} polygon(er), ${countOuterPoints(boundary)} punkter i ytre ring(er)`
  );

  const areaId = areaIdFlag ?? slugify(komInfo.kommunenavn);

  if (fs.existsSync(out)) {
    // Oppdater KUN boundary — behold meta + kuratert report_editorial.
    const existing = JSON.parse(fs.readFileSync(out, "utf-8")) as Record<string, unknown>;
    existing.boundary = boundary;
    fs.writeFileSync(out, JSON.stringify(existing, null, 2) + "\n");
    console.log(`✓ Oppdaterte boundary i eksisterende ${out} (meta + editorial uendret)`);
    return;
  }

  // Nytt skjelett: meta forhåndsutfylt fra Kartverket, tomme tema-templates.
  const center = bboxCenter(boundary);
  const skeleton = {
    _instructions: `Skjelett generert fra Kartverket kommune ${kommune} (${komInfo.kommunenavn}). Fyll meta (sjekk navn/slug/senter), kuratér report_editorial, kjør curate-area --file ${out}.`,
    areaId,
    meta: {
      name_no: komInfo.kommunenavn,
      name_en: komInfo.kommunenavn,
      slug_no: slugify(komInfo.kommunenavn),
      slug_en: slugify(komInfo.kommunenavn),
      level: "city",
      center_lat: center.lat,
      center_lng: center.lng,
      zoom_level: zoom,
    },
    boundary,
    report_editorial: emptyThemeTemplates(),
  };
  fs.writeFileSync(out, JSON.stringify(skeleton, null, 2) + "\n");
  console.log(`✓ Skrev skjelett til ${out}`);
  console.log(`   areaId='${areaId}', senter=${center.lat},${center.lng}, zoom=${zoom}`);
  console.log("   Neste: sjekk meta, kuratér report_editorial, kjør curate-area.");
}

main().catch((err) => {
  console.error("\nFeil:", err instanceof Error ? err.message : err);
  process.exit(1);
});
