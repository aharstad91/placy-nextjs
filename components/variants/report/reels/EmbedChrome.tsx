"use client";

import { useEffect, useState } from "react";
import { Maximize2, Hand } from "lucide-react";

/**
 * Embed-chrome (Unit 4, R12/R13): overlegg som rendres KUN i embed-modus, oppå
 * det fulle boardet. To ansvar:
 *
 *  1. Fullskjerm-knapp (alltid synlig) → åpner standalone board-URL i ny fane
 *     (samme side uten `?embed`, med `?src` bevart så kanal-attribusjonen følger).
 *
 *  2. Aktiveringsgate (R13): en gjennomsiktig flate oppå boardet med
 *     `touch-action: pan-y`. FØR brukeren trykker fanger den touch/scroll slik at
 *     kartet under IKKE kaprer vertsidens scroll — kjøperen kan scrolle forbi
 *     iframen (mobil: pan-y ruller vertsiden; desktop: wheel bobler til foreldre).
 *     Ett trykk fjerner gaten → kartet blir interaktivt (bevisst engasjement).
 *
 * Standard «click-to-activate»-mønster for kart i iframe. Kontor-boardene
 * (ikke-embed) er uendret — komponenten rendres kun når embed=true.
 * Den definitive mobil-scroll-yielden verifiseres på ekte telefon (Unit 6).
 */

export default function EmbedChrome() {
  const [activated, setActivated] = useState(false);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("embed");
    url.searchParams.delete("from");
    setFullscreenUrl(url.toString());
  }, []);

  return (
    <>
      {fullscreenUrl && (
        <a
          href={fullscreenUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed right-3 top-3 z-[60] inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-2 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/85"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Åpne i fullskjerm
        </a>
      )}

      {!activated && (
        <button
          type="button"
          onClick={() => setActivated(true)}
          aria-label="Trykk for å utforske nabolaget"
          className="fixed inset-0 z-[50] flex items-end justify-center bg-transparent pb-8"
          style={{ touchAction: "pan-y" }}
        >
          <span className="pointer-events-none inline-flex items-center gap-1.5 rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white backdrop-blur">
            <Hand className="h-4 w-4" />
            Trykk for å utforske nabolaget
          </span>
        </button>
      )}
    </>
  );
}
