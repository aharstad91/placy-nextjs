"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Innholdskolonnens egen inn-toning.
 *
 * Overgangen som ligger over hele `/eiendom`-treet tok RAMMEN med seg —
 * sidepanel, prosjekt-velger og fane-rad tonet ut og inn sammen med teksten,
 * og da så hvert temabytte ut som at siden lastet på nytt. Rammen er koblet av
 * den overgangen (se PageTransition), og toningen ligger i stedet her, rundt
 * det som faktisk endrer seg.
 *
 * Nøkkelen er ruta: bytter segmentet, monteres denne div-en på nytt, og
 * animasjonen starter av seg selv. Uten nøkkelen ville wrapperen overlevd
 * navigasjonen — den bor jo i layouten — og aldri animert igjen.
 */
export function InsightContent({ children }: { children: ReactNode }) {
  const segment = useSelectedLayoutSegment() ?? "oversikt";
  return (
    <div key={segment} className="insight-content-in">
      {children}
    </div>
  );
}
