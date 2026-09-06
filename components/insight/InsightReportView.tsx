// Innsikts-dashboardet — server-komponent, ren HTML/SVG/Tailwind, ingen
// klient-JS. Tett og tallfokusert (GA-mønster): KPI-rad med endring mot
// forrige periode, linjediagram, kompakte tabeller med avvik. Prosa er
// begrenset til korte én-linjere i «Signaler».

import type { CategoryInsight, DailyPoint, InsightReport } from "@/lib/insight/types";
import { sourceName } from "@/lib/insight/aggregate";
import { deriveRecommendations } from "@/lib/insight/recommendations";

const BLUE = "#1a56db";
const pct = (x: number) => `${Math.round(x * 100)} %`;
const nb = new Intl.NumberFormat("nb-NO");
const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", timeZone: "Europe/Oslo" }).format(new Date(iso));

/** Endring i prosent mellom to tall; null når grunnlaget er 0. */
function change(now: number, before: number): number | null {
  if (before === 0) return null;
  return (now - before) / before;
}

function Delta({ now, before, small }: { now: number; before: number; small?: boolean }) {
  const c = change(now, before);
  if (c === null) return <span className={`text-stone-400 ${small ? "text-[11px]" : "text-xs"}`}>–</span>;
  const up = c >= 0;
  return (
    <span className={`whitespace-nowrap tabular-nums ${small ? "text-[11px]" : "text-xs"} font-medium ${up ? "text-emerald-700" : "text-rose-700"}`}>
      {up ? "↑" : "↓"} {Math.abs(Math.round(c * 100))} %
    </span>
  );
}

function Card({ title, right, children, className = "" }: { title?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-stone-200 bg-white ${className}`}>
      {title && (
        <header className="flex items-baseline justify-between px-4 pt-3.5">
          <h2 className="text-[13px] font-semibold text-stone-800">{title}</h2>
          {right && <div className="text-[11px] uppercase tracking-wide text-stone-400">{right}</div>}
        </header>
      )}
      <div className="px-4 pb-4 pt-2">{children}</div>
    </section>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`pb-1.5 text-[11px] font-medium uppercase tracking-wide text-stone-400 ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

/* ---------- Linjediagram: gjeldende (heltrukket) + forrige (stiplet) ---------- */
function LineChart({ current, previous }: { current: DailyPoint[]; previous: DailyPoint[] }) {
  const W = 640, H = 180, PL = 8, PR = 36, PT = 10, PB = 22;
  const n = Math.max(current.length, 2);
  const max = Math.max(1, ...current.map((d) => d.views), ...previous.map((d) => d.views));
  const niceMax = Math.ceil(max / 5) * 5 || 5;
  const x = (i: number) => PL + (i / (n - 1)) * (W - PL - PR);
  const y = (v: number) => PT + (1 - v / niceMax) * (H - PT - PB);
  const path = (pts: DailyPoint[]) => pts.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.views).toFixed(1)}`).join(" ");
  const ticks = [0, niceMax / 2, niceMax];
  const labelIdx = [0, Math.floor((n - 1) / 3), Math.floor((2 * (n - 1)) / 3), n - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Åpninger per dag">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="#e7e5e4" strokeWidth={1} />
          <text x={W - PR + 6} y={y(t) + 3.5} fontSize={10} fill="#a8a29e">{t}</text>
        </g>
      ))}
      <path d={path(previous.slice(-n))} fill="none" stroke={BLUE} strokeWidth={1.2} strokeDasharray="3 3" opacity={0.55} />
      <path d={path(current)} fill="none" stroke={BLUE} strokeWidth={2} />
      {current.map((d, i) => (i % Math.ceil(n / 15) === 0 || i === n - 1) && (
        <circle key={d.date} cx={x(i)} cy={y(d.views)} r={3} fill="#fff" stroke={BLUE} strokeWidth={1.5} />
      ))}
      {labelIdx.map((i) => current[i] && (
        <text key={i} x={x(i)} y={H - 6} fontSize={10} fill="#78716c" textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
          {fmtDay(current[i].date)}
        </text>
      ))}
    </svg>
  );
}

function HourBars({ hourly }: { hourly: number[] }) {
  const max = Math.max(1, ...hourly);
  return (
    <div className="flex h-14 items-end gap-[2px] border-b border-stone-200">
      {hourly.map((v, i) => (
        <div key={i} className="flex-1 rounded-t-[2px]" style={{ height: `${Math.max(v > 0 ? 6 : 1, (v / max) * 100)}%`, background: v > 0 ? BLUE : "#e7e5e4" }} title={`${v}`} />
      ))}
    </div>
  );
}

/* ---------- Kompakte rader med stolpe ---------- */
function RowBar({ value, max, muted }: { value: number; max: number; muted?: boolean }) {
  return (
    <div className="h-1 w-full rounded-full bg-stone-100">
      <div className="h-1 rounded-full" style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%`, background: muted ? "#a8a29e" : BLUE }} />
    </div>
  );
}

function deltaTone(d: number | null) {
  if (d === null) return "text-stone-400";
  return d >= 5 ? "text-emerald-700 font-medium" : d <= -5 ? "text-rose-700 font-medium" : "text-stone-500";
}

function CategoryTable({ rows, reached }: { rows: CategoryInsight[]; reached: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.opens));
  return (
    <table className="w-full text-[13px]">
      <thead><tr><Th>Kategori</Th><Th right>Åpn.</Th><Th right>Her</Th><Th right>Andre</Th><Th right>Avvik</Th><Th right>Plass</Th><Th right>Endr.</Th></tr></thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.id} className="border-t border-stone-100">
            <td className="py-2 pr-2">
              <div className="truncate">{c.label}</div>
              <div className="mt-1 max-w-[160px]"><RowBar value={c.opens} max={max} /></div>
            </td>
            <td className="py-2 text-right tabular-nums">{nb.format(c.opens)}</td>
            <td className="py-2 text-right tabular-nums">{reached ? pct(c.share) : "–"}</td>
            <td className="py-2 text-right tabular-nums text-stone-500">{c.baselineShare === null ? "–" : pct(c.baselineShare)}</td>
            <td className={`py-2 text-right tabular-nums ${deltaTone(reached ? c.deltaPp : null)}`}>
              {c.deltaPp === null || !reached ? "–" : `${Math.round(c.deltaPp) > 0 ? "+" : ""}${Math.round(c.deltaPp) || 0} pp`}
            </td>
            <td className="py-2 text-right tabular-nums text-stone-500">{c.presentedPosition ?? "–"}</td>
            <td className="py-2 text-right"><Delta now={c.opens} before={c.prevOpens} small /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------- Hovedvisning ---------- */
export function InsightReportView({ report: r, projectName, customerName, demo }: {
  report: InsightReport; projectName: string; customerName: string; demo: boolean;
}) {
  // «Signaler» leser nå anbefalingsmotoren direkte. Tidligere lå de ferdig
  // formulerte strengene på rapporten (`observations`/`actions`); de er
  // erstattet av `deriveRecommendations`, som bærer beviset sitt i `why`.
  const recommendations = deriveRecommendations(r);
  const perView = r.views > 0 ? r.interactions / r.views : 0;
  const prevPerView = r.previous.views > 0 ? r.previous.interactions / r.previous.views : 0;
  const known = r.sources.filter((s) => s.source !== "direkte").reduce((a, s) => a + s.views, 0);
  const prevKnown = r.sources.filter((s) => s.source !== "direkte").reduce((a, s) => a + s.prevViews, 0);
  const modeTotal = r.travelModes.walk + r.travelModes.bike + r.travelModes.car;
  const last24 = r.hourly.reduce((a, b) => a + b, 0);
  const maxPoi = Math.max(1, ...r.pois.map((p) => p.clicks + p.explores));
  const maxFaq = Math.max(1, ...r.faq.map((f) => f.opens));

  const kpis: Array<{ label: string; value: string; now: number; before: number }> = [
    { label: "Åpninger", value: nb.format(r.views), now: r.views, before: r.previous.views },
    { label: "Handlinger", value: nb.format(r.interactions), now: r.interactions, before: r.previous.interactions },
    { label: "Handlinger / åpning", value: perView.toFixed(1), now: perView, before: prevPerView },
    { label: "Kjent kilde", value: r.views > 0 ? pct(known / r.views) : "–", now: known, before: prevKnown },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 text-stone-900">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-stone-400">Placy · Innsikt</div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{projectName}</h1>
          <div className="text-xs text-stone-500">{customerName}</div>
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-500">
          {demo && <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-900">Demodata</span>}
          <span className="rounded border border-stone-200 bg-white px-2.5 py-1">Siste {r.window.days} dager · {fmtDay(r.window.since)}–{fmtDay(r.window.until)}</span>
        </div>
      </header>

      {!r.threshold.reached && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900">
          Under {r.threshold.minViews} åpninger ({r.views}) — prosenter og signaler holdes tilbake til grunnlaget er stort nok.
        </div>
      )}

      {/* Rad 1: KPI + trend | siste 24 t */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <div className="-mx-4 -mt-2 grid grid-cols-2 border-b border-stone-200 sm:grid-cols-4">
            {kpis.map((k, i) => (
              <div key={k.label} className={`px-4 py-3 ${i === 0 ? "border-t-2 border-t-[#1a56db] bg-stone-50/60" : "border-t-2 border-t-transparent"}`}>
                <div className="text-[12px] text-stone-500">{k.label}</div>
                <div className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">{k.value}</div>
                <div className="mt-0.5"><Delta now={k.now} before={k.before} /></div>
              </div>
            ))}
          </div>
          <div className="mt-3"><LineChart current={r.daily} previous={r.previous.daily} /></div>
          <div className="mt-1 flex items-center gap-4 text-[11px] text-stone-500">
            <span className="flex items-center gap-1.5"><span className="inline-block h-[2px] w-4" style={{ background: BLUE }} /> Siste {r.window.days} dager</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-0 w-4 border-t border-dashed" style={{ borderColor: BLUE }} /> Forrige periode</span>
          </div>
        </Card>

        <Card title="Siste 24 timer" right="åpninger">
          <div className="text-3xl font-semibold tabular-nums tracking-tight">{last24}</div>
          <div className="mt-3"><HourBars hourly={r.hourly} /></div>
          <div className="mt-1 flex justify-between text-[10px] text-stone-400"><span>−24 t</span><span>nå</span></div>
          <table className="mt-4 w-full text-[13px]">
            <thead><tr><Th>Reisemåte</Th><Th right>Andel</Th></tr></thead>
            <tbody>
              {([["walk", "Til fots"], ["bike", "Sykkel"], ["car", "Bil"]] as const).map(([k, label]) => (
                <tr key={k} className="border-t border-stone-100">
                  <td className="py-1.5">{label}</td>
                  <td className="py-1.5 text-right tabular-nums">{modeTotal ? pct(r.travelModes[k] / modeTotal) : "–"}</td>
                </tr>
              ))}
              {r.threeDShare !== null && (
                <tr className="border-t border-stone-100 text-stone-500"><td className="py-1.5">3D-kart aktivt</td><td className="py-1.5 text-right tabular-nums">{pct(r.threeDShare)}</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Rad 2: Kategorier | Signaler */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="Kategorier" right="andel av kategori-åpninger · andre = andre Placy-boards">
          <CategoryTable rows={r.categories} reached={r.threshold.reached} />
        </Card>
        <Card title="Signaler" right={r.threshold.reached ? "regelbasert" : undefined}>
          {recommendations.length === 0 ? (
            <p className="text-[13px] text-stone-400">Ingen signaler over terskel.</p>
          ) : (
            <ul className="space-y-2.5 text-[13px]">
              {recommendations.map((rec) => (
                <li key={rec.id} className="flex gap-2">
                  <span style={{ color: BLUE }}>●</span>
                  <span>
                    {rec.title}
                    <span className="block text-stone-400">{rec.why}</span>
                    {rec.next && <span className="block text-stone-400">→ {rec.next}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Rad 3: Steder | Spørsmål | Kilder */}
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Steder" right="klikk · utforsk">
          {r.pois.length === 0 ? <p className="text-[13px] text-stone-400">Ingen klikk ennå.</p> : (
            <table className="w-full text-[13px]">
              <thead><tr><Th>Sted</Th><Th right>Klikk</Th><Th right>Utf.</Th><Th right>Endr.</Th></tr></thead>
              <tbody>
                {r.pois.map((p) => (
                  <tr key={p.id} className="border-t border-stone-100">
                    <td className="max-w-[170px] py-1.5 pr-2">
                      <div className="truncate">{p.name}</div>
                      <div className="truncate text-[11px] text-stone-400">{p.categoryLabel ?? "—"}</div>
                      <div className="mt-1"><RowBar value={p.clicks + p.explores} max={maxPoi} /></div>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{p.clicks}</td>
                    <td className="py-1.5 text-right tabular-nums text-stone-500">{p.explores}</td>
                    <td className="py-1.5 text-right"><Delta now={p.clicks + p.explores} before={p.prevTotal} small /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Spørsmål" right="åpnet i Q&A">
          {r.faq.length === 0 ? <p className="text-[13px] text-stone-400">Ingen spørsmål åpnet ennå. Måling startet 2. sep. 2026.</p> : (
            <table className="w-full text-[13px]">
              <thead><tr><Th>Spørsmål</Th><Th right>Åpn.</Th><Th right>Endr.</Th></tr></thead>
              <tbody>
                {r.faq.map((f) => (
                  <tr key={f.id} className="border-t border-stone-100">
                    <td className="py-1.5 pr-2">
                      <div className="leading-snug">{f.question}</div>
                      <div className="text-[11px] text-stone-400">{f.categoryLabel ?? "Nabolaget"}</div>
                      <div className="mt-1 max-w-[140px]"><RowBar value={f.opens} max={maxFaq} muted /></div>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{f.opens}</td>
                    <td className="py-1.5 text-right"><Delta now={f.opens} before={f.prevOpens} small /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Kilder" right="?src= i lenken">
          <table className="w-full text-[13px]">
            <thead><tr><Th>Kanal</Th><Th right>Åpn.</Th><Th right>Andel</Th><Th right>Endr.</Th></tr></thead>
            <tbody>
              {r.sources.map((s) => (
                <tr key={s.source} className="border-t border-stone-100">
                  <td className="py-1.5 pr-2">
                    <div>{sourceName(s.source)}</div>
                    <div className="mt-1 max-w-[120px]"><RowBar value={s.views} max={r.views} muted={s.source === "direkte"} /></div>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{s.views}</td>
                  <td className="py-1.5 text-right tabular-nums text-stone-500">{pct(s.share)}</td>
                  <td className="py-1.5 text-right"><Delta now={s.views} before={s.prevViews} small /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <footer className="mt-8 text-[11px] leading-relaxed text-stone-400">
        Anonymt og aggregert — ingen personer, bare hva som åpnes, med hvilken reisemåte og fra hvilken lenke. Endring = mot forrige periode av samme lengde. Oppdateres hvert døgn.
      </footer>
    </main>
  );
}
