"use client";

import { useMemo, type ComponentProps } from "react";
import ReportReelsPage from "@/components/variants/report/reels/ReportReelsPage";

type Props = Pick<ComponentProps<typeof ReportReelsPage>, "project" | "boardData">;

/**
 * Klient-grensen for den lokale demoen.
 *
 * `boardMode="report"` er poenget her: `ReportReelsPage` utleder ellers
 * EVENT-modus av at `boardData` kommer inn som prop (event-ruta var lenge den
 * eneste som bygde BoardData selv). Dette er et bolig-board, og skal ha
 * bolig-skallet — ikke programfilter og samlings-skuff.
 *
 * `layout="framed"`: kolonnen inntil venstre kant, kartet som innrammet modul
 * i Nyhavnas kremfarge (2026-09-14). Rammen gir plass til et topplinje-felt
 * senere uten å endre kartets matte.
 *
 * `placePanel`: på desktop åpner alle steder ETT felles detaljpanel over
 * kolonnen — ingen kartpopup, ingen stedsfane, ingen utfolding i raden
 * (2026-09-15). Kartet og Anja er hovedinngangene; «Verdt å merke seg» består.
 * Mobil er uendret. Policyen sendes herfra og ikke fra en slug-sjekk, så andre
 * boards beholder flyten sin.
 *
 * Ingen `?embed`/`?from`/`?src` her: demoen er lokal og deles ikke som lenke,
 * og uten dem slipper ruta `useSearchParams`.
 */
export default function LokalBoardGate({ project, boardData }: Props) {
  const brandedBoard = useMemo(() => boardData ? {
    ...boardData,
    assets: { ...boardData.assets, brand: true },
    brokers: [{
      name: "Kari Hansen",
      title: "Kontaktperson",
      officeName: "Nyhavna · eksempel",
      phone: "+47 00 00 00 00",
      email: "kari@nyhavna.example",
      photoUrl: "/demo/nyhavna-nettside/contact-example.svg",
    }],
  } : boardData, [boardData]);
  const brandedProject = useMemo(() => ({
    ...project,
    reportConfig: { ...project.reportConfig, hideBrokerCard: false },
  }), [project]);
  return <ReportReelsPage project={brandedProject} boardData={brandedBoard} boardMode="report" layout="framed" placePanel />;
}
