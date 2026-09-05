// Demodata for innsiktsrapporten (`?demo=1`). Deterministisk (seedet PRNG) og
// KUN i minnet — skrives aldri til v2.events. Tabellen er append-only (078),
// så syntetiske rader der ville vært irreversible og forgiftet Moat 2.
//
// Profilen er bevisst «barnefamilie-tung» så rapporten viser hvordan et
// tydelig avvik ser ut; grunnlaget (andre boards) er flatere. Bruker boardets
// EGNE kategori-, POI- og FAQ-id-er så navnene i rapporten er ekte.

import type { InsightEventRow, InsightLabels } from "./types";

/** mulberry32 — liten, deterministisk PRNG. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T>(rand: () => number, items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rand() * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i];
    if (x <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Vekt per tema-id for demo-boardet. Ukjente id-er får 1. */
const PROJECT_WEIGHTS: Record<string, number> = {
  "barn-oppvekst": 5.5,
  hverdagsliv: 3,
  transport: 2.2,
  "natur-friluftsliv": 2,
  "mat-drikke": 1.4,
  "trening-aktivitet": 1,
};
/** Flatere grunnlag — slik «andre boards» ser ut i demoen. */
const BASELINE_WEIGHTS: Record<string, number> = {
  "barn-oppvekst": 2.2,
  hverdagsliv: 3,
  transport: 2.6,
  "natur-friluftsliv": 2.2,
  "mat-drikke": 2.4,
  "trening-aktivitet": 1.6,
};

const SOURCES = ["direkte", "qr", "finn", "mail", "some"];
const SOURCE_WEIGHTS = [4.5, 1.6, 2.4, 1.1, 0.7];

export interface DemoOptions {
  labels: InsightLabels;
  /** Start for RADENE (inkluderer forrige periode). */
  since: Date;
  until: Date;
  /** Start for gjeldende periode — grunnlaget («andre boards») lages bare herfra. */
  baselineSince?: Date;
  seed?: number;
  /** Snitt åpninger per dag (hverdag). Helg får 60 %. */
  viewsPerDay?: number;
}

export function generateDemoEvents(opts: DemoOptions): {
  rows: InsightEventRow[];
  baselineRows: InsightEventRow[];
} {
  const rand = rng(opts.seed ?? 20260902);
  const viewsPerDay = opts.viewsPerDay ?? 22;
  const cats = opts.labels.categories.map((c) => c.id);
  const presented = [...cats];
  const w = cats.map((c) => PROJECT_WEIGHTS[c] ?? 1);
  const wb = cats.map((c) => BASELINE_WEIGHTS[c] ?? 1);

  const poisByCat = new Map<string, string[]>();
  for (const [id, meta] of opts.labels.pois) {
    if (!meta.categoryId) continue;
    const list = poisByCat.get(meta.categoryId) ?? [];
    list.push(id);
    poisByCat.set(meta.categoryId, list);
  }
  // Per kategori: noen få POI-er drar mest (Zipf-aktig), resten sprer seg.
  const poiWeights = new Map<string, number[]>();
  for (const [cat, ids] of poisByCat) poiWeights.set(cat, ids.map((_, i) => 1 / (i + 1)));

  // FAQ per tema (+ globale spørsmål overalt). Barn-spørsmål vektes opp.
  const globalFaq = [...opts.labels.faq.entries()].filter(([, m]) => !m.categoryId).map(([id]) => id);
  const faqByCat = new Map<string, string[]>();
  for (const [id, m] of opts.labels.faq) {
    if (!m.categoryId) continue;
    faqByCat.set(m.categoryId, [...(faqByCat.get(m.categoryId) ?? []), id]);
  }
  const faqWeight = (id: string) => (/skole|barnehage|barn/.test(id) ? 4 : 1);

  const rows: InsightEventRow[] = [];
  const baselineRows: InsightEventRow[] = [];
  const dayMs = 86_400_000;

  for (let t = opts.since.getTime(); t <= opts.until.getTime(); t += dayMs) {
    const day = new Date(t);
    const weekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
    const prevPeriod = opts.baselineSince ? t < opts.baselineSince.getTime() : false;
    const n = Math.round(viewsPerDay * (weekend ? 0.6 : 1) * (prevPeriod ? 0.72 : 1) * (0.7 + rand() * 0.6));

    for (let i = 0; i < n; i++) {
      // Trafikken klumper seg om kvelden.
      const hour = pickWeighted(rand, [8, 12, 17, 20, 22], [1, 1.5, 2, 4, 2.5]) + rand() * 1.5;
      const ts = new Date(t + hour * 3_600_000 + rand() * 600_000);
      if (ts.getTime() > opts.until.getTime()) continue; // ikke framtid
      const source = pickWeighted(rand, SOURCES, SOURCE_WEIGHTS);
      const travel = pickWeighted(rand, ["walk", "bike", "car"] as const, [6, 1, 3]);
      const has3d = rand() < 0.85;
      const context = {
        mode: "report",
        has_3d_addon: has3d,
        categories_presented: presented,
        locale: "no",
        travel_mode: travel,
        ...(source === "direkte" ? {} : { source }),
      };
      const at = (offsetSec: number) => new Date(ts.getTime() + offsetSec * 1000).toISOString();

      rows.push({ event_type: "board_viewed", poi_id: null, payload: { context }, created_at: at(0) });

      // 35 % ser bare på boardet uten å åpne noe.
      if (rand() < 0.35) continue;
      let clock = 5;
      const opens = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < opens; k++) {
        const cat = pickWeighted(rand, cats, w);
        clock += 10 + rand() * 40;
        rows.push({
          event_type: "category_opened",
          poi_id: null,
          payload: { category_id: cat, context },
          created_at: at(clock),
        });
        const poiIds = poisByCat.get(cat) ?? [];
        const clicks = poiIds.length === 0 ? 0 : Math.floor(rand() * 3);
        for (let c = 0; c < clicks; c++) {
          const poi = pickWeighted(rand, poiIds, poiWeights.get(cat)!);
          clock += 5 + rand() * 20;
          rows.push({
            event_type: "poi_clicked",
            poi_id: poi,
            payload: { category_id: cat, context },
            created_at: at(clock),
          });
          if (rand() < 0.3) {
            clock += 3 + rand() * 10;
            rows.push({
              event_type: "poi_explore_opened",
              poi_id: poi,
              payload: { category_id: cat, has_grounding: rand() < 0.6, context },
              created_at: at(clock),
            });
          }
        }
        const faqIds = [...(faqByCat.get(cat) ?? []), ...globalFaq];
        if (faqIds.length > 0 && rand() < 0.4) {
          const faqId = pickWeighted(rand, faqIds, faqIds.map(faqWeight));
          clock += 4 + rand() * 15;
          rows.push({
            event_type: "faq_opened",
            poi_id: null,
            payload: { faq_id: faqId, category_id: cat, context },
            created_at: at(clock),
          });
        }
      }
    }

    // Grunnlag: andre boards, samme dag, flatere profil, ~3× volum.
    if (opts.baselineSince && t < opts.baselineSince.getTime()) continue;
    const baseN = Math.round(n * 3 * 1.4);
    for (let i = 0; i < baseN; i++) {
      baselineRows.push({
        event_type: "category_opened",
        poi_id: null,
        payload: { category_id: pickWeighted(rand, cats, wb) },
        created_at: new Date(t + rand() * dayMs).toISOString(),
      });
    }
  }

  return { rows, baselineRows };
}
