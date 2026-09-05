// Aggregering: rå event-rader → InsightReport. Ren funksjon, ingen I/O, så
// den kjører likt på ekte rader og demodata.
//
// Fra Moat-2-planen (docs/strategy/2026-06-27-data-moatene…):
//  1. Avvik, ikke absolutte klikk — mot andre boards OG mot forrige periode.
//  2. Kontekst gjør engasjement til segment — reisemåte/3D leses fra konvolutten.
//  3. Rapportér bare over en volumterskel.
//
// Radene som sendes inn skal dekke BÅDE gjeldende periode [since, until] og
// perioden før (samme lengde). Funksjonen splitter på `since`.

import type { TravelMode } from "@/lib/types";
import type {
  CategoryInsight,
  DailyPoint,
  FaqInsight,
  InsightEventRow,
  InsightLabels,
  InsightReport,
  PoiInsight,
  SourceInsight,
} from "./types";

export const MIN_VIEWS_FOR_REPORT = 50;
const DAY_MS = 86_400_000;

interface Envelope {
  travel_mode?: TravelMode;
  has_3d_addon?: boolean;
  categories_presented?: string[];
  source?: string;
}

function envelopeOf(row: InsightEventRow): Envelope | undefined {
  const ctx = row.payload?.context;
  return ctx && typeof ctx === "object" ? (ctx as Envelope) : undefined;
}
const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : undefined);

const osloDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit" });
export function osloDate(iso: string | Date): string {
  return osloDay.format(typeof iso === "string" ? new Date(iso) : iso);
}

function inc(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}
function sum(map: Map<string, number>) {
  return [...map.values()].reduce((a, b) => a + b, 0);
}
function mostCommon(values: number[]): number | undefined {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: number | undefined, bestN = 0;
  for (const [v, n] of counts) if (n > bestN) [best, bestN] = [v, n];
  return best;
}

/** Tellinger for ett vindu. */
interface WindowCounts {
  views: number;
  interactions: number;
  daily: Map<string, DailyPoint>;
  cat: Map<string, number>;
  presented: Map<string, number[]>;
  poiClicks: Map<string, number>;
  poiExplores: Map<string, number>;
  poiOutbound: Map<string, number>;
  faq: Map<string, number>;
  faqCategory: Map<string, string | undefined>;
  sources: Map<string, number>;
  travel: Record<TravelMode, number>;
  threeDOn: number;
  threeDKnown: number;
}

function countWindow(rows: InsightEventRow[], since: Date, until: Date, lastKeyOverride?: string): WindowCounts {
  const c: WindowCounts = {
    views: 0, interactions: 0, daily: new Map(), cat: new Map(), presented: new Map(),
    poiClicks: new Map(), poiExplores: new Map(), poiOutbound: new Map(), faq: new Map(),
    faqCategory: new Map(), sources: new Map(), travel: { walk: 0, bike: 0, car: 0 }, threeDOn: 0, threeDKnown: 0,
  };
  const lastKey = lastKeyOverride ?? osloDate(until);
  for (let d = since.getTime(); d <= until.getTime() + DAY_MS; d += DAY_MS) {
    const key = osloDate(new Date(d));
    if (key > lastKey) break;
    if (!c.daily.has(key)) c.daily.set(key, { date: key, views: 0, interactions: 0 });
  }
  const sinceMs = since.getTime(), untilMs = until.getTime();
  for (const row of rows) {
    const ts = new Date(row.created_at).getTime();
    if (ts < sinceMs || ts > untilMs) continue;
    const env = envelopeOf(row);
    const key = osloDate(row.created_at);
    const day = c.daily.get(key) ?? { date: key, views: 0, interactions: 0 };
    c.daily.set(key, day);

    if (row.event_type === "board_viewed") {
      c.views++; day.views++;
      inc(c.sources, env?.source ?? "direkte");
      continue;
    }
    c.interactions++; day.interactions++;
    if (env?.travel_mode && env.travel_mode in c.travel) c.travel[env.travel_mode]++;
    if (typeof env?.has_3d_addon === "boolean") { c.threeDKnown++; if (env.has_3d_addon) c.threeDOn++; }

    const categoryId = str(row.payload?.category_id);
    switch (row.event_type) {
      case "category_opened": {
        if (!categoryId) break;
        inc(c.cat, categoryId);
        const idx = env?.categories_presented?.indexOf(categoryId);
        if (idx !== undefined && idx >= 0) c.presented.set(categoryId, [...(c.presented.get(categoryId) ?? []), idx + 1]);
        break;
      }
      case "poi_clicked": if (row.poi_id) inc(c.poiClicks, row.poi_id); break;
      case "poi_explore_opened": if (row.poi_id) inc(c.poiExplores, row.poi_id); break;
      case "poi_outbound_clicked": if (row.poi_id) inc(c.poiOutbound, row.poi_id); break;
      case "faq_opened": {
        const faqId = str(row.payload?.faq_id);
        if (!faqId) break;
        inc(c.faq, faqId);
        if (!c.faqCategory.has(faqId)) c.faqCategory.set(faqId, categoryId);
        break;
      }
    }
  }
  return c;
}

export interface AggregateInput {
  /** Rader for gjeldende OG forrige periode; splittes på `since`. */
  rows: InsightEventRow[];
  /** category_opened-rader fra andre boards i gjeldende periode. */
  baselineRows: InsightEventRow[];
  labels: InsightLabels;
  since: Date;
  until: Date;
  minViews?: number;
}

export function aggregateInsight(input: AggregateInput): InsightReport {
  const { rows, baselineRows, labels, since, until } = input;
  const minViews = input.minViews ?? MIN_VIEWS_FOR_REPORT;
  const sinceMs = since.getTime();
  const cur = countWindow(rows.filter((r) => new Date(r.created_at).getTime() >= sinceMs), since, until);
  // Forrige periode: like mange dager, rett før `since`.
  const prevSince = new Date(sinceMs - cur.daily.size * DAY_MS);
  const prevUntil = new Date(sinceMs - 1);
  // Siste dag i forrige periode = dagen før gjeldende periodes første dag
  // (Oslo-dato), så UTC/Oslo-grensen ikke gir en dag for mye.
  const prev = countWindow(
    rows.filter((r) => new Date(r.created_at).getTime() < sinceMs),
    prevSince,
    prevUntil,
    osloDate(new Date(sinceMs - DAY_MS)),
  );

  // Siste 24 t per time.
  const hourly = new Array<number>(24).fill(0);
  const nowMs = until.getTime();
  for (const r of rows) {
    if (r.event_type !== "board_viewed") continue;
    const age = nowMs - new Date(r.created_at).getTime();
    if (age < 0 || age >= 24 * 3_600_000) continue;
    hourly[23 - Math.floor(age / 3_600_000)]++;
  }

  const categoryLabel = new Map(labels.categories.map((c) => [c.id, c.label]));
  const baseOpens = new Map<string, number>();
  for (const row of baselineRows) { const id = str(row.payload?.category_id); if (id) inc(baseOpens, id); }
  const baseTotal = sum(baseOpens);
  const catTotal = sum(cur.cat);

  const categoryIds = new Set([...labels.categories.map((c) => c.id), ...cur.cat.keys()]);
  const categories: CategoryInsight[] = [...categoryIds].map((id) => {
    const opens = cur.cat.get(id) ?? 0;
    const share = catTotal > 0 ? opens / catTotal : 0;
    const baselineShare = baseTotal > 0 ? (baseOpens.get(id) ?? 0) / baseTotal : null;
    return {
      id, label: categoryLabel.get(id) ?? id, opens, prevOpens: prev.cat.get(id) ?? 0, share, baselineShare,
      deltaPp: baselineShare === null ? null : Math.round((share - baselineShare) * 1000) / 10 || 0,
      presentedPosition: mostCommon(cur.presented.get(id) ?? []) ?? null,
    };
  }).sort((a, b) => b.opens - a.opens);

  const poiIds = new Set([...cur.poiClicks.keys(), ...cur.poiExplores.keys(), ...cur.poiOutbound.keys()]);
  const pois: PoiInsight[] = [...poiIds].map((id) => {
    const meta = labels.pois.get(id);
    return {
      id, name: meta?.name ?? id,
      categoryLabel: meta?.categoryId ? (categoryLabel.get(meta.categoryId) ?? null) : null,
      clicks: cur.poiClicks.get(id) ?? 0, explores: cur.poiExplores.get(id) ?? 0, outbound: cur.poiOutbound.get(id) ?? 0,
      prevTotal: (prev.poiClicks.get(id) ?? 0) + (prev.poiExplores.get(id) ?? 0),
    };
  }).sort((a, b) => b.clicks + b.explores - (a.clicks + a.explores)).slice(0, 10);

  const faq: FaqInsight[] = [...cur.faq.entries()].map(([id, opens]) => {
    const meta = labels.faq.get(id);
    // Katalogens tema vinner; konvoluttens category_id er fallback (kurators egne id-er).
    const cat = meta?.categoryId ?? cur.faqCategory.get(id);
    return { id, question: meta?.question ?? id, categoryLabel: cat ? (categoryLabel.get(cat) ?? cat) : null, opens, prevOpens: prev.faq.get(id) ?? 0 };
  }).sort((a, b) => b.opens - a.opens).slice(0, 8);

  const sources: SourceInsight[] = [...cur.sources.entries()]
    .map(([source, n]) => ({ source, views: n, share: cur.views > 0 ? n / cur.views : 0, prevViews: prev.sources.get(source) ?? 0 }))
    .sort((a, b) => b.views - a.views);

  const reached = cur.views >= minViews;
  const report: InsightReport = {
    window: { since: since.toISOString(), until: until.toISOString(), days: cur.daily.size },
    views: cur.views, interactions: cur.interactions,
    threshold: { minViews, reached },
    previous: { views: prev.views, interactions: prev.interactions, daily: [...prev.daily.values()].sort((a, b) => a.date.localeCompare(b.date)) },
    daily: [...cur.daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    hourly,
    categories, pois, faq, sources,
    travelModes: cur.travel,
    threeDShare: cur.threeDKnown > 0 ? cur.threeDOn / cur.threeDKnown : null,
    observations: [], actions: [],
  };
  if (reached) Object.assign(report, deriveNarrative(report));
  return report;
}

// ---------------------------------------------------------------------------
// Signaler: korte én-linjere, ingen avsnitt. Segment-ord bare når to
// uavhengige signaler peker samme vei.
// ---------------------------------------------------------------------------
const pct = (x: number) => `${Math.round(x * 100)} %`;

export function deriveNarrative(r: InsightReport): { observations: string[]; actions: string[] } {
  const observations: string[] = [];
  const actions: string[] = [];
  const withBase = r.categories.filter((c) => c.deltaPp !== null);
  const lead = [...withBase].sort((a, b) => (b.deltaPp ?? 0) - (a.deltaPp ?? 0))[0];
  if (lead && (lead.deltaPp ?? 0) >= 5) {
    observations.push(`${lead.label}: ${pct(lead.share)} her mot ${pct(lead.baselineShare ?? 0)} på andre boards`);
    const poi = r.pois.find((p) => p.categoryLabel === lead.label);
    actions.push(poi ? `Åpne visningen med ${lead.label.toLowerCase()} — ${poi.name}` : `Åpne visningen med ${lead.label.toLowerCase()}`);
    actions.push(`Målrett annonser mot ${lead.label.toLowerCase()}-segmentet`);
  }
  const ignored = withBase.filter((c) => (c.deltaPp ?? 0) <= -5)[0];
  if (ignored) observations.push(`${ignored.label} ignoreres: ${pct(ignored.share)} mot ${pct(ignored.baselineShare ?? 0)}`);

  const modeTotal = r.travelModes.walk + r.travelModes.bike + r.travelModes.car;
  if (modeTotal >= 20 && r.travelModes.car / modeTotal >= 0.35) {
    observations.push(`${pct(r.travelModes.car / modeTotal)} sjekker avstander med bil`);
    actions.push("Ha kjøretid til sentrum og E6 klart som tall");
  }
  const topFaq = r.faq[0];
  if (topFaq && topFaq.opens >= 5) actions.push(`Svar på «${topFaq.question}» i annonsen`);

  if (r.views >= 30 && !r.sources.some((s) => s.source !== "direkte")) {
    actions.push("Bruk ?src=qr / finn / mail i lenkene så kilden blir målbar");
  }
  return { observations: observations.slice(0, 3), actions: actions.slice(0, 3) };
}

export function sourceName(source: string): string {
  const names: Record<string, string> = {
    direkte: "Direkte / ukjent", qr: "QR-kode", finn: "FINN Nyttige lenker", mail: "E-post",
    some: "Sosiale medier", embed: "Innebygd", visning: "Visningsbekreftelse",
  };
  return names[source] ?? source;
}
