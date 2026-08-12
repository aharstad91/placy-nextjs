/**
 * Ren logikk for scripts/ground-poi-content.ts — ingen I/O, ingen argv.
 *
 * Ligger separat fordi CLI-en parser argv på modulnivå (etablert mønster i
 * scripts/gemini-grounding.ts) og derfor ikke kan importeres i test uten å
 * kjøre. Alt som kan bestemmes uten nettverk hører hit.
 */

import {
  evaluatePoiQualityGate,
  type PoiQualityThresholds,
} from "../lib/gemini/poi-grounding";
import type { PoiGrounding } from "../lib/types";

/**
 * Hvor lenge et strykende forsøk regnes som ferskt. Innenfor vinduet hopper vi
 * over POI-en uten `--force`. Uten dette ville hver kjøring re-generert de
 * samme strykerne med ny Gemini-kost — på Sundsøya er det den største
 * enkeltposten, siden ruralt innhold stryker oftere enn urbant.
 */
export const FAILED_ATTEMPT_STALE_DAYS = 30;

export type SkipReason =
  | "har-bestått-grounding"
  | "ferskt-strykende-forsøk"
  | "mangler-navn";

export type PoiDecision =
  | { action: "generate" }
  | { action: "skip"; reason: SkipReason; detail?: string };

/**
 * Avgjør om et POI skal genereres for. Ren funksjon — testbar uten API.
 *
 * `--force` overstyrer alt bortsett fra manglende navn: uten navn finnes det
 * ingen prompt å bygge, og et kall ville brent kvote på ingenting.
 */
export function decidePoi(
  poi: { name: string | null; grounding: PoiGrounding | undefined },
  opts: { force: boolean; now: Date; staleDays?: number },
): PoiDecision {
  if (!poi.name?.trim()) {
    return { action: "skip", reason: "mangler-navn" };
  }
  if (opts.force) return { action: "generate" };

  const generated = poi.grounding?.generated;
  if (!generated) return { action: "generate" };

  if (generated.qualityGate.passed) {
    return {
      action: "skip",
      reason: "har-bestått-grounding",
      detail: `generert ${generated.fetchedAt}`,
    };
  }

  const staleDays = opts.staleDays ?? FAILED_ATTEMPT_STALE_DAYS;
  const fetchedAt = Date.parse(generated.fetchedAt);
  if (Number.isNaN(fetchedAt)) return { action: "generate" };

  const ageDays = (opts.now.getTime() - fetchedAt) / 86_400_000;
  if (ageDays < staleDays) {
    return {
      action: "skip",
      reason: "ferskt-strykende-forsøk",
      detail: `strøk for ${Math.round(ageDays)} dager siden: ${generated.qualityGate.reason ?? "ukjent grunn"}`,
    };
  }
  return { action: "generate" };
}

/**
 * Bevar det Placy-eide `curated`-laget ved re-generering. `--force` skal kunne
 * overskrive leverandør-output uten å slette megler-kuratering — det ville vært
 * et stille tap av Moat-1-arbeid som ikke kan gjenskapes automatisk.
 */
export function mergeGrounding(
  existing: PoiGrounding | undefined,
  nextGenerated: PoiGrounding["generated"],
): PoiGrounding {
  return {
    poiGroundingVersion: 1,
    ...(nextGenerated ? { generated: nextGenerated } : {}),
    ...(existing?.curated ? { curated: existing.curated } : {}),
  };
}

/**
 * Avled søke-anker fra POI-adressene: det hyppigste siste komma-segmentet.
 *
 * Prosjektnavnet er feil kilde — «Sundsøya» er utbyggingstomta, mens stedet
 * grounding-søket må ankres i er «Inderøy» (43 av 45 adresserte POI-er ender
 * der). Uten anker finner søket likelydende steder i andre land: kontrollkjøring
 * 2026-08-12 viste at «Muustrøparken» + feil kommune ga INGEN_DATA.
 */
export function deriveAreaHint(
  pois: Array<{ address: string | null }>,
): string | undefined {
  const counts = new Map<string, number>();
  for (const p of pois) {
    if (!p.address?.includes(",")) continue;
    const last = p.address.slice(p.address.lastIndexOf(",") + 1).trim();
    if (!last) continue;
    counts.set(last, (counts.get(last) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [seg, n] of counts) {
    if (n > bestCount) {
      best = seg;
      bestCount = n;
    }
  }
  return best;
}

export interface GateSample {
  poiId: string;
  name: string;
  charCount: number;
  sourceCount: number;
  passed: boolean;
  reason?: string;
}

/**
 * Terskel-sensitivitet: hva porten ville sagt under alternative terskelsett,
 * regnet på ALLEREDE hentede resultater.
 *
 * Dette er kalibrerings-instrumentet. Uten det måtte hver terskeljustering
 * koste 78 nye Gemini-kall, og terskler ville i praksis blitt gjettet én gang
 * og stått for alltid.
 */
export function thresholdSensitivity(
  samples: GateSample[],
  candidates: PoiQualityThresholds[],
): Array<{ thresholds: PoiQualityThresholds; passed: number; failed: number }> {
  return candidates.map((thresholds) => {
    let passed = 0;
    for (const s of samples) {
      const gate = evaluatePoiQualityGate(
        { narrative: "x".repeat(s.charCount), sourceCount: s.sourceCount },
        thresholds,
      );
      if (gate.passed) passed++;
    }
    return { thresholds, passed, failed: samples.length - passed };
  });
}

/** Histogram over en tallserie i faste bøtter. */
export function histogram(
  values: number[],
  buckets: number[],
): Array<{ label: string; count: number }> {
  const rows = buckets.map((lower, i) => {
    const upper = buckets[i + 1];
    return {
      label: upper === undefined ? `${lower}+` : `${lower}–${upper - 1}`,
      lower,
      upper,
      count: 0,
    };
  });
  for (const v of values) {
    for (let i = rows.length - 1; i >= 0; i--) {
      if (v >= rows[i].lower) {
        rows[i].count++;
        break;
      }
    }
  }
  return rows.map((r) => ({ label: r.label, count: r.count }));
}
