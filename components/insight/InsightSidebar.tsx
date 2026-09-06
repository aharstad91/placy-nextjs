// Sidepanelet: innsikt som et GRENSESNITT, ikke som et dokument.
//
// Den festede topplinjen løste at raden forsvant når man scrollet, men den
// løste det ved å legge navigasjonen oppå lesingen: en vannrett rad må rulle
// sidelengs for å romme seks temaer, og den kan ikke vise annet enn navnene.
// Loddrett har hvert tema en hel linje — navn, andel og status samtidig — og
// alle er synlige på én gang uten å ta plass fra teksten. Panelet er også det
// eneste stedet en portefølje-velger kan bo uten å konkurrere med tittelen.
//
// Panelet er DESKTOP. På mobil finnes ikke bredden, og der beholder
// `InsightShell` den festede topplinjen med den vannrette raden. To flater for
// samme navigasjon er riktig her: mønstrene divergerer, og en sammenklappet
// sidebar på 390 px er en meny som gjemmer seg.

"use client";

import Link from "next/link";
import { Home } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";
import { cn } from "@/lib/utils";
import type { CategoryInsight } from "@/lib/insight/types";
import { themeStatus, THEME_STATUS_LABEL } from "@/lib/insight/recommendations";
import type { InsightCustomer, InsightSwitcherOption } from "@/lib/insight/projects";
import { InsightProjectSwitcher } from "./InsightProjectSwitcher";
import { useActiveThemeId } from "./InsightRail";
import { fmtDay, pct } from "./insight-parts";

export function InsightSidebar({
  projectName, customer, switcher, demo, since, until, days,
  basePath, query, themes, reached,
}: {
  projectName: string;
  customer: InsightCustomer | null;
  switcher: InsightSwitcherOption[];
  demo: boolean;
  since: string;
  until: string;
  days: number;
  basePath: string;
  query: string;
  themes: CategoryInsight[];
  reached: boolean;
}) {
  /* Se InsightRail: ruta forteller hvor vi er, så panelet slipper å bygges om. */
  const activeId = useActiveThemeId();
  return (
    <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col border-r border-black/[0.07] bg-[#efece6] lg:flex">
      <div className="px-3.5 pb-3 pt-4">
        <div className="px-0.5 pb-2 text-[11px] uppercase tracking-[0.16em] text-stone-400">Placy · Innsikt</div>
        <InsightProjectSwitcher customer={customer} projectName={projectName} options={switcher} />
      </div>

      <nav aria-label="Innsikt" className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
        <NavItem href={`${basePath}${query}`} label="Oversikt" active={activeId === null} icon={<IconDot color="#1c1917"><Home size={13} strokeWidth={2.5} /></IconDot>} />

        <p className="px-3 pb-1.5 pt-4 text-[11px] uppercase tracking-[0.12em] text-stone-400">Temaer</p>
        <ul className="space-y-0.5">
          {themes.map((c) => {
            const Icon = getIcon(c.icon ?? "MapPin");
            const status = themeStatus(c, reached);
            return (
              <li key={c.id}>
                <NavItem
                  href={`${basePath}/${c.id}${query}`}
                  label={c.label}
                  active={activeId === c.id}
                  icon={<IconDot color={c.color ?? "#78716c"}><Icon size={12} strokeWidth={2} /></IconDot>}
                  meta={reached ? pct(c.share) : `${c.opens}`}
                  note={status === "som-ventet" ? undefined : THEME_STATUS_LABEL[status]}
                  noteTone={status}
                />
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-black/[0.06] px-3.5 py-3 text-[11.5px] text-stone-500">
        {demo && <span className="mb-1.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">Demodata</span>}
        <div className="text-stone-600">{fmtDay(since)} – {fmtDay(until)}</div>
        <div className="text-stone-400">Siste {days} dager · oppdateres hvert døgn</div>
      </div>
    </aside>
  );
}

function IconDot({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: color }} aria-hidden>
      {children}
    </span>
  );
}

const NOTE_TONE: Record<string, string> = {
  trekker: "text-emerald-700",
  "lite-brukt": "text-amber-700",
  "for-tidlig": "text-stone-400",
};

function NavItem({ href, label, active, icon, meta, note, noteTone }: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
  meta?: string;
  note?: string;
  noteTone?: string;
}) {
  return (
    <Link
      href={href}
      /* Temaene er sider, ikke faner, og sidene er `force-dynamic` — da
         prefetcher Next dem ikke av seg selv, og hvert bytte ble en synlig
         lasting selv om alle temaene viser tall fra SAMME rapport. `prefetch`
         henter payloaden når lenken er synlig; sammen med rapport-cachen i
         `load-report.ts` er byttet umiddelbart. Sju sider er en billig
         forhåndshenting: de deler cache-oppslag på serveren. */
      prefetch
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-3 py-2 transition-colors",
        active ? "bg-white text-stone-900 shadow-[0_1px_3px_rgba(28,25,23,0.08)] ring-1 ring-black/[0.06]" : "text-stone-600 hover:bg-black/[0.035]",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[13.5px] leading-tight", active ? "font-semibold" : "font-medium")}>{label}</span>
        {note && <span className={cn("block text-[11px] leading-tight", NOTE_TONE[noteTone ?? ""] ?? "text-stone-400")}>{note}</span>}
      </span>
      {meta && <span className="shrink-0 text-[12px] tabular-nums text-stone-400">{meta}</span>}
    </Link>
  );
}
