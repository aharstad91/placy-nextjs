// Ett temas side: hva temaet betyr for akkurat dette prosjektet, hva megleren
// bør gjøre med det, stedene kjøperne sjekker og spørsmålene de leser (også de
// ingen leser — det er et funn).

import type { CategoryInsight, FaqInsight, InsightReport, PoiInsight } from "@/lib/insight/types";
import { growth, underperformingFaq, type Recommendation } from "@/lib/insight/recommendations";
import { getIcon } from "@/lib/utils/map-icons";
import { Bar, nb, pct, RecommendationCard, SectionTitle, Trend } from "./insight-parts";

function themeSentence(c: CategoryInsight, reached: boolean): string {
  if (!reached) return `${c.opens} åpninger til nå. For få til å sammenligne med andre boards.`;
  const parts = [`${c.label} får ${pct(c.share)} av tema-åpningene her.`];
  if (c.baselineShare !== null) {
    const d = c.deltaPp ?? 0;
    parts.push(
      Math.abs(d) < 2
        ? `Det er som på andre Placy-boards (${pct(c.baselineShare)}).`
        : `På andre Placy-boards er det ${pct(c.baselineShare)}, så temaet ${d > 0 ? "trekker mer" : "trekker mindre"} akkurat her.`,
    );
  }
  const g = growth(c.opens, c.prevOpens);
  if (g !== null && c.prevOpens >= 5) parts.push(`${g >= 0 ? "Opp" : "Ned"} ${Math.abs(Math.round(g * 100))} % fra forrige periode.`);
  return parts.join(" ");
}

export function InsightThemeView({ report: r, theme: c, pois, faq, recommendations }: {
  report: InsightReport;
  theme: CategoryInsight;
  pois: PoiInsight[];
  faq: FaqInsight[];
  recommendations: Recommendation[];
}) {
  const Icon = getIcon(c.icon ?? "MapPin");
  const color = c.color ?? "#78716c";
  const maxPoi = Math.max(1, ...pois.map((p) => p.clicks + p.explores));
  const maxFaq = Math.max(1, ...faq.map((f) => f.opens));
  const weak = new Set(underperformingFaq(faq).map((f) => f.id));
  const sortedFaq = [...faq].sort((a, b) => b.opens - a.opens);
  const reached = r.threshold.reached;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-white p-5 ring-1 ring-black/5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: color }}>
            <Icon size={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight text-stone-900">{c.label}</h2>
            <div className="text-[13px] text-stone-500">
              {nb.format(c.opens)} åpninger siste {r.window.days} dager · <Trend now={c.opens} before={c.prevOpens} />
            </div>
          </div>
        </div>
        <p className="mt-4 text-[14.5px] leading-relaxed text-stone-700">{themeSentence(c, reached)}</p>
      </section>

      <section>
        <SectionTitle sub="regelbasert, fra tallene under">Dette bør du gjøre</SectionTitle>
        {recommendations.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-[13.5px] text-stone-500 ring-1 ring-black/5">
            {reached ? "Ingenting skiller seg ut i dette temaet ennå." : "Kommer når boardet har nok åpninger."}
          </p>
        ) : (
          <ul className="space-y-3">
            {recommendations.map((rec) => <RecommendationCard key={rec.id} rec={rec} color={color} />)}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
        <SectionTitle sub="klikk og utforsk">Stedene kjøperne sjekker</SectionTitle>
        {pois.length === 0 ? (
          <p className="text-[13px] text-stone-400">Ingen steder klikket ennå.</p>
        ) : (
          <ol className="divide-y divide-black/5">
            {pois.slice(0, 10).map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] text-stone-800">{p.name}</div>
                  <div className="mt-1.5"><Bar value={p.clicks + p.explores} max={maxPoi} color={color} /></div>
                </div>
                <div className="w-10 text-right text-[13px] tabular-nums text-stone-700">{p.clicks + p.explores}</div>
                <div className="w-14 text-right"><Trend now={p.clicks + p.explores} before={p.prevTotal} className="text-[11.5px]" /></div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
        <SectionTitle sub="åpnet i spørsmål og svar">Spørsmålene de leser</SectionTitle>
        {sortedFaq.length === 0 ? (
          <p className="text-[13px] text-stone-400">Temaet har ingen spørsmål på boardet.</p>
        ) : (
          <ol className="divide-y divide-black/5">
            {sortedFaq.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-[14px] leading-snug text-stone-800">
                    <span>{f.question}</span>
                    {weak.has(f.id) && (
                      <span className="rounded-full bg-amber-50 px-1.5 py-px text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">lite lest</span>
                    )}
                  </div>
                  <div className="mt-1.5 max-w-xs"><Bar value={f.opens} max={maxFaq} color={f.opens === 0 ? "#d6d3d1" : color} /></div>
                </div>
                <div className="w-10 text-right text-[13px] tabular-nums text-stone-700">
                  {f.opens === 0 ? <span className="text-stone-400">0</span> : f.opens}
                </div>
                <div className="w-14 text-right"><Trend now={f.opens} before={f.prevOpens} className="text-[11.5px]" /></div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
