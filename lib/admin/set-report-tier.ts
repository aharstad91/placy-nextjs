import "server-only";
import { createServerClient } from "@/lib/supabase/client";
import {
  OptionalReportTierSchema,
  type ReportTier,
} from "@/lib/validation/report-tier-schema";
import {
  validateReportTier,
  type ReportTierFinding,
} from "@/lib/validation/report-tier";

/**
 * reportTier-setter (PRD 12 Unit 3 AC1/AC2) — read-modify-write av
 * `v2.products.config.reportConfig.reportTier` (JSONB-felt, INGEN flat
 * kolonne). Forretningslogikken bor her, ikke i UI-komponenten.
 *
 * Validering FØR skriving: OptionalReportTierSchema avviser 3/"2"/0.
 * Etter skriving kjøres den lette nivå-2-readiness-sjekken
 * (validateReportTier, PRD 2 §5.3) og funnene returneres som
 * FORHÅNDSVISNING — dette er deklarasjon+validering, ALDRI render-gating
 * (AC6): setteren skriver kun deklarasjonen.
 */

export interface SetReportTierInput {
  productId: string;
  /** 1 | 2 | undefined (undefined = fjern deklarasjonen → nivå 1-default) */
  reportTier: unknown;
}

export interface SetReportTierResult {
  reportTier: ReportTier | undefined;
  /** Readiness-funn for forhåndsvisning («nivå 2 deklarert, mangler kuratert
   *  editorial på tema X») — informasjon til operatøren, ikke en gate. */
  findings: ReportTierFinding[];
}

export async function setReportTier(
  input: SetReportTierInput
): Promise<SetReportTierResult> {
  const parsed = OptionalReportTierSchema.safeParse(input.reportTier);
  if (!parsed.success) {
    throw new Error(
      `Ugyldig reportTier ${JSON.stringify(input.reportTier)} — må være 1, 2 eller tom`
    );
  }
  const tier = parsed.data;

  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Database not configured");
  }
  const db = supabase.schema("v2");

  // READ — eksisterende config er sannhetskilden; vi rører kun tier-feltet.
  const { data: product, error: readError } = await db
    .from("products")
    .select("id, config")
    .eq("id", input.productId)
    .maybeSingle();

  if (readError) {
    throw new Error(`Kunne ikke lese produkt: ${readError.message}`);
  }
  if (!product) {
    throw new Error(`Produkt ikke funnet: ${input.productId}`);
  }

  // MODIFY — bevar alt annet i config/reportConfig uendret.
  const config = { ...((product.config as Record<string, unknown>) ?? {}) };
  const reportConfig = {
    ...((config.reportConfig as Record<string, unknown>) ?? {}),
  };
  if (tier === undefined) {
    delete reportConfig.reportTier;
  } else {
    reportConfig.reportTier = tier;
  }
  config.reportConfig = reportConfig;

  // WRITE — JSONB-payload; cast fordi den genererte Json-typen ikke
  // aksepterer Record<string, unknown> strukturelt.
  const { error: writeError } = await db
    .from("products")
    .update({ config: config as never })
    .eq("id", input.productId);

  if (writeError) {
    throw new Error(`Kunne ikke skrive reportTier: ${writeError.message}`);
  }

  // Forhåndsvisning: dekker boardet faktisk det deklarerte nivået?
  const findings = validateReportTier({
    slug: input.productId,
    reportConfig: reportConfig as Parameters<
      typeof validateReportTier
    >[0]["reportConfig"],
  });

  return { reportTier: tier, findings };
}
