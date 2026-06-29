import { REPORT_THEME_DEFAULTS } from "@/lib/pipeline/report-defaults";

/**
 * Kanonisk liste over bolig-tema-IDer, AVLEDET fra REPORT_THEME_DEFAULTS — IKKE en
 * duplikat-liste (én sannhetskilde for tema→kategori-taksonomien). Eid av PRD 2.
 *
 * 🔁 KODEGEN-KILDE: dette er kilden for TS→Python-kodegen av tema-lista. Selve
 * kodegen bygges i PRD 8; den eneste reelle drift-flaten i dag er den hardkodede
 * tema-lista i `scripts/extract-skolekrets-boundary.py` (~linje 37–39), som skal
 * regenereres fra THEME_IDS — ikke vedlikeholdes manuelt parallelt.
 */
export const THEME_IDS: readonly string[] = REPORT_THEME_DEFAULTS.map((t) => t.id);
