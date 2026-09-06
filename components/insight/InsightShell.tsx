// Rammen rundt innsiktssidene. To flater for samme navigasjon, fordi de to
// skjermene ikke har samme problem:
//
//   DESKTOP — `InsightSidebar` i venstre kant. Loddrett rommer den hvert temas
//   navn, andel og status samtidig, og den er alltid hel: ingen sidelengs
//   rulling for å nå det sjette temaet. Portefølje-velgeren bor der.
//
//   MOBIL — festet topplinje med den vannrette raden fra boardet, og
//   prosjekt-velgeren i tittelens plass. Et sidepanel på 390 px ville vært en
//   meny som gjemmer seg bak en knapp.
//
// Innholdet holder sin egen smale lesekolonne inne i den brede flaten: tekst
// leses best smalt, uansett hvor mye plass panelet lar bli igjen.
//
// ## Rammen bor i en LAYOUT, ikke i sidene
//
// Da den lå i sidene, ble hele treet — panel, velger, fane-rad — revet ned og
// bygd opp igjen ved hvert temabytte, fordi oversikten og temasidene er ulike
// ruter. Det så ut som at hele siden lastet på nytt, selv når byttet tok under
// 150 ms og ikke rørte nettverket. Som layout står rammen stille og bare
// `children` byttes. Derfor tar navigasjonen heller ikke imot «hvor er vi» som
// prop lenger: den leser det av ruta selv.

import type { ReactNode } from "react";
import type { CategoryInsight } from "@/lib/insight/types";
import type { InsightCustomer, InsightSwitcherOption } from "@/lib/insight/projects";
import { InsightRail } from "./InsightRail";
import { InsightSidebar } from "./InsightSidebar";
import { InsightContent } from "./InsightContent";
import { InsightProjectSwitcher } from "./InsightProjectSwitcher";
import { fmtDay, InsightFooter } from "./insight-parts";

export function InsightShell({
  projectName, customer, switcher, demo, since, until, days,
  basePath, query, themes, reached, children,
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
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#f4f2ee] text-stone-900">
      <InsightSidebar
        projectName={projectName}
        customer={customer}
        switcher={switcher}
        demo={demo}
        since={since}
        until={until}
        days={days}
        basePath={basePath}
        query={query}
        themes={themes}
        reached={reached}
      />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-[#f4f2ee]/85 px-4 pb-2.5 pt-3 backdrop-blur-md [backdrop-filter:blur(12px)_saturate(1.4)] lg:hidden">
          <div className="flex items-center gap-2">
            <InsightProjectSwitcher customer={customer} projectName={projectName} options={switcher} className="min-w-0 flex-1" />
            <span className="shrink-0 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[11.5px] text-stone-600 ring-1 ring-black/5">
              {fmtDay(since)} – {fmtDay(until)}
            </span>
          </div>
          {demo && (
            <span className="mt-2 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[11.5px] font-medium text-amber-900">Demodata</span>
          )}
          <div className="mt-2.5">
            <InsightRail basePath={basePath} query={query} themes={themes} />
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 pb-20 pt-6 lg:px-8 lg:pt-9">
          <InsightContent>{children}</InsightContent>
          <InsightFooter days={days} />
        </main>
      </div>
    </div>
  );
}
