"use client";

import { useMemo, type ComponentProps } from "react";
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
 * ## Hvorfor ingen megler, men brand-assets
 *
 * Nyhavna-porten legger på en eksempelmegler. Den hører ikke hjemme her:
 * Leangenbukta har ingen navngitt kontaktperson i det kildekontrollerte
 * materialet, og en demo som starter tom skal ikke starte med en person som
 * ikke finnes. Adapterens `hideBrokerCard: true` blir derfor stående.
 *
 * `assets.brand` slås på fordi de tre filene finnes
 * (`public/illustrations/leangenbukta-lokal-{logo.svg,splash.jpg,splash-video.mp4}`,
 * hentet fra utbyggerens egen nettside via nettsidekopien). Det gir logoen over
 * velkomstteksten og hero-filmen i høyre panel — uten flagget viser splashen
 * bare tekst-ordmerke, og mobil-splashen får svart bakgrunn.
 *
 * Ingen `?embed`/`?from`/`?src`: demoen er lokal og deles ikke som lenke.
 */
export default function LokalBoardGate({ project, boardData }: Props) {
  const brandedBoard = useMemo(
    () => (boardData ? { ...boardData, assets: { ...boardData.assets, brand: true } } : boardData),
    [boardData],
  );
  return <ReportReelsPage project={project} boardData={brandedBoard} boardMode="report" layout="framed" placePanel />;
}
