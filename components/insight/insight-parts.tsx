// Felles byggesteiner for innsiktssidene (oversikt + tema). Rene
// server-komponenter: ingen tilstand, ingen effekter.

import Link from "next/link";
import { ArrowRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { DailyPoint } from "@/lib/insight/types";
import { growth, type Recommendation } from "@/lib/insight/recommendations";

export const pct = (x: number) => `${Math.round(x * 100)} %`;
export const nb = new Intl.NumberFormat("nb-NO");
export const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", timeZone: "Europe/Oslo" }).format(new Date(iso));

export function Trend({ now, before, className = "" }: { now: number; before: number; className?: string }) {
  const g = growth(now, before);
  if (g === null) {
    return <span className={`inline-flex items-center gap-1 text-stone-400 ${className}`}><Minus size={13} aria-hidden /> ny</span>;
  }
  const Icon = g >= 0 ? TrendingUp : TrendingDown;
  const tone = Math.abs(g) < 0.05 ? "text-stone-500" : g > 0 ? "text-emerald-700" : "text-rose-700";
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${tone} ${className}`}>
      <Icon size={13} aria-hidden /> {Math.abs(Math.round(g * 100))} %
    </span>
  );
}

export function Sparkline({ points, color = "#1c1917", pick = (d) => d.views }: {
  points: DailyPoint[]; color?: string; pick?: (d: DailyPoint) => number;
}) {
  const W = 320, H = 48, P = 2;
  const n = Math.max(points.length, 2);
  const max = Math.max(1, ...points.map(pick));
  const x = (i: number) => P + (i / (n - 1)) * (W - 2 * P);
  const y = (v: number) => P + (1 - v / max) * (H - 2 * P);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(" ");
  const area = `${d} L${x(points.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-12 w-full" role="img" aria-label="Per dag">
      <path d={area} fill={color} opacity={0.08} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}

export function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-stone-100">
      <div
        className="h-1.5 rounded-full"
        style={{ width: `${max > 0 ? Math.max(value > 0 ? 3 : 0, (value / max) * 100) : 0}%`, background: color }}
      />
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[15px] font-semibold tracking-tight text-stone-900">{children}</h2>
      {sub && <span className="text-right text-[12px] text-stone-500">{sub}</span>}
    </div>
  );
}

export function RecommendationCard({ rec, color, themeHref }: { rec: Recommendation; color?: string; themeHref?: string }) {
  return (
    <li className="rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5">
      <div className="flex items-center gap-2 text-[12px] text-stone-500">
        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: rec.themeId ? (color ?? "#a8a29e") : "#1c1917" }} aria-hidden />
        <span>{rec.themeLabel ?? "Hele nabolaget"}</span>
      </div>
      <h3 className="mt-1.5 text-[15px] font-semibold leading-snug tracking-tight text-stone-900">{rec.title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-stone-700">{rec.why}</p>
      {rec.next && <p className="mt-1.5 text-[13.5px] leading-relaxed text-stone-500">{rec.next}</p>}
      {themeHref && (
        <Link href={themeHref} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-stone-900 underline-offset-2 hover:underline">
          Se tallene for temaet <ArrowRight size={14} aria-hidden />
        </Link>
      )}
    </li>
  );
}

export function InsightFooter({ days }: { days: number }) {
  return (
    <footer className="mt-10 text-[11.5px] leading-relaxed text-stone-400">
      Anonymt og aggregert: ingen personer, bare hva som åpnes, med hvilken reisemåte og fra hvilken lenke. «Forrige periode» er de {days} dagene før. Oppdateres hvert døgn.
    </footer>
  );
}
