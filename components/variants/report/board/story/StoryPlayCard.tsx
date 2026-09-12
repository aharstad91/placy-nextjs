"use client";

import { ChevronRight, Play } from "lucide-react";
import { useStoryTour } from "./story-tour";

/**
 * Inngangen til omvisningen.
 *
 * Tettheten møter deg først — den er beviset, og det er dekningen megleren
 * betaler for. Omvisningen er veien inn for den som IKKE selv begynner å zoome
 * og trykke, og den ligger derfor over indeksen, ikke i stedet for den.
 *
 * Undertittelen sier hvor mange stopp, ikke hvor lang tid: en omvisning uten
 * lyd tar den tiden leseren gir den.
 *
 * ## «Meglerens utvalg» gjelder ikke alle boards (2026-09-11)
 *
 * Undertittelen navnga megleren fordi det er megleren som har valgt stedene på
 * en boligrapport, og fordi utvalget er noe et MENNESKE har gjort — det er hele
 * forskjellen fra en maskinsortert liste.
 *
 * Men boardet brukes nå også på flater uten megler: et områdekart for en
 * utbygger, en butikkatalog, et strøkskart. Der er ordet direkte usant, og det
 * er en sjelden slags feil — en påstand om HVEM som står bak innholdet.
 * Nyhavna-demoen viste den: «10 stopp · meglerens utvalg» på et board eid av
 * Nyhavna Utvikling, uten en megler i bildet.
 *
 * Avsenderen leses derfor av dataene: bærer stoppene en kilde
 * (`editorial.source` — kundens egen tekst og utvalg), navngis kilden. Ellers
 * står megleren, som før.
 *
 * Et board UTEN megler og UTEN kilde står fortsatt med «meglerens utvalg». Det
 * er en kjent rest, ikke en forglemmelse: den krever et eget avsender-begrep på
 * boardet, og det hører i en produktrunde — ikke i en demo-gren.
 */
export function StoryPlayCard() {
  const { available, stops, begin } = useStoryTour();
  if (!available) return null;

  // Første kilde blant stoppene. Flere kilder på ett board har vi ikke; oppstår
  // det, er «kuratert utvalg» et ærligere svar enn å navngi én av dem.
  const sources = new Set(
    stops
      .map((s) => s.editorial?.source?.label)
      .filter((l): l is string => Boolean(l)),
  );
  const attribution =
    sources.size === 1
      ? `utvalg fra ${[...sources][0]}`
      : sources.size > 1
        ? "kuratert utvalg"
        : "meglerens utvalg";

  return (
    <button
      type="button"
      data-testid="story-play"
      /* Uten wrapper hadde klikk-eventet blitt sendt inn som `at` (begin tar nå
         et start-stopp — desktop-kolonnen begynner på området). */
      onClick={() => begin()}
      className="mb-2.5 flex w-full shrink-0 items-center gap-3 rounded-2xl bg-stone-900 px-3 py-[11px] text-left text-white transition-opacity duration-150 hover:opacity-95"
    >
      <span
        aria-hidden
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/[0.14]"
      >
        <Play size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold tracking-[-0.01em]">
          La nabolaget presentere seg
        </span>
        <span className="block text-[12px] text-white/60">
          {stops.length} stopp · {attribution}
        </span>
      </span>
      <ChevronRight size={18} aria-hidden className="shrink-0 opacity-50" />
    </button>
  );
}
