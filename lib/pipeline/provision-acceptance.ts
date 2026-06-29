/**
 * Akseptansesjekk for rapport-provisjon (PRD 3 / r03.7) — REN sjekk.
 *
 * Verifiserer board-substans og at deklarert reportTier er fullt dekket av
 * config-en pipelinen nettopp skrev. Returnerer strukturerte funn (ingen
 * CLI-logging her) slik at både CLI-orkestratoren og self-serve (Unit 8) kan
 * kalle den og presentere/eksitere selv. `ok=false` ⇒ minst én error ⇒
 * non-zero exit hos kalleren.
 *
 * Tier-validatoren (PRD 2, `validateReportTier`) kalles, men eies ikke her.
 * MERK (r02.2-reconciliation): to-nivå-modellen fjernet has3dAddon/cameraTour
 * fra tier-validatoren — 3D/kamera er ortogonale render-flagg, IKKE tier-gatet.
 * Derfor kalles `validateReportTier({ slug, reportConfig })` UTEN dem (den gamle
 * bead-spec-en refererte getCameraTour, som ikke lenger finnes/trengs).
 *
 * Leser via server-side wrapper (service-role) mot v2, med eksplisitt
 * error-handling på hvert Supabase-kall (AC5).
 */

import { createServerClient } from "@/lib/supabase/client";
import {
  validateReportTier,
  summarizeTierFindings,
} from "@/lib/validation/report-tier";
import type { ReportConfig } from "@/lib/types";

export type AcceptanceLevel = "pass" | "warn" | "error";

export interface AcceptanceFinding {
  level: AcceptanceLevel;
  message: string;
  /** Eventuelle underlinjer (f.eks. per-tema tier-funn). */
  details?: string[];
}

export interface AcceptanceResult {
  /** false ⇒ minst én error ⇒ non-zero exit hos kalleren. */
  ok: boolean;
  findings: AcceptanceFinding[];
  urls: { local: string; prod: string };
}

export async function runAcceptanceCheck(options: {
  productId: string;
  customer: string;
  slug: string;
}): Promise<AcceptanceResult> {
  const { productId, customer, slug } = options;
  const findings: AcceptanceFinding[] = [];
  const urls = {
    local: `http://localhost:3000/eiendom/${customer}/${slug}/rapport-board`,
    prod: `https://www.placy.no/eiendom/${customer}/${slug}/rapport-board`,
  };

  const baseClient = createServerClient();
  if (!baseClient) {
    findings.push({
      level: "error",
      message: "Kan ikke verifisere — Supabase ikke konfigurert",
    });
    return { ok: false, findings, urls };
  }
  const db = baseClient.schema("v2");

  let ok = true;

  // 1. product_categories ikke tom (ellers viser boardet «0 av 0 steder»)
  const { data: cats, error: catsError } = await db
    .from("product_categories")
    .select("category_id")
    .eq("product_id", productId);
  if (catsError) {
    findings.push({
      level: "error",
      message: `Henting av product_categories feilet: ${catsError.message}`,
    });
    ok = false;
  } else {
    const catCount = cats?.length ?? 0;
    if (catCount === 0) {
      findings.push({
        level: "error",
        message: "product_categories er tom — board viser 0 av 0 steder",
      });
      ok = false;
    } else {
      findings.push({ level: "pass", message: `product_categories: ${catCount} kategorier` });
    }
  }

  // 2. Config + tier-validering
  const { data: product, error: productError } = await db
    .from("products")
    .select("config")
    .eq("id", productId)
    .single();
  if (productError) {
    findings.push({
      level: "error",
      message: `Henting av produkt-config feilet: ${productError.message}`,
    });
    ok = false;
  }

  const reportConfig = (product?.config as { reportConfig?: ReportConfig } | null)
    ?.reportConfig;
  const themes =
    (reportConfig as { themes?: Array<Record<string, unknown>> } | undefined)
      ?.themes ?? [];

  // 2a. Temaer med leadText (advarsel, ikke feil)
  const themesWithLead = themes.filter(
    (t) => typeof t.leadText === "string" && t.leadText.trim()
  );
  if (themesWithLead.length < 6) {
    findings.push({ level: "warn", message: `Kun ${themesWithLead.length}/6 temaer har leadText` });
  } else {
    findings.push({ level: "pass", message: "Alle 6 temaer har leadText" });
  }

  // 2b. Min-chips QA-flagg — INFORMATIVT, ikke feil (AC3). Arvet (nivå-2)
  // editorial med <2 highlight-chips; body-only (0 chips + body) er legitimt.
  const inheritedThemes = (
    themes as Array<{
      id?: string;
      editorial?: { body?: string; highlightPoiIds?: unknown[] };
    }>
  ).filter((t) => t.editorial);
  if (inheritedThemes.length > 0) {
    const thin: string[] = [];
    for (const t of inheritedThemes) {
      const chips = Array.isArray(t.editorial?.highlightPoiIds)
        ? t.editorial!.highlightPoiIds!.length
        : 0;
      const hasBody = (t.editorial?.body ?? "").trim().length > 0;
      if (chips >= 2) continue;
      if (chips === 1) {
        thin.push(`'${t.id}' (1 chip — tynt, vurder flere kandidater)`);
      } else if (hasBody) {
        thin.push(`'${t.id}' (body-only, 0 chips — bevisst tilstand)`);
      } else {
        thin.push(`'${t.id}' (0 chips, ingen body — sjekk gating)`);
      }
    }
    if (thin.length > 0) {
      findings.push({
        level: "warn",
        message: `QA min-chips: ${thin.length} arvet tema med <2 chips`,
        details: thin,
      });
    } else {
      findings.push({
        level: "pass",
        message: `QA min-chips: alle ${inheritedThemes.length} arvede temaer har ≥2 chips`,
      });
    }
  }

  // 2c. Nivå-validering (PRD 2). 3D/kamera er ortogonale flagg → IKKE sendt inn.
  const tierFindings = validateReportTier({ slug, reportConfig });
  const tierErrors = tierFindings.filter((f) => f.level === "error");
  const tierSummary = summarizeTierFindings(reportConfig?.reportTier, tierFindings);
  if (tierErrors.length > 0) {
    findings.push({
      level: "error",
      message: `nivå: ${tierSummary}`,
      details: tierErrors.map((f) => `[${f.check}] ${f.detail}`),
    });
    ok = false;
  } else {
    findings.push({
      level: "pass",
      message: `nivå: ${tierSummary}`,
      details: tierFindings.map((f) => `[${f.check}] ${f.detail}`),
    });
  }

  // 3. POI-antall (advarsel, ikke feil)
  const { data: pois, error: poisError } = await db
    .from("product_pois")
    .select("poi_id")
    .eq("product_id", productId);
  if (poisError) {
    findings.push({
      level: "warn",
      message: `Henting av product_pois feilet: ${poisError.message}`,
    });
  } else {
    const poiCount = pois?.length ?? 0;
    findings.push({ level: "pass", message: `product_pois: ${poiCount} POI-er` });
    if (poiCount < 10) {
      findings.push({ level: "warn", message: "Færre enn 10 POI-er — boardet kan bli tynt" });
    }
  }

  return { ok, findings, urls };
}
