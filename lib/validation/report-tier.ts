import type { ReportConfig, ReportThemeEditorial } from "@/lib/types";
import {
  OptionalReportTierSchema,
  type ReportTier,
} from "./report-tier-schema";

/**
 * Lett nivå-2-readiness-sjekk for rapport-boardet (to-nivå-modell).
 *
 * Deklarert `reportTier` (1/2) er kontrakten — satt av produkteier ved oppsett:
 *
 *   Nivå 1 (default): autonomt generert, ingen krav utover grunnoppsettet — alltid grønn.
 *   Nivå 2 (+Editorial): `editorial` (ikke-tom body eller ≥1 highlight) på ALLE temaer.
 *
 * Sjekken validerer KUN det som faktisk definerer nivå 2 + to trivielle
 * data-sjekker (invalid-tier, highlight-poi). De ortogonale render-aksene
 * (3D, VO, camera-tours, brokers, brand) gates IKKE her — de drives av egne
 * flagg/data-presence i render-laget (PRD 9), ikke av nivå. Se kontrakten i
 * docs/rebuild/tier-kjerne-vs-overflate.md §3/§4/§6.
 *
 * Ren funksjon uten I/O og uten render-lag-import — kun `poiIds` injiseres
 * (for highlight-resolusjon) så kjernen er offline-testbar. Funn er data,
 * ingen throws; driverne oversetter til exit-koder/feilmeldinger.
 */

export interface ReportTierFinding {
  level: "error" | "warning";
  /** Stabil sjekk-id: invalid-tier | editorial | highlight-poi */
  check: string;
  detail: string;
}

export interface ReportTierProject {
  /** url-slug — brukes i funn-tekster. */
  slug: string;
  reportConfig?: ReportConfig;
  /** Prosjektets POI-ider for highlight-resolusjon. Utelatt → sjekken hoppes over
   *  (f.eks. Supabase-driveren som ikke henter POI-pool). */
  poiIds?: string[];
}

function hasEditorialContent(e: ReportThemeEditorial | undefined): boolean {
  if (!e) return false;
  return (e.body?.trim().length ?? 0) > 0 || (e.highlightPoiIds?.length ?? 0) > 0;
}

export function validateReportTier(
  project: ReportTierProject,
): ReportTierFinding[] {
  const rc = project.reportConfig;
  // Rå JSON/JSONB kan inneholde verdier typene ikke tillater (4, "3", 0) —
  // parse feltet eksplisitt før det brukes som nivå.
  const rawTier = (rc as Record<string, unknown> | undefined)?.reportTier;
  const parsed = OptionalReportTierSchema.safeParse(rawTier);
  if (!parsed.success) {
    return [
      {
        level: "error",
        check: "invalid-tier",
        detail: `ugyldig reportTier-verdi ${JSON.stringify(rawTier)} — må være 1 eller 2 (tall)`,
      },
    ];
  }
  const tier: ReportTier = parsed.data ?? 1;
  const themes = rc?.themes ?? [];
  const findings: ReportTierFinding[] = [];

  // Uavhengig av nivå: highlightPoiIds som ikke resolver droppes stille av
  // render-laget (chips forsvinner) — flagg dem så innholdstapet blir synlig.
  if (project.poiIds) {
    const known = new Set(project.poiIds);
    for (const t of themes) {
      for (const id of t.editorial?.highlightPoiIds ?? []) {
        if (!known.has(id)) {
          findings.push({
            level: "warning",
            check: "highlight-poi",
            detail: `${t.id}: highlightPoiId "${id}" finnes ikke blant prosjektets POI-er — chipen droppes stille`,
          });
        }
      }
    }
  }

  if (tier === 2) {
    if (themes.length === 0) {
      findings.push({
        level: "error",
        check: "editorial",
        detail: `nivå ${tier} deklarert, men reportConfig.themes mangler/er tom`,
      });
    }
    for (const t of themes) {
      if (!hasEditorialContent(t.editorial)) {
        findings.push({
          level: "error",
          check: "editorial",
          detail: `${t.id}: mangler editorial (ikke-tom body eller ≥1 highlight)`,
        });
      }
    }
  }

  return findings;
}

/** «deklarert nivå 2, mangler: editorial»-stil for drivere. */
export function summarizeTierFindings(
  declared: ReportTier | undefined,
  findings: ReportTierFinding[],
): string {
  const errorChecks = Array.from(
    new Set(findings.filter((f) => f.level === "error").map((f) => f.check)),
  );
  if (errorChecks.length === 0) return `nivå ${declared ?? 1} OK`;
  return `deklarert nivå ${declared ?? 1}, mangler: ${errorChecks.join(", ")}`;
}
