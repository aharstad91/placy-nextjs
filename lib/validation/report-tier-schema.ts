import { z } from "zod";

/**
 * Zod-skjema for `ReportConfig.reportTier` — deklarert leveransenivå for
 * rapport-boardet (se feltdokumentasjonen i lib/types.ts). To-nivå-modell
 * (1=autonomt generert default, 2=+kuratert editorial). Literal-union
 * (ikke z.number()) så `"2"` (string) og out-of-range-tall (0, 3, 4) avvises
 * ved parsing av rå JSON/JSONB fra begge datakilder.
 */
export const ReportTierSchema = z.union([z.literal(1), z.literal(2)]);

/** Feltet er optional i config: `undefined`/manglende = nivå 1-semantikk. */
export const OptionalReportTierSchema = ReportTierSchema.optional();

export type ReportTier = z.infer<typeof ReportTierSchema>;
