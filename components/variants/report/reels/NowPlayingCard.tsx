"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AudioLines, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReels } from "./reels-state";
import { nowPlayingView } from "./reels-data";

/**
 * "Spiller nå"-kort i mobil-transporten — nå transportens primær-element (triaden
 * ⏮▶⏭ er fjernet; navigasjon skjer via vertikal swipe på reel-flaten + dette
 * kortets kapittelvelger). Tre lag:
 *  - Poster + tittel + meta-linje (hva spilles, hvor i løypa).
 *  - Odometer-rull: når aktivt kapittel skifter ruller tittel/meta ett hakk
 *    (opp = fremover, ned = bakover) — samme teller-følelse brukeren kjenner.
 *  - Tappbar kapittelvelger: bordet kort i samme høyde som ⋯-knappen + ⌄ ytterst
 *    gir en klikkbar «velger»-look; popover (opp fra kortet, samme mønster som
 *    ⋯-menyen) lister alle kategorier med den aktive markert, og tapp hopper dit
 *    (setActiveIndex → orchestration → goToTrack).
 *
 * (Posteren bruker `unoptimized` — statiske 44px-JPG-er, ingen optimizer-gevinst.)
 */
export function NowPlayingCard() {
  const { state, setActiveIndex } = useReels();
  const { title, meta, image } = nowPlayingView(state.cards, state.activeIndex);
  const [open, setOpen] = useState(false);

  // Kategoriene (med original cardIndex) for kapittelvelgeren. Kun kategori-kort
  // er hopp-bare her — velkommen/nabolaget/oppsummert er kart-primære beats som
  // touren auto-advancer gjennom.
  const categoryItems = useMemo(() => {
    const out: { index: number; label: string; count: number; color: string }[] =
      [];
    state.cards.forEach((c, i) => {
      if (c.kind === "category") {
        out.push({ index: i, label: c.label, count: c.pois.length, color: c.color });
      }
    });
    return out;
  }, [state.cards]);
  const hasPicker = categoryItems.length > 0;

  // Odometer-rull: tick remounter tekst-blokken (replay av CSS-animasjonen),
  // dir velger retning. Oppdateres KUN når aktivt kort faktisk skifter, så
  // mellomliggende re-rendere ikke re-trigger animasjonen.
  const [roll, setRoll] = useState<{ tick: number; dir: 1 | -1 }>({
    tick: 0,
    dir: 1,
  });
  const prevIndexRef = useRef(state.activeIndex);
  useEffect(() => {
    const prev = prevIndexRef.current;
    if (state.activeIndex === prev) return;
    setRoll((r) => ({ tick: r.tick + 1, dir: state.activeIndex > prev ? 1 : -1 }));
    prevIndexRef.current = state.activeIndex;
  }, [state.activeIndex]);

  // Escape lukker (speiler ReelsMenu). Klikk-utenfor håndteres av et backdrop
  // (under), ikke en document-listener, så lukke-tappet ikke faller gjennom til
  // reel-flaten (= utilsiktet pause).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Tekst-blokken (tittel + meta) — felles for picker- og static-varianten.
  // `key={roll.tick}` tvinger remount ved kapittel-skifte så rull-animasjonen
  // spilles på nytt; tick 0 (første mount) får ingen animasjon.
  const rollingText = (
    <div className="min-w-0 flex-1 overflow-hidden leading-tight">
      <div
        key={roll.tick}
        className={cn(
          roll.tick > 0 &&
            (roll.dir === 1
              ? "animate-nowplaying-roll-up"
              : "animate-nowplaying-roll-down"),
        )}
      >
        <p className="truncate text-sm font-semibold text-white">{title}</p>
        {meta && <p className="mt-0.5 truncate text-xs text-white/55">{meta}</p>}
      </div>
    </div>
  );

  const poster = (
    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-stone-700">
      {image && (
        <Image
          src={image}
          alt=""
          fill
          sizes="36px"
          unoptimized
          className="object-cover"
        />
      )}
    </div>
  );

  // Uten kategori-kort (rapport uten kategori-lyd) er det ingenting å hoppe til
  // → fall tilbake til et ikke-interaktivt now-playing-kort (rullen beholdes).
  if (!hasPicker) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {poster}
        {rollingText}
      </div>
    );
  }

  return (
    <div className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Velg kapittel"
        className="flex h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-white/15 bg-white/5 pl-1 pr-2 text-left active:bg-white/10"
      >
        {poster}
        {rollingText}
        {/* Affordance: ⌄ ytterst. Kort-rammen (samme høyde som ⋯-knappen) bærer nå
            den klikkbare looken, så chevronen står ren (ingen egen boks) og
            roterer 180° når velgeren er åpen. */}
        <ChevronUp
          size={18}
          className={cn(
            "shrink-0 text-white/55 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <button
          type="button"
          aria-label="Lukk kapittelvelger"
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 cursor-default"
        />
      )}

      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-50 mb-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-white/10 bg-stone-900/95 shadow-2xl backdrop-blur-sm"
        >
          <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40">
            Kategorier
          </p>
          <div className="max-h-[50vh] overflow-y-auto pb-1">
            {categoryItems.map((it) => {
              const isPlaying = it.index === state.activeIndex;
              return (
                <button
                  key={it.index}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setActiveIndex(it.index);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-white/10",
                    isPlaying && "bg-white/10",
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: it.color }}
                  />
                  <span
                    className={cn(
                      "flex-1 truncate text-sm",
                      isPlaying
                        ? "font-semibold text-white"
                        : "font-medium text-white/85",
                    )}
                  >
                    {it.label}
                  </span>
                  {isPlaying ? (
                    <AudioLines size={16} className="shrink-0 text-white/80" />
                  ) : (
                    <span className="shrink-0 text-xs text-white/40">
                      {it.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
