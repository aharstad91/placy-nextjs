/**
 * ID-ene demoen bruker, samlet ett sted.
 *
 * Prefikset `leve-` er ikke pynt: det er garantien for at ingenting her kan
 * kollidere med en POI fra den delte poolen (som bruker `google-`, `osm-`,
 * `nsr-`, `bus-`, `bysykkel-`, `entur-` eller UUID). Demoen skriver ingenting
 * til Supabase — innholdet flettes inn i `Project` ved render — men IDene må
 * likevel være unike, ellers kan et oppslag i boardet treffe feil sted.
 */

export const THEME_SERVERING_ID = "leve-servering";
export const THEME_PARK_ID = "leve-park";
export const THEME_KULTUR_ID = "leve-kultur";

/** Kategori-IDene POI-ene får. Én per tema — demoen har ingen underkategorier. */
export const CATEGORY_SERVERING_ID = "leve-kat-servering";
export const CATEGORY_PARK_ID = "leve-kat-park";
export const CATEGORY_KULTUR_ID = "leve-kat-kultur";

/** Alle demo-POI-er bærer dette prefikset. */
export const LEVE_POI_PREFIX = "leve-";
