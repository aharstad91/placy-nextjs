/**
 * Paginert lesing for spørringer der radtallet vokser med innholdet.
 *
 * PostgREST har et SERVERSIDIG tak på antall rader per svar (`db-max-rows`,
 * 1 000 hos Supabase). Taket gir ingen feil: du får 200 OK med de første 1 000
 * radene og en `content-range`-header som sier hvor mange det egentlig var.
 * Koden ser et vellykket kall og en kortere liste — og fortsetter som om
 * listen var komplett.
 *
 * Feilen ble funnet 2026-09-06 på Wesselsløkka-boardet: `project_pois` har
 * 1 615 rader, lesestien hentet 1 000, og 615 steder mistet reisetiden sin.
 * På boardet så det ut som manglende data, ikke som en feil: «nærmeste
 * spisested» ble Burger King på 9 minutter fordi VYDA på 4 lå i radene som
 * aldri ble lest. Ingen logg, ingen exception, bare et board som løy om
 * avstander. Nøyaktig den feilklassen vi kritiserer konkurrentene for.
 *
 * TAKET ER EN KORREKTHETSGRENSE, IKKE EN YTELSESSAK — samme regel som
 * `chunk-ids.ts` (som løser den andre PostgREST-grensa, URL-lengden på
 * `.in()`). Enhver select der antall rader VOKSER med et board, en pool eller
 * tiden, må gå gjennom denne.
 *
 * `.limit(n)` er IKKE en løsning. Serverens tak vinner over klientens limit,
 * så `.limit(50_000)` gir fortsatt 1 000 rader. Et høyt limit i koden ser ut
 * som en sikring og er det ikke.
 *
 * TO VALG SOM SER SMÅ UT OG IKKE ER DET:
 *
 * 1. Vi stopper på en TOM side, ikke på en «kort» side, og vi rykker fram med
 *    antallet rader vi faktisk fikk. Stoppet man på første korte side, ville
 *    et lavere servertak enn `pageSize` gitt stille avkorting igjen — samme
 *    feil, nytt sted. Prisen er én ekstra forespørsel per spørring.
 *
 * 2. Kalleren MÅ sortere på noe unikt (se `orderBy`-kravet under). Uten en
 *    total orden er radrekkefølgen mellom to spørringer udefinert i Postgres,
 *    og sideinndeling kan da både hoppe over og duplisere rader. Sortering på
 *    en kolonne med like verdier, som `sort_order`, holder ikke alene.
 */

/** Supabase' `db-max-rows`. Sidestørrelsen vår, ikke en grense vi kan heve. */
export const ROWS_PER_PAGE = 1_000;

/**
 * Sikring mot en spørring som aldri tar slutt. Treffes den, er noe galt med
 * filteret — og da skal det SI fra, ikke returnere en kortet liste. Stille
 * avkorting er hele grunnen til at fila finnes.
 */
export const MAX_TOTAL_ROWS = 100_000;

/** Det en Supabase-spørring gir tilbake. Holdt minimal så mocking er enkelt. */
export interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export interface FetchAllRowsResult<T> {
  rows: T[];
  /** Satt = ufullstendig svar. Kalleren MÅ behandle det som en feil. */
  error: string | null;
}

/**
 * Hent alle rader fra en spørring, side for side.
 *
 * @param page Bygger spørringen for ett vindu. Kalles én gang per side, og må
 *   returnere en FERSK spørring med `.range(from, to)` og en STABIL TOTAL
 *   ORDEN — altså en sortering som ender på en unik kolonne:
 *
 *   ```ts
 *   const { rows, error } = await fetchAllRows((from, to) =>
 *     db.from("project_pois")
 *       .select("poi_id, travel_times")
 *       .eq("project_id", projectId)
 *       .order("poi_id")      // unik innenfor project_id → total orden
 *       .range(from, to),
 *   );
 *   ```
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  options: { pageSize?: number; maxTotalRows?: number } = {},
): Promise<FetchAllRowsResult<T>> {
  const pageSize = options.pageSize ?? ROWS_PER_PAGE;
  const maxTotalRows = options.maxTotalRows ?? MAX_TOTAL_ROWS;
  const rows: T[] = [];

  for (;;) {
    const { data, error } = await page(rows.length, rows.length + pageSize - 1);
    if (error) {
      return { rows, error: error.message };
    }

    const batch = data ?? [];
    if (batch.length === 0) {
      return { rows, error: null };
    }

    rows.push(...batch);

    if (rows.length >= maxTotalRows) {
      return {
        rows,
        error: `fetchAllRows: stoppet på ${rows.length} rader (taket er ${maxTotalRows}). Svaret er ufullstendig — sjekk filteret i spørringen.`,
      };
    }
  }
}
