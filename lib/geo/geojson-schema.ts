/**
 * GeoJSON-skjemaer for flater i WGS84 ([lng, lat]-rekkefølge), delt av alt som
 * validerer polygoner: nabolags-grenser (`lib/pipeline/area-staging.ts`) og
 * rekkevidde-konturer (`IsochroneSetSchema` i `lib/types.ts`).
 *
 * Skjemaene bor her og ikke i area-staging fordi `lib/types.ts` leses av
 * klientkomponenter — å importere pipeline-modulen derfra ville trukket
 * pipeline-kode inn i klientbundelen for å få tak i tre skjemaer.
 *
 * Valideringen er streng på det som faktisk går galt i praksis: byttet
 * [lat, lng]-rekkefølge, og ringer som ikke er lukket.
 */

import { z } from "zod";

/** Én posisjon: [lng, lat] (+ valgfri høyde fra tegneverktøy som geojson.io). */
export const PositionSchema = z
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

export const LinearRingSchema = z
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

export const PolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z
    .array(LinearRingSchema)
    .min(1, "Polygon må ha minst én ring (den ytre)"),
});

export const MultiPolygonSchema = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z
    .array(
      z.array(LinearRingSchema).min(1, "Polygon må ha minst én ring (den ytre)")
    )
    .min(1, "MultiPolygon må ha minst ett polygon"),
});

/** En flate: Polygon eller MultiPolygon. Diskriminert på `type`. */
export const PolygonalGeometrySchema = z.discriminatedUnion("type", [
  PolygonSchema,
  MultiPolygonSchema,
]);

export type PolygonalGeometry = z.infer<typeof PolygonalGeometrySchema>;
