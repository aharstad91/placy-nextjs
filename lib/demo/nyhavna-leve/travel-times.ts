/**
 * Målte reisetider fra Nyhavna-boardets senter til demoens steder.
 *
 * HVORFOR DE LIGGER HER OG IKKE I DATABASEN: demo-POI-ene finnes bare i minnet
 * (se `build.ts`), så pipelinens precompute-steg har aldri sett dem. Boardets
 * regel er at et minutt-tall aldri gjettes — en rad uten målt tid viser ingen
 * tid i det hele tatt. Alternativet til denne fila hadde derfor vært syv steder
 * uten minutter, og det er nettopp tallet som gjør et kart til et nabolagskart.
 *
 * Tallene er hentet fra Mapbox Directions Matrix (walking/cycling/driving) med
 * `scripts/nyhavna-leve-travel-times.ts`, fra senter
 * 63.43980508893858 / 10.41725655026434, 2026-09-11. Sekunder → minutter med
 * `ceil`, gulv 1 — samme enhets-kontrakt som `v2.project_pois.travel_times`
 * (MINUTTER, aldri sekunder).
 *
 * Kjør scriptet på nytt hvis et koordinat i `content.ts` endres.
 */

export const LEVE_TRAVEL_TIMES: Record<
  string,
  { walk: number; bike: number; car: number }
> = {
  "leve-dora-kaffebar": { walk: 2, bike: 2, car: 2 },
  "leve-monkey-brew": { walk: 5, bike: 3, car: 2 },
  "leve-elvepromenaden": { walk: 6, bike: 4, car: 3 },
  "leve-kulturaksen": { walk: 1, bike: 1, car: 1 },
  "leve-fyringsbunkeren": { walk: 2, bike: 1, car: 1 },
  "leve-dora2": { walk: 1, bike: 1, car: 1 },
  "leve-bunkerparken": { walk: 1, bike: 1, car: 1 },
};
