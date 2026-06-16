"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAudioElement } from "../board/audio-tour/use-audio-element";
import { useAudioTourStore } from "@/lib/stores/audio-tour-store";

/**
 * Sammenhengende fremdrifts-strek for HELE reelen, drevet av faktisk
 * avspillingstid — som en låt på Spotify. Track-lengdene (durationSec, avledet
 * synkront fra karaoke-timings) summeres til reelens totale lengde; baren fyller
 * (sum av spilte spor + tid i aktivt spor) / total, så den kryper jevnt på tvers
 * av alle kapitler i konstant sann-tids-fart. Mangler noen lengder faller vi
 * tilbake til like store segment per kapittel (fortsatt sømløst).
 *
 * STEG-MARKØRER: baren leses som ÉN 100 %-strek, men tynne (1,5px) vertikale
 * «notch»-streker i footer-fargen kutter den ved hver kategori-grense — en subtil
 * antydning om at løpet er kategori-inndelt, uten å splitte baren i separate
 * seksjoner. Grensene ligger på samme lengde-vektede punkter som fyllet bruker
 * (kumulativ andel av total varighet), så strek og fyll alltid flukter.
 *
 * SØMLØSHET (60 fps): <audio> sender bare `timeupdate` ~4 Hz (hver 250 ms), så å
 * binde bredden rett til `currentTime` gir 250 ms-steg. I stedet kjører en rAF-
 * loop som EKSTRAPOLERER posisjonen mellom samplene via wall-clock (estCt =
 * sist kjente currentTime + tid gått siden). Bredden settes IMPERATIVT på fill-
 * elementet — React har ingen width i JSX, så 4 Hz re-render rører den aldri og
 * vi slipper å re-rendre per frame. Hvert ekte timeupdate re-ankrer estimatet
 * (ingen drift); overshoot klampes til sporets lengde.
 *
 * Track-boundary: når et spor slutter holder desktop et lite "pust" der audio er
 * pauset og currentTime = 0 FØR trackIndex avanserer. Det ville gitt et synlig
 * tilbakehopp til kapittel-start; `heldRef` demper det ved å aldri la baren falle
 * så lenge vi står på (eller avanserer forbi) samme spor. Ekte tilbake-navigasjon
 * (klikk på tidligere kapittel → lavere trackIndex, eller re-start) slipper gjennom.
 *
 * GJENBRUK (mobil): identisk fyll/notch-rendering på tvers av desktop-sidebar og
 * mobil-transport. Uten props er output byte-identisk med desktop. Sendes
 * `onSeekToChapter` (mobil-transport) legges et tappbart hit-zone-lag over baren
 * — ett segment per kapittel — som kaller tilbake med kapittel-indeksen (R5).
 */
export function StoryProgressBar({
  onSeekToChapter,
}: {
  /** Mobil-transport (R5): tapp et segment → hopp til kapittelet (audio-spor-
   *  indeks). Utelatt på desktop → ingen hit-zones, byte-identisk fyll/notch. */
  onSeekToChapter?: (chapterIndex: number) => void;
} = {}) {
  const { currentTime, duration } = useAudioElement();
  const trackIndex = useAudioTourStore((s) => s.trackIndex);
  const tracks = useAudioTourStore((s) => s.tracks);
  const phase = useAudioTourStore((s) => s.phase);

  // Ferske verdier til rAF-loopen (bundet én gang) uten å re-binde hver render.
  const stateRef = useRef({ trackIndex, tracks, phase, duration });
  stateRef.current = { trackIndex, tracks, phase, duration };

  // Anker for ekstrapolering: siste kjente (currentTime, wall-clock). Re-ankres
  // ved hvert nytt sample + ved spor-/fase-skifte.
  const anchorRef = useRef({ ct: 0, wall: 0 });
  useEffect(() => {
    anchorRef.current = { ct: currentTime, wall: performance.now() };
  }, [currentTime, trackIndex, phase]);

  const heldRef = useRef({ trackIndex: -1, pct: 0 });
  const fillRef = useRef<HTMLDivElement | null>(null);
  // Sett 0% i commit (callback-ref kjører før paint) → ingen full-bredde-blink
  // før første rAF-frame. React styrer ikke bredden videre (ingen width i JSX).
  const setFill = useCallback((el: HTMLDivElement | null) => {
    fillRef.current = el;
    if (el) el.style.width = "0%";
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const { trackIndex, tracks, phase, duration } = stateRef.current;
      const durs = tracks.map((t) => t.durationSec ?? 0);
      const curDur = durs[trackIndex] || duration || 0;
      // Estimert tid i aktivt spor: sist kjente currentTime + tid gått (kun mens
      // vi spiller). Klampes til sporets lengde så vi ikke overshooter.
      let estCt = anchorRef.current.ct;
      if (phase === "playing" && anchorRef.current.wall > 0) {
        estCt += (performance.now() - anchorRef.current.wall) / 1000;
      }
      const within = curDur > 0 ? Math.min(1, Math.max(0, estCt / curDur)) : 0;

      let pct = 0;
      if (phase === "ended") {
        pct = 100;
      } else if (tracks.length > 0) {
        if (durs.every((d) => d > 0)) {
          // Sann-tids-vekting: bar-posisjon = forløpt tid / total tid.
          const total = durs.reduce((s, d) => s + d, 0);
          const before = durs.slice(0, trackIndex).reduce((s, d) => s + d, 0);
          pct = Math.min(100, ((before + within * durs[trackIndex]) / total) * 100);
        } else {
          // Fallback: like store segment per kapittel når lengder mangler.
          pct = Math.min(100, ((trackIndex + within) / tracks.length) * 100);
        }
      }

      // Monoton guard mot track-boundary-tilbakehoppet (se komponent-doc).
      const held = heldRef.current;
      if (trackIndex >= held.trackIndex && pct < held.pct) pct = held.pct;
      heldRef.current = { trackIndex, pct };

      if (fillRef.current) fillRef.current.style.width = `${pct}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Kategori-grenser som andel (0–1) av total — samme lengde-vekting som fyllet,
  // så notch-strekene flukter med der baren faktisk skifter kapittel. Beregnes i
  // render (billig). Hopper over 0 % og 100 % (kantene runder uansett av).
  const durs = tracks.map((t) => t.durationSec ?? 0);
  const weighted = durs.length > 1 && durs.every((d) => d > 0);
  const total = durs.reduce((s, d) => s + d, 0);
  const boundaries: number[] = [];
  if (tracks.length > 1) {
    let acc = 0;
    for (let i = 0; i < tracks.length - 1; i++) {
      acc += weighted ? durs[i] : 1;
      boundaries.push(weighted ? acc / total : (i + 1) / tracks.length);
    }
  }

  // Mobil-transport (R5): tappbare segment-soner over baren. Hvert kapittel k
  // spenner [start, end) der grensene gjenbrukes fra `boundaries`. Laget er
  // høyere enn den 1,5px tynne baren (-inset-y-3) så touch-målet er ~komfortabelt;
  // selve baren er for tynn å treffe direkte på mobil.
  const showSeek = !!onSeekToChapter && tracks.length > 0;

  return (
    <div className={showSeek ? "relative px-3 pt-3" : "px-3 pt-3"}>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div ref={setFill} className="h-full rounded-full bg-white/90" />
        {/* Subtile steg-streker ved hver kategori-grense (footer-fargen kutter
            baren med en 1,5px notch). Ligger oppå fyllet så de vises både på
            spilt og uspilt del. */}
        {boundaries.map((frac, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute inset-y-0 w-[1.5px] bg-[#1a1510]"
            style={{ left: `${frac * 100}%` }}
          />
        ))}
      </div>
      {showSeek && (
        <div className="absolute inset-x-3 -inset-y-3 flex">
          {Array.from({ length: tracks.length }, (_, k) => {
            const start = k === 0 ? 0 : boundaries[k - 1] ?? k / tracks.length;
            const end =
              k === tracks.length - 1 ? 1 : boundaries[k] ?? (k + 1) / tracks.length;
            const widthPct = Math.max(0, (end - start) * 100);
            return (
              <button
                key={k}
                type="button"
                aria-label={`Hopp til kapittel ${k + 1} av ${tracks.length}`}
                onClick={() => onSeekToChapter?.(k)}
                className="h-full"
                style={{ width: `${widthPct}%` }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
