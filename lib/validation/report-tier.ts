import type {
  CategoryCameraConfig,
  ReportConfig,
  ReportThemeAudio,
  ReportThemeEditorial,
} from "@/lib/types";
import { getProjectBrokers } from "@/lib/themes/project-brand";
import {
  OptionalReportTierSchema,
  type ReportTier,
} from "./report-tier-schema";

/**
 * Nivå-validering for rapport-boardet.
 *
 * Deklarert `reportTier` (1/2/3) er kontrakten — satt av produkteier ved
 * oppsett. Hvert nivå har en enkel liste required elements; validatoren
 * sjekker at de er fylt inn (se
 * docs/brainstorms/2026-06-10-placy-tier-modell-requirements.md):
 *
 *   Nivå 1 (Basic):     ingen krav utover grunnoppsettet — alltid grønn.
 *   Nivå 2 (+Editorial): `editorial` (ikke-tom body eller ≥1 highlight) på ALLE temaer.
 *   Nivå 3 (Maks):       nivå 2 + spillbart VO-spor på alle temaer og
 *                        welcome/hjem/outro + camera-tours-entry for sluggen +
 *                        has3dAddon + ansvarlig megler + assets.brand.
 *
 * VO-kravet speiler render-laget 1:1: boardet spiller
 * `pickPlayable(reelsAudio) ?? pickPlayable(audio)` der playable = manus+url
 * (board-data.ts `pickPlayableAudio`, reels-data.ts `c.reelsAudio ?? c.audio`).
 * Hvilket av de to sporene som bærer VO-en er en implementasjonsakse, ikke et
 * nivå-krav — StasjonsKvartalet kjører på reelsAudio, Grilstad på audio.
 * `audioTourEnabled` er et dødt flagg på boardet og sjekkes ikke
 * (verifisert 2026-06-10: ingen UI-konsument).
 *
 * Ren funksjon uten I/O — camera-tours-oppslaget injiseres av driveren
 * (CLI-script, Vitest, acceptanceCheck) så kjernen er offline-testbar.
 * Funn er data, ingen throws; driverne oversetter til exit-koder/feilmeldinger.
 */

export interface ReportTierFinding {
  level: "error" | "warning";
  /** Stabil sjekk-id: invalid-tier | editorial | vo | camera-tours |
   *  has3d-addon | brokers | brand-assets | highlight-poi */
  check: string;
  detail: string;
}

export interface ReportTierProject {
  /** url-slug — brukes i funn-tekster og av driveren til camera-tours-oppslag. */
  slug: string;
  reportConfig?: ReportConfig;
  /** Bor utenfor reportConfig (Project/ProjectContainer-nivå, `has_3d_addon` i Supabase). */
  has3dAddon?: boolean;
  /** Resultatet av `getCameraTour(slug)` — injiseres så kjernen er ren. */
  cameraTour?: Record<string, CategoryCameraConfig>;
  /** Prosjektets POI-ider for highlight-resolusjon. Utelatt → sjekken hoppes over
   *  (f.eks. Supabase-driveren som ikke henter POI-pool). */
  poiIds?: string[];
}

function hasEditorialContent(e: ReportThemeEditorial | undefined): boolean {
  if (!e) return false;
  return (e.body?.trim().length ?? 0) > 0 || (e.highlightPoiIds?.length ?? 0) > 0;
}

/** Speiler board-data.ts `pickPlayableAudio`: spillbart = manus+url. */
function isPlayable(a: ReportThemeAudio | undefined): boolean {
  return Boolean(a?.url && a?.manus?.trim());
}

/** Effektivt VO-spor slik boardet velger det: reelsAudio vinner når spillbart,
 *  ellers audio-tur-sporet (reels-data.ts `c.reelsAudio ?? c.audio` på
 *  pickPlayable-filtrerte spor). */
function hasPlayableVO(theme: {
  audio?: ReportThemeAudio;
  reelsAudio?: ReportThemeAudio;
}): boolean {
  return isPlayable(theme.reelsAudio) || isPlayable(theme.audio);
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
        detail: `ugyldig reportTier-verdi ${JSON.stringify(rawTier)} — må være 1, 2 eller 3 (tall)`,
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

  if (tier >= 2) {
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

  if (tier === 3) {
    const standalone = [
      ["welcome", rc?.welcomeAudio],
      ["hjem", rc?.heroAudio],
      ["outro", rc?.outroAudio],
    ] as const;
    for (const [label, audio] of standalone) {
      if (!isPlayable(audio)) {
        findings.push({
          level: "error",
          check: "vo",
          detail: `${label}-sporet mangler spillbar VO (manus+url)`,
        });
      }
    }
    for (const t of themes) {
      if (!hasPlayableVO(t)) {
        findings.push({
          level: "error",
          check: "vo",
          detail: `${t.id}: mangler spillbart VO-spor (reelsAudio eller audio med manus+url)`,
        });
      }
    }
    if (!project.cameraTour || Object.keys(project.cameraTour).length === 0) {
      findings.push({
        level: "error",
        check: "camera-tours",
        detail: `ingen camera-tours-entry for slug "${project.slug}" (components/variants/report/board/camera-tours.ts)`,
      });
    }
    if (project.has3dAddon !== true) {
      findings.push({
        level: "error",
        check: "has3d-addon",
        detail: "has3dAddon må være true — kino-kamera krever 3D-kart-addonet",
      });
    }
    // Ansvarlig megler-blokk (slutt-card under reels). Speiler boardets gating:
    // reportConfig.brokers vinner, ellers demo-fallback i project-brand.ts.
    // Mangler begge → ingen megler-card rendres. Warning per skall-filosofien:
    // placeholder-megler er nok struktur, ekte kontaktinfo fylles inn.
    const hasBrokers =
      (rc?.brokers?.length ?? 0) > 0 || getProjectBrokers(project.slug).length > 0;
    if (!hasBrokers) {
      findings.push({
        level: "warning",
        check: "brokers",
        detail: "ingen ansvarlig megler — legg inn reportConfig.brokers (placeholder eller ekte) for megler-blokken under reels",
      });
    }
    // brand-assets er WARNING, ikke error: per skall/placeholder-filosofien
    // (2026-06-10) deklareres nivået, og brand (logo/splash/video) fylles inn
    // når grafikken finnes. Manglende brand blokkerer ikke nivå 3 — den synes
    // som en gjenstående oppgave. Sett `assets.brand: true` når filene
    // (placeholder eller ekte) ligger på slug-konvensjonen.
    if (rc?.assets?.brand !== true) {
      findings.push({
        level: "warning",
        check: "brand-assets",
        detail: "assets.brand er ikke satt — legg inn logo/splash/splash-video (placeholder eller ekte) og flipp flagget for full brand",
      });
    }
  }

  return findings;
}

/** «deklarert nivå 3, mangler: camera-tours, has3d-addon»-stil for drivere. */
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
