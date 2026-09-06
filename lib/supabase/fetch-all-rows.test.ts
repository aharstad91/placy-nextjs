import { describe, it, expect, vi } from "vitest";
import {
  fetchAllRows,
  ROWS_PER_PAGE,
  MAX_TOTAL_ROWS,
  type PageResult,
} from "./fetch-all-rows";

/**
 * En falsk PostgREST med et SERVERSIDIG radtak, slik ekte Supabase oppfører
 * seg: for stor `range` gir 200 OK med færre rader, ikke en feil. Det er
 * nettopp derfor feilen var usynlig i prod.
 */
function fakePostgrest(totalRows: number, serverMaxRows = ROWS_PER_PAGE) {
  const all = Array.from({ length: totalRows }, (_, i) => ({ id: `rad-${i}` }));
  const windows: Array<[number, number]> = [];

  const page = vi.fn(async (from: number, to: number): Promise<PageResult<{ id: string }>> => {
    windows.push([from, to]);
    const capped = Math.min(to - from + 1, serverMaxRows);
    return { data: all.slice(from, from + capped), error: null };
  });

  return { all, windows, page };
}

describe("fetchAllRows", () => {
  it("henter alt når det er mindre enn én side, med én ekstra tom side som stoppsignal", async () => {
    const db = fakePostgrest(47);

    const { rows, error } = await fetchAllRows(db.page);

    expect(error).toBeNull();
    expect(rows).toEqual(db.all);
    expect(db.page).toHaveBeenCalledTimes(2);
    expect(db.windows).toEqual([
      [0, ROWS_PER_PAGE - 1],
      [47, 47 + ROWS_PER_PAGE - 1],
    ]);
  });

  it("henter alle 1 615 radene Wesselsløkka faktisk har", async () => {
    // Tallet er ikke tilfeldig: `project_pois` for broset-utvikling-as_wesselslokka
    // hadde 1 615 rader 2026-09-06, og lesestien returnerte 1 000 av dem.
    const db = fakePostgrest(1_615);

    const { rows, error } = await fetchAllRows(db.page);

    expect(error).toBeNull();
    expect(rows).toHaveLength(1_615);
    expect(rows).toEqual(db.all);
    expect(new Set(rows.map((r) => r.id)).size).toBe(1_615);
  });

  it("rykker fram med antallet rader den FIKK, ikke sidestørrelsen", async () => {
    // Er servertaket lavere enn sidestørrelsen vår, kommer hver side kort.
    // Stoppet vi på første korte side, ville dette gitt 300 av 1 200 rader —
    // samme stille avkorting, nytt sted.
    const db = fakePostgrest(1_200, 300);

    const { rows, error } = await fetchAllRows(db.page);

    expect(error).toBeNull();
    expect(rows).toHaveLength(1_200);
    expect(db.windows.map(([from]) => from)).toEqual([0, 300, 600, 900, 1_200]);
  });

  it("stopper ikke på et eksakt multiplum av sidestørrelsen", async () => {
    const db = fakePostgrest(ROWS_PER_PAGE * 2);

    const { rows, error } = await fetchAllRows(db.page);

    expect(error).toBeNull();
    expect(rows).toHaveLength(ROWS_PER_PAGE * 2);
    expect(db.page).toHaveBeenCalledTimes(3);
  });

  it("melder fra ved feil midtveis i stedet for å levere en halv liste som om den var hel", async () => {
    const page = vi
      .fn<(from: number, to: number) => Promise<PageResult<{ id: string }>>>()
      .mockResolvedValueOnce({
        data: Array.from({ length: ROWS_PER_PAGE }, (_, i) => ({ id: `rad-${i}` })),
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: "fetch failed" } });

    const { rows, error } = await fetchAllRows(page);

    expect(error).toBe("fetch failed");
    expect(rows).toHaveLength(ROWS_PER_PAGE);
  });

  it("sier tydelig fra når sikringen slår inn, i stedet for å kutte stille", async () => {
    const db = fakePostgrest(MAX_TOTAL_ROWS + 5, 100);

    const { rows, error } = await fetchAllRows(db.page, { pageSize: 100 });

    expect(rows).toHaveLength(MAX_TOTAL_ROWS);
    expect(error).toContain("ufullstendig");
    expect(error).toContain(String(MAX_TOTAL_ROWS));
  });

  it("tom tabell → ingen rader, ingen feil, én forespørsel", async () => {
    const db = fakePostgrest(0);

    const { rows, error } = await fetchAllRows(db.page);

    expect(rows).toEqual([]);
    expect(error).toBeNull();
    expect(db.page).toHaveBeenCalledTimes(1);
  });
});
