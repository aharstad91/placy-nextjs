// Anbefalinger: regelbaserte lesninger av InsightReport, skrevet for megleren
// som skal forstå hva tallene betyr og hva hen bør gjøre videre. Ren funksjon,
// ingen LLM (arkitekturregel: aldri runtime-LLM). Hver anbefaling bærer
// BEVISET sitt (`why`) så megleren kan etterprøve den mot tallene selv.
//
// Reglene leser tre ting: tema-avvik (mot andre boards og mot forrige periode),
// spørsmål (hva som leses og hva som ignoreres) og steder. Segment-ord brukes
// bare der to uavhengige signaler peker samme vei.

import type { CategoryInsight, FaqInsight, InsightReport, PoiInsight } from "./types";

export type RecommendationKind =
  | "tema-trekker"
  | "tema-lite-brukt"
  | "sted-trekker"
  | "faq-flere"
  | "faq-revider"
  | "bil"
  | "kilder"
  | "for-tidlig";

export interface Recommendation {
  id: string;
  kind: RecommendationKind;
  /** Tema anbefalingen hører til; null = gjelder hele boardet (Beliggenhet). */
  themeId: string | null;
  themeLabel: string | null;
  /** Hva megleren bør gjøre — imperativ, én linje. */
  title: string;
  /** Tallene som begrunner det — én setning. */
  why: string;
  /** Konkret neste steg — én setning. Kan være tom når tittelen er nok. */
  next?: string;
}

/** Status per tema, brukt i tema-flisene: ett ord, ikke et tall. */
export type ThemeStatus = "trekker" | "som-ventet" | "lite-brukt" | "for-tidlig";

export const THEME_STATUS_LABEL: Record<ThemeStatus, string> = {
  trekker: "Trekker",
  "som-ventet": "Som ventet",
  "lite-brukt": "Lite brukt",
  "for-tidlig": "For tidlig",
};

const PP_LEAD = 5;
const GROWTH_LEAD = 0.3;
const MIN_PREV_FOR_GROWTH = 10;

const pct = (x: number) => `${Math.round(x * 100)} %`;

/** Vekst mot forrige periode; null uten grunnlag. */
export function growth(now: number, before: number): number | null {
  if (before === 0) return null;
  return (now - before) / before;
}

export function themeStatus(c: CategoryInsight, reached: boolean): ThemeStatus {
  if (!reached) return "for-tidlig";
  const g = growth(c.opens, c.prevOpens);
  if ((c.deltaPp ?? 0) >= PP_LEAD || (g !== null && c.prevOpens >= MIN_PREV_FOR_GROWTH && g >= GROWTH_LEAD)) return "trekker";
  if ((c.deltaPp ?? 0) <= -PP_LEAD) return "lite-brukt";
  return "som-ventet";
}

/** Spørsmål under et tema som nesten aldri åpnes, målt mot temaets eget snitt. */
export function underperformingFaq(faq: FaqInsight[]): FaqInsight[] {
  const total = faq.reduce((a, f) => a + f.opens, 0);
  if (faq.length < 3 || total < 10) return [];
  const mean = total / faq.length;
  const floor = Math.max(1, Math.round(mean * 0.2));
  return faq.filter((f) => f.opens <= floor).sort((a, b) => a.opens - b.opens);
}

function quote(q: string) {
  return `«${q}»`;
}

function joinNames(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} og ${items[items.length - 1]}`;
}

export function deriveRecommendations(r: InsightReport): Recommendation[] {
  const out: Recommendation[] = [];
  const reached = r.threshold.reached;
  const lower = (s: string) => s.toLowerCase();

  if (!reached) {
    out.push({
      id: "for-tidlig",
      kind: "for-tidlig",
      themeId: null,
      themeLabel: null,
      title: "For tidlig å anbefale noe",
      why: `${r.views} av ${r.threshold.minViews} åpninger som trengs før mønstrene er til å stole på.`,
      next: "Del lenken på visning og i annonsen, så fylles dette opp.",
    });
  }

  const poisByTheme = new Map<string, PoiInsight[]>();
  for (const p of r.pois) if (p.categoryId) poisByTheme.set(p.categoryId, [...(poisByTheme.get(p.categoryId) ?? []), p]);
  const faqByTheme = new Map<string, FaqInsight[]>();
  for (const f of r.faq) if (f.categoryId) faqByTheme.set(f.categoryId, [...(faqByTheme.get(f.categoryId) ?? []), f]);

  if (reached) {
    // Tema som trekker — det viktigste funnet, alltid først.
    const leads = r.categories
      .filter((c) => themeStatus(c, true) === "trekker")
      .sort((a, b) => (b.deltaPp ?? 0) - (a.deltaPp ?? 0));
    for (const c of leads.slice(0, 2)) {
      const g = growth(c.opens, c.prevOpens);
      const topPoi = (poisByTheme.get(c.id) ?? [])[0];
      const byBaseline = (c.deltaPp ?? 0) >= PP_LEAD && c.baselineShare !== null;
      const why = byBaseline
        ? `${pct(c.share)} av tema-åpningene her går til ${lower(c.label)}. På andre Placy-boards er det ${pct(c.baselineShare ?? 0)}.`
        : `${c.opens} åpninger, opp ${pct(g ?? 0)} fra forrige periode.`;
      out.push({
        id: `tema-trekker:${c.id}`,
        kind: "tema-trekker",
        themeId: c.id,
        themeLabel: c.label,
        title: `Løft ${lower(c.label)} i annonsen og på visning`,
        why,
        next: topPoi
          ? `${topPoi.name} er stedet flest sjekker under temaet — nevn det med navn.`
          : "Åpne visningen med dette temaet.",
      });
    }

    // Sted som trekker klart mer enn resten i sitt tema.
    for (const [themeId, pois] of poisByTheme) {
      const [first, second] = pois;
      if (!first || first.clicks + first.explores < 8) continue;
      const secondTotal = second ? second.clicks + second.explores : 0;
      if (first.clicks + first.explores < secondTotal * 2) continue;
      if (out.some((o) => o.kind === "tema-trekker" && o.themeId === themeId)) continue; // alt nevnt der
      out.push({
        id: `sted-trekker:${first.id}`,
        kind: "sted-trekker",
        themeId,
        themeLabel: first.categoryLabel,
        title: `Nevn ${first.name} i annonsen`,
        why: `${first.clicks + first.explores} handlinger på stedet — ${second ? `mer enn dobbelt så mange som ${second.name}` : "det eneste stedet i temaet som sjekkes"}.`,
      });
    }

    // Spørsmål: revider de som ikke leses, legg til flere der de leses.
    for (const c of r.categories) {
      const faq = faqByTheme.get(c.id) ?? [];
      const total = faq.reduce((a, f) => a + f.opens, 0);
      const weak = underperformingFaq(faq);
      const top = [...faq].sort((a, b) => b.opens - a.opens)[0];
      if (weak.length >= 2 && top) {
        out.push({
          id: `faq-revider:${c.id}`,
          kind: "faq-revider",
          themeId: c.id,
          themeLabel: c.label,
          title: `Skriv om ${weak.length} spørsmål under ${lower(c.label)}`,
          why: `${joinNames(weak.slice(0, 2).map((f) => quote(f.question)))} åpnes nesten aldri (${weak.slice(0, 2).map((f) => f.opens).join(" og ")} ganger), mens ${quote(top.question)} er åpnet ${top.opens} ganger.`,
          next: "Spørsmål ingen åpner tar plassen fra spørsmål kjøperne faktisk har.",
        });
      }
      const opened = faq.filter((f) => f.opens > 0).length;
      if (faq.length >= 3 && total >= 8 && opened / faq.length >= 0.6) {
        out.push({
          id: `faq-flere:${c.id}`,
          kind: "faq-flere",
          themeId: c.id,
          themeLabel: c.label,
          title: `Legg til flere spørsmål under ${lower(c.label)}`,
          why: `${opened} av ${faq.length} spørsmål er lest, ${total} ganger til sammen. Kjøperne leter etter mer her.`,
          next: "Send oss spørsmålene dere får på visning — vi legger dem inn.",
        });
      }
    }

    // Tema som ignoreres.
    const ignored = r.categories
      .filter((c) => themeStatus(c, true) === "lite-brukt")
      .sort((a, b) => (a.deltaPp ?? 0) - (b.deltaPp ?? 0))[0];
    if (ignored) {
      out.push({
        id: `tema-lite-brukt:${ignored.id}`,
        kind: "tema-lite-brukt",
        themeId: ignored.id,
        themeLabel: ignored.label,
        title: `Ikke bruk tid på ${lower(ignored.label)} i salgsmateriellet`,
        why: `${pct(ignored.share)} av tema-åpningene her, mot ${pct(ignored.baselineShare ?? 0)} på andre boards.`,
        next: "Kjøperne for dette prosjektet lurer på annet. Bruk plassen på det som trekker.",
      });
    }

    const modeTotal = r.travelModes.walk + r.travelModes.bike + r.travelModes.car;
    if (modeTotal >= 20 && r.travelModes.car / modeTotal >= 0.35) {
      out.push({
        id: "bil",
        kind: "bil",
        themeId: null,
        themeLabel: null,
        title: "Ha kjøretidene klare som tall",
        why: `${pct(r.travelModes.car / modeTotal)} sjekker avstander med bil, ikke til fots.`,
        next: "Sentrum, E6 og nærmeste kjøpesenter i minutter, i annonsen og på visning.",
      });
    }
  }

  if (r.views >= 30 && !r.sources.some((s) => s.source !== "direkte")) {
    out.push({
      id: "kilder",
      kind: "kilder",
      themeId: null,
      themeLabel: null,
      title: "Merk lenkene så du ser hvor kjøperne kommer fra",
      why: `Alle ${r.views} åpningene kommer fra umerkede lenker.`,
      next: "Legg ?src=finn på lenken i FINN-annonsen og ?src=qr på QR-koden. Da viser rapporten hvilken kanal som sender interesserte kjøpere.",
    });
  }

  return sortRecommendations(out);
}

/** Rekkefølge for megleren: tema-funn først, så spørsmålene, så enkeltsteder (maks to). */
const KIND_ORDER: RecommendationKind[] = [
  "for-tidlig", "tema-trekker", "faq-revider", "faq-flere", "sted-trekker", "tema-lite-brukt", "bil", "kilder",
];
const MAX_STED = 2;

function sortRecommendations(recs: Recommendation[]): Recommendation[] {
  const sorted = [...recs].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  let steder = 0;
  return sorted.filter((r) => (r.kind === "sted-trekker" ? steder++ < MAX_STED : true));
}
