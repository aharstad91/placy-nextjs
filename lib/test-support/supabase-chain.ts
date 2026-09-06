/**
 * Terminal for Supabase-chain-mocker som tåler paginering.
 *
 * Testmockene i pipelinen var skrevet mot formen `.select().eq()` og ga et
 * ferdig `{data, error}` der og da. Da lesingene ble paginert (2026-09-06,
 * `fetch-all-rows.ts`) ble formen `.select().eq().order().range()`, og alle
 * mockene brøt samtidig — ikke fordi oppførselen var feil, men fordi de
 * beskrev kjeden i stedet for resultatet.
 *
 * Denne gir et resultat som tåler begge deler: `order()` er en no-op som
 * returnerer seg selv, `range()` gir vinduet sitt utsnitt, og objektet kan
 * awaites direkte for kjeder uten paginering. Da slipper hver ny paginert
 * spørring å bryte en mock som egentlig ikke handler om paginering.
 *
 * Vinduet MÅ gi et tomt utsnitt når det er forbi siste rad — det er
 * stoppsignalet `fetchAllRows` venter på. Uten det løper testen evig.
 */

type Resolve = (value: { data: unknown; error: unknown }) => unknown;

export interface PagedChain {
  order: (...args: unknown[]) => PagedChain;
  range: (from: number, to: number) => PagedChain;
  then: (resolve: Resolve) => Promise<unknown>;
}

/** Chain-terminal med `data`, som svarer riktig med og uten `.range()`. */
export function pagedResult<T>(data: T[], error: unknown = null): PagedChain {
  const at = (window: [number, number] | null): PagedChain => ({
    order: () => at(window),
    range: (from: number, to: number) => at([from, to]),
    then: (resolve: Resolve) => {
      if (error) return Promise.resolve({ data: null, error }).then(resolve);
      const rows = window ? data.slice(window[0], window[1] + 1) : data;
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    },
  });
  return at(null);
}
