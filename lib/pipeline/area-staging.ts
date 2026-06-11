/**
 * Parse-/valideringslogikk for nabolags-staging-filer (data/areas/*.staging.json)
 * — ren logikk uten IO, gjenbrukbar fra scripts/curate-area.ts og testbar alene.
 *
 * Validerer:
 * - areaId: ikke-tom streng (matcher areas.id — slug-aktige strenger, ikke UUID)
 * - boundary: GeoJSON Polygon/MultiPolygon i WGS84 ([lng, lat]-rekkefølge),
 *   alle ringer lukket (første == siste punkt) og koordinater innenfor
 *   gyldige verdensranger
 * - report_editorial: nøkler MÅ være gyldige bolig-tema-IDer fra
 *   REPORT_THEME_DEFAULTS — ukjent tema gir høylytt feil med temanavnet i
 *   meldingen. POI-IDer i highlightCandidates er heterogene strenger
 *   (google-ChIJ…, bus-…, entur-NSR-…) og valideres KUN som ikke-tomme
 *   strenger — ALDRI UUID-regex (dokumentert gotcha:
 *   docs/solutions/ui-bugs/poi-ids-heterogeneous-not-uuid-20260428.md)
 */

import { z } from "zod";
import { REPORT_THEME_DEFAULTS } from "@/lib/pipeline/report-defaults";

const VALID_THEME_IDS = REPORT_THEME_DEFAULTS.map((t) => t.id);

// ── GeoJSON boundary ──────────────────────────────────────────────────────

/** Én posisjon: [lng, lat] (+ valgfri høyde fra tegneverktøy som geojson.io). */
const PositionSchema = z
  .array(z.number())
  .min(2, "Posisjon må ha minst [lng, lat]")
  .max(3, "Posisjon kan maks ha [lng, lat, høyde]")
  .superRefine((pos, ctx) => {
    const [lng, lat] = pos;
    if (lng < -180 || lng > 180) {
      ctx.addIssue({
        code: "custom",
        message: `lng ${lng} er utenfor [-180, 180] — husk GeoJSON-rekkefølgen [lng, lat]`,
      });
    }
    if (lat < -90 || lat > 90) {
      ctx.addIssue({
        code: "custom",
        message: `lat ${lat} er utenfor [-90, 90] — husk GeoJSON-rekkefølgen [lng, lat]`,
      });
    }
  });

const LinearRingSchema = z
  .array(PositionSchema)
  .min(4, "Ring må ha minst 4 punkter (inkludert lukkepunktet)")
  .superRefine((ring, ctx) => {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ctx.addIssue({
        code: "custom",
        message:
          "Ring er ikke lukket — første og siste punkt må være identiske",
      });
    }
  });

const PolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z
    .array(LinearRingSchema)
    .min(1, "Polygon må ha minst én ring (den ytre)"),
});

const MultiPolygonSchema = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z
    .array(z.array(LinearRingSchema).min(1, "Polygon må ha minst én ring (den ytre)"))
    .min(1, "MultiPolygon må ha minst ett polygon"),
});

export const BoundarySchema = z.discriminatedUnion("type", [
  PolygonSchema,
  MultiPolygonSchema,
]);

// ── report_editorial ──────────────────────────────────────────────────────

/** Eksportert: arve-steget (inherit-area-editorial) validerer hver
 *  tema-entry i `areas.report_editorial` med samme skjema som staging. */
export const ThemeEditorialStagingSchema = z
  .object({
    // Kan være tom i mal — gating (body ELLER ≥1 highlight) skjer ved arv
    body: z.string(),
    highlightCandidates: z.array(
      z
        .string()
        .min(
          1,
          "POI-id kan ikke være tom streng (heterogene IDer som google-ChIJ…/bus-…/entur-NSR-… er gyldige)"
        )
    ),
    image: z.string().min(1, "image må være ikke-tom streng eller utelates").optional(),
  })
  .strict();

const ReportEditorialSchema = z
  .record(z.string(), ThemeEditorialStagingSchema)
  .superRefine((rec, ctx) => {
    for (const key of Object.keys(rec)) {
      if (!VALID_THEME_IDS.includes(key)) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `Ukjent tema-id "${key}" — gyldige tema-IDer: ${VALID_THEME_IDS.join(", ")}`,
        });
      }
    }
  });

// ── meta (valgfri — kun nødvendig for å OPPRETTE en ny areas-rad) ───────────

/**
 * Identitetsfeltene en `areas`-rad trenger ved INSERT (migrasjon 018/050).
 * Utelates når raden allerede finnes (curate-area PATCHer da kun boundary +
 * report_editorial). NOT NULL i tabellen: name_no, name_en, slug_no, slug_en,
 * center_lat, center_lng — derfor påkrevd her. `level`/`zoom_level` har
 * DB-defaults, `parent_id`/`postal_codes` er nullable.
 */
export const AreaMetaSchema = z
  .object({
    name_no: z.string().min(1, "meta.name_no må være ikke-tom"),
    name_en: z.string().min(1, "meta.name_en må være ikke-tom"),
    slug_no: z.string().min(1, "meta.slug_no må være ikke-tom"),
    slug_en: z.string().min(1, "meta.slug_en må være ikke-tom"),
    center_lat: z
      .number()
      .min(-90, "meta.center_lat utenfor [-90, 90]")
      .max(90, "meta.center_lat utenfor [-90, 90]"),
    center_lng: z
      .number()
      .min(-180, "meta.center_lng utenfor [-180, 180]")
      .max(180, "meta.center_lng utenfor [-180, 180]"),
    level: z.enum(["city", "bydel", "strok"]).default("city"),
    zoom_level: z.number().int("meta.zoom_level må være heltall").optional(),
    parent_id: z.string().min(1).optional(),
    postal_codes: z.array(z.string().min(1)).optional(),
  })
  .strict();

// ── Toppnivå ──────────────────────────────────────────────────────────────

export const AreaStagingSchema = z
  .object({
    /** Fritekst-instruksjoner i malen — ignoreres av pipelinen */
    _instructions: z.unknown().optional(),
    areaId: z.string().min(1, "areaId må være en ikke-tom streng"),
    /** Kun nødvendig når curate-area skal OPPRETTE raden (INSERT) */
    meta: AreaMetaSchema.optional(),
    boundary: BoundarySchema,
    report_editorial: ReportEditorialSchema,
  })
  .strict();

export type AreaMeta = z.infer<typeof AreaMetaSchema>;
export type AreaStaging = z.infer<typeof AreaStagingSchema>;
export type AreaStagingBoundary = z.infer<typeof BoundarySchema>;
export type ThemeEditorialStaging = z.infer<typeof ThemeEditorialStagingSchema>;

export type AreaStagingParseResult =
  | { success: true; data: AreaStaging }
  | { success: false; errors: string[] };

/**
 * Parse + valider rå JSON-innhold fra en staging-fil.
 * Returnerer typed resultat, eller alle valideringsfeil som
 * `sti: melding`-strenger (aldri exceptions for valideringsfeil).
 */
export function parseAreaStaging(raw: unknown): AreaStagingParseResult {
  const parsed = AreaStagingSchema.safeParse(raw);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  const errors = parsed.error.issues.map((issue) => {
    const path = issue.path.map(String).join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  return { success: false, errors };
}
