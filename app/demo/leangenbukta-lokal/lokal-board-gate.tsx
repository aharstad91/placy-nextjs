"use client";

import type { ComponentProps } from "react";
import ReportReelsPage from "@/components/variants/report/reels/ReportReelsPage";

type Props = Pick<ComponentProps<typeof ReportReelsPage>, "project" | "boardData">;

/**
 * Klient-grensen for den lokale Leangenbukta-demoen (2026-09-18).
 *
 * Samme tre valg som Nyhavna-porten gjør, av samme grunner:
 *
 * `boardMode="report"` — `ReportReelsPage` utleder ellers EVENT-modus av at
 * `boardData` kommer inn som prop. Dette er et bolig-board og skal ha
 * bolig-skallet, ikke programfilter og samlings-skuff.
 *
 * `layout="framed"` — kolonnen inntil venstre kant, kartet som innrammet modul.
 *
 * `placePanel` — på desktop åpner alle steder ETT felles detaljpanel over
 * kolonnen. Mobil er uendret.
 *
 * ## Hvorfor ingen megler og ingen brand-assets
 *
 * Nyhavna-porten legger på en eksempelmegler og `assets.brand`. Ingen av delene
 * hører hjemme her. Megleren ville vært oppdiktet: Leangenbukta har ingen
 * navngitt kontaktperson i det kildekontrollerte materialet, og en demo som
 * starter tom skal ikke starte med en person som ikke finnes. Adapterens
 * `hideBrokerCard: true` blir derfor stående.
 *
 * `assets.brand` ville pekt på `/illustrations/leangenbukta-lokal-logo.svg`,
 * `-splash.jpg` og `-splash-video.mp4` (`lib/themes/project-brand.ts`). De tre
 * filene finnes ikke, og flagget ville bare gitt tre 404-er i stedet for
 * splash-skjermens tekst-wordmark. Merkevaren kommer i stedet fra
 * `leangenbukta-brand.css` og fra logoen i prosjektmarkøren (`pinImage` i
 * `board.json`), som begge virker uten asset-pakken.
 *
 * Ingen `?embed`/`?from`/`?src`: demoen er lokal og deles ikke som lenke.
 */
export default function LokalBoardGate({ project, boardData }: Props) {
  return <ReportReelsPage project={project} boardData={boardData} boardMode="report" layout="framed" placePanel />;
}
