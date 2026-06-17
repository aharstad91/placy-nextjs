import { z } from "zod";

/**
 * Zod-skjema for `ReportConfig.reportTier` — deklarert leveransenivå for
 * rapport-boardet (se feltdokumentasjonen i lib/types.ts). Literal-union
 * (ikke z.number()) så `"3"` (string) og out-of-range-tall avvises ved
 * parsing av rå JSON/JSONB fra begge datakilder.
 */
export const ReportTierSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

/** Feltet er optional i config: `undefined`/manglende = nivå 1-semantikk. */
export const OptionalReportTierSchema = ReportTierSchema.optional();

export type ReportTier = z.infer<typeof ReportTierSchema>;
