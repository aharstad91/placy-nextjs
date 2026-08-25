/**
 * Batching av id-lister for PostgREST-spørringer.
 *
 * PostgREST legger `.in(...)` i URL-en som query-parameter, og hele URL-en må
 * under grensa for forespørselslinja hos Supabase/Cloudflare (~16 kB). Da
 * poolen for Strindfjordvegen 10 passerte 533 POI-er ble URL-en ~20 kB, og
 * `fetch` kastet et bart «TypeError: fetch failed» — ingen HTTP-status, ingen
 * PostgREST-feilmelding, bare et avbrutt kall midt i hydreringen. Feilen så ut
 * som nettverksflaks; den var en funksjon av hvor stor poolen hadde blitt.
 *
 * Taket er derfor ikke en optimalisering, men en korrekthetsgrense: enhver
 * `.in()` som får en liste som VOKSER med antall POI-er på et board, må gå
 * gjennom `chunkIds`. Grensa er felles her fordi den er en egenskap ved
 * transporten, ikke ved den enkelte spørringen.
 *
 * 200 id-er ≈ 7 kB URL med de lengste id-ene vi har (`taxi-tk-…`, `osm-way-…`),
 * altså god margin.
 */
export const MAX_IDS_PER_QUERY = 200;

/** Del en id-liste i biter som er trygge å sende i én `.in(...)`. */
export function chunkIds<T>(ids: T[], size: number = MAX_IDS_PER_QUERY): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}
