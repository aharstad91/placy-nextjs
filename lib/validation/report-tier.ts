import type {
  CategoryCameraConfig,
  ReportConfig,
  ReportThemeAudio,
  ReportThemeEditorial,
} from "@/lib/types";
import {
  OptionalReportTierSchema,
  type ReportTier,
} from "./report-tier-schema";

/**
 * Nivå-validering for rapport-boardet.
 *
 * Deklarert `reportTier` (1/2/3) er sannhetskilden for tiltenkt leveransenivå;
 * denne validatoren sjekker at deklarasjonen er fullt dekket av faktisk innhold.
 * Sjekklisten speiler nivå-definisjonstabellen 1:1 (se
 * docs/brainstorms/2026-06-10-placy-tier-modell-requirements.md):
 *
 *   Nivå 1 (Basic):     ingen krav utover grunnoppsettet — alltid grønn.
 *   Nivå 2 (+Editorial): `editorial` (ikke-tom body eller ≥1 highlight) på ALLE temaer.
 *   Nivå 3 (Maks):       nivå 2 + audioTourEnabled + audio-tur (manus+url) på alle
 *                        temaer og welcome/hero/outro + reels-VO (manus+url) på alle
 *                        temaer + camera-tours-entry for sluggen + has3dAddon +
 *                        assets.brand.
 *
 * Ren funksjon uten I/O — camera-tours-oppslaget injiseres av driveren
 * (CLI-script, Vitest, acceptanceCheck) så kjernen er offline-testbar.
 * Funn er data, ingen throws; driverne oversetter til exit-koder/feilmeldinger.
 */

export interface ReportTierFinding {
  level: "error" | "warning";
  /** Stabil sjekk-id: invalid-tier | editorial | audio-tour-enabled |
   *  tour-audio | reels-vo | camera-tours | has3d-addon | brand-assets |
   *  highlight-poi */
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

/** Hvilke deler av et audio-spor som mangler for full nivå 3-dekning. */
function missingAudioParts(a: ReportThemeAudio | undefined): string[] {
  const missing: string[] = [];
  if (!a?.manus?.trim()) missing.push("manus");
  if (!a?.url) missing.push("url");
  return missing;
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
    // Render-gatingen for audio-turen er `rc.audioTourEnabled` — komplett audio
    // med flagget av er usynlig for brukeren (nøyaktig «halv nivå 3»-feilmoden).
    if (rc?.audioTourEnabled !== true) {
      findings.push({
        level: "error",
        check: "audio-tour-enabled",
        detail: "audioTourEnabled må være true — uten flagget skjules hele audio-turen i render-laget",
      });
    }
    const standalone = [
      ["welcome", rc?.welcomeAudio],
      ["hero", rc?.heroAudio],
      ["outro", rc?.outroAudio],
    ] as const;
    for (const [label, audio] of standalone) {
      if (!audio?.url) {
        findings.push({
          level: "error",
          check: "tour-audio",
          detail: `${label}-sporet mangler url`,
        });
      }
    }
    for (const t of themes) {
      const missing = missingAudioParts(t.audio);
      if (missing.length > 0) {
        findings.push({
          level: "error",
          check: "tour-audio",
          detail: `${t.id}: audio-tur-sporet mangler ${missing.join("+")}`,
        });
      }
    }
    for (const t of themes) {
      const missing = missingAudioParts(t.reelsAudio);
      if (missing.length > 0) {
        findings.push({
          level: "error",
          check: "reels-vo",
          detail: `${t.id}: reels-VO mangler ${missing.join("+")}`,
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
    if (rc?.assets?.brand !== true) {
      findings.push({
        level: "error",
        check: "brand-assets",
        detail: "assets.brand må være true — og brand-filene må faktisk finnes før flagget settes (presence-marker, ikke ønske)",
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
