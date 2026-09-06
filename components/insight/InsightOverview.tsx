// Oversikten: hele boardet som samlekategori (det boardet kaller området).
//
//   1. Hvor mange, går det opp eller ned, hvordan sjekker de, hvor kommer de fra.
//   2. Dette bør du gjøre nå — anbefalingene på tvers av temaer.
//   3. Temaene som fliser (boardets ikon og farge) med ett statusord hver.
//      Hver flis er en lenke til temaets egen side.

import Link from "next/link";
import type { CategoryInsight, InsightReport } from "@/lib/insight/types";
import { sourceName } from "@/lib/insight/aggregate";
import { growth, themeStatus, THEME_STATUS_LABEL, type Recommendation, type ThemeStatus } from "@/lib/insight/recommendations";
import { getIcon } from "@/lib/utils/map-icons";
import { Bar, nb, pct, RecommendationCard, SectionTitle, Sparkline, Trend } from "./insight-parts";

const STATUS_STYLE: Record<ThemeStatus, string> = {
  trekker: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  "som-ventet": "bg-stone-100 text-stone-600 ring-stone-200",
  "lite-brukt": "bg-amber-50 text-amber-800 ring-amber-200",
  "for-tidlig": "bg-stone-50 text-stone-400 ring-stone-200",
};

function BeliggenhetCard({ r }: { r: InsightReport }) {
  const g = growth(r.views, r.previous.views);
  const modeTotal = r.travelModes.walk + r.travelModes.bike + r.travelModes.car;
  const modes = [["walk", "til fots"], ["bike", "på sykkel"], ["car", "med bil"]] as const;
  const dominant = modeTotal > 0 ? [...modes].sort((a, b) => r.travelModes[b[0]] - r.travelModes[a[0]])[0] : null;
  const known = r.sources.filter((s) => s.source !== "direkte");
  const knownViews = known.reduce((a, s) => a + s.views, 0);
  const perView = r.views > 0 ? r.interactions / r.views : 0;

  const trendSentence =
    g === null
      ? "Første periode med tall. Sammenligningen med forrige periode kommer når neste er ferdig."
      : `${g >= 0 ? "Opp" : "Ned"} ${Math.abs(Math.round(g * 100))} % fra forrige periode (${nb.format(r.previous.views)} åpninger).`;

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-black/5 sm:p-6">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-400">Hele nabolaget</div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="text-4xl font-semibold tabular-nums tracking-tight text-stone-900">{nb.format(r.views)}</div>
          <div className="text-[14px] text-stone-600">åpninger av nabolagskartet siste {r.window.days} dager</div>
        </div>
        <div className="w-full sm:w-64"><Sparkline points={r.daily} /></div>
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-stone-700">{trendSentence}</p>

      {!r.threshold.reached && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-900">
          Under {r.threshold.minViews} åpninger. Prosenter og anbefalinger holdes tilbake til grunnlaget er stort nok til å stole på.
        </p>
      )}

      <dl className="mt-5 grid gap-3 text-[13px] sm:grid-cols-3">
        <div className="rounded-xl bg-stone-50 px-3.5 py-3">
          <dt className="text-stone-500">Hvor mye de gjør</dt>
          <dd className="mt-0.5 font-medium text-stone-900">
            {r.views > 0 ? `${perView.toFixed(1).replace(".", ",")} handlinger per åpning` : "Ingen åpninger ennå"}
          </dd>
        </div>
        <div className="rounded-xl bg-stone-50 px-3.5 py-3">
          <dt className="text-stone-500">Hvordan de sjekker avstander</dt>
          <dd className="mt-0.5 font-medium text-stone-900">
            {dominant && modeTotal >= 10 ? `${pct(r.travelModes[dominant[0]] / modeTotal)} ${dominant[1]}` : "For få til å si"}
          </dd>
        </div>
        <div className="rounded-xl bg-stone-50 px-3.5 py-3">
          <dt className="text-stone-500">Hvor de kommer fra</dt>
          <dd className="mt-0.5 font-medium text-stone-900">
            {knownViews === 0
              ? "Ingen merkede lenker ennå"
              : `${pct(knownViews / Math.max(1, r.views))} fra ${known.slice(0, 2).map((s) => sourceName(s.source).toLowerCase()).join(" og ")}`}
          </dd>
        </div>
      </dl>

      {known.length > 0 && (
        <ul className="mt-4 space-y-2">
          {r.sources.map((s) => (
            <li key={s.source} className="flex items-center gap-3 text-[13px]">
              <span className="w-40 shrink-0 truncate text-stone-700">{sourceName(s.source)}</span>
              <div className="flex-1"><Bar value={s.views} max={r.views} color={s.source === "direkte" ? "#d6d3d1" : "#1c1917"} /></div>
              <span className="w-10 text-right tabular-nums text-stone-700">{s.views}</span>
              <span className="w-14 text-right"><Trend now={s.views} before={s.prevViews} className="text-[11.5px]" /></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ThemeTile({ c, reached, href }: { c: CategoryInsight; reached: boolean; href: string }) {
  const Icon = getIcon(c.icon ?? "MapPin");
  const status = themeStatus(c, reached);
  const color = c.color ?? "#78716c";
  return (
    <Link href={href} prefetch className="flex flex-col items-start rounded-2xl bg-white p-4 text-left ring-1 ring-black/5 transition-shadow hover:shadow-md">
      <span className="flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ backgroundColor: color }}>
        <Icon size={19} aria-hidden />
      </span>
      <span className="mt-3 text-[15px] font-semibold leading-tight tracking-tight text-stone-900">{c.label}</span>
      <span className="mt-1 text-[12.5px] tabular-nums text-stone-500">
        {reached ? `${pct(c.share)} av tema-åpningene` : `${nb.format(c.opens)} åpninger`}
      </span>
      <span className="mt-3 flex w-full items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ring-1 ${STATUS_STYLE[status]}`}>{THEME_STATUS_LABEL[status]}</span>
        <Trend now={c.opens} before={c.prevOpens} className="text-[12px]" />
      </span>
    </Link>
  );
}

export function InsightOverview({ report: r, recommendations, themes, basePath, query }: {
  report: InsightReport;
  recommendations: Recommendation[];
  themes: CategoryInsight[];
  basePath: string;
  query: string;
}) {
  const colorOf = new Map(themes.map((c) => [c.id, c.color]));
  const top = recommendations.slice(0, 5);
  return (
    <div className="space-y-8">
      <BeliggenhetCard r={r} />

      <section>
        <SectionTitle sub="regelbasert, fra tallene under">Dette bør du gjøre nå</SectionTitle>
        {top.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-[13.5px] text-stone-500 ring-1 ring-black/5">
            Ingenting skiller seg ut ennå. Temaene brukes omtrent som på andre Placy-boards.
          </p>
        ) : (
          <ul className="space-y-3">
            {top.map((rec) => (
              <RecommendationCard
                key={rec.id}
                rec={rec}
                color={rec.themeId ? colorOf.get(rec.themeId) : undefined}
                themeHref={rec.themeId ? `${basePath}/${rec.themeId}${query}` : undefined}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle sub="trykk på et tema for stedene og spørsmålene">Temaer</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {themes.map((c) => <ThemeTile key={c.id} c={c} reached={r.threshold.reached} href={`${basePath}/${c.id}${query}`} />)}
        </div>
      </section>
    </div>
  );
}
