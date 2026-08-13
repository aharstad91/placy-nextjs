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
import type { PoiGrounding, PoiGroundingAttempt } from "../lib/types";

/**
 * Hvor lenge et strykende forsøk regnes som ferskt. Innenfor vinduet hopper vi
 * over POI-en uten `--force`. Uten dette ville hver kjøring re-generert de
 * samme strykerne med ny Gemini-kost — på Sundsøya er det den største
 * enkeltposten, siden ruralt innhold stryker oftere enn urbant.
 */
export const FAILED_ATTEMPT_STALE_DAYS = 30;

export type SkipReason =
  | "har-bestått-grounding"
  | "har-kuratert-tekst"
  | "ferskt-strykende-forsøk"
  | "ferskt-tomt-forsøk"
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

  const staleDays = opts.staleDays ?? FAILED_ATTEMPT_STALE_DAYS;
  const ageDaysSince = (iso: string): number | undefined => {
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return undefined;
    return (opts.now.getTime() - ms) / 86_400_000;
  };

  // Kuratert tekst er Placy-eid og vinner i modalen — leverandør-teksten under
  // den blir aldri sett. Å generere den på nytt koster kvote for null synlig
  // effekt. `--force` går forbi (fanget over), så kalibrering er fortsatt mulig.
  const curated = poi.grounding?.curated;
  if (curated) {
    return {
      action: "skip",
      reason: "har-kuratert-tekst",
      detail: `kuratert ${curated.curatedAt}`,
    };
  }

  const generated = poi.grounding?.generated;
  if (generated) {
    if (generated.qualityGate.passed) {
      return {
        action: "skip",
        reason: "har-bestått-grounding",
        detail: `generert ${generated.fetchedAt}`,
      };
    }
    const ageDays = ageDaysSince(generated.fetchedAt);
    if (ageDays !== undefined && ageDays < staleDays) {
      return {
        action: "skip",
        reason: "ferskt-strykende-forsøk",
        detail: `strøk for ${Math.round(ageDays)} dager siden: ${generated.qualityGate.reason ?? "ukjent grunn"}`,
      };
    }
    return { action: "generate" };
  }

  // Tomt forsøk. `error` er transient (timeout/kvote/nett) og skal prøves igjen
  // straks — bare `no-data` og `refusal` holdes tilbake i vinduet. Uten dette
  // skillet ville en kvote-timeout låst POI-en ute i 30 dager.
  const attempt = poi.grounding?.lastAttempt;
  if (attempt && attempt.outcome !== "error") {
    const ageDays = ageDaysSince(attempt.at);
    if (ageDays !== undefined && ageDays < staleDays) {
      return {
        action: "skip",
        reason: "ferskt-tomt-forsøk",
        detail: `${attempt.outcome} for ${Math.round(ageDays)} dager siden: ${attempt.reason}`,
      };
    }
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
    // Et vellykket forsøk gjør det forrige tomme forsøket utdatert. Lot vi det
    // ligge, ville arbeidslista fortsatt bedt om håndskrevet tekst for et POI
    // som nettopp fikk innhold.
  };
}

/**
 * Bygg grounding-objektet for et forsøk som ikke ga innhold.
 *
 * Bevarer både `generated` og `curated`: et tomt re-forsøk skal ikke slette
 * innhold vi allerede har. Det er hele grunnen til at dette ikke er en enkel
 * overskriving av kolonnen.
 */
export function mergeFailedAttempt(
  existing: PoiGrounding | undefined,
  attempt: PoiGroundingAttempt,
): PoiGrounding {
  return {
    poiGroundingVersion: 1,
    ...(existing?.generated ? { generated: existing.generated } : {}),
    ...(existing?.curated ? { curated: existing.curated } : {}),
    lastAttempt: attempt,
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
