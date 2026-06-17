"use client";

import { useEffect, useRef } from "react";
import { useAudioElement } from "../board/audio-tour/use-audio-element";
import { useAudioTourStore } from "@/lib/stores/audio-tour-store";

/**
 * Spotify-stil 0–100 %-fremdriftslinje for det AKTIVE kapittelet — en tynn, lys
 * «border bottom» i mobil-transporten. Resettes per kapittel (kategori = sang).
 *
 * Deler ekstrapolerings-maskineriet med den gamle thumbnail-railen: `<audio>`
 * sender bare ~4 Hz `timeupdate`, så vi EKSTRAPOLERER posisjonen mellom samplene
 * via wall-clock og skyver et fyll IMPERATIVT med `transform: scaleX` (GPU-
 * komposittert, sub-piksel → jevn 0→1 uten 60 fps re-render). Monoton guard på
 * samme spor hindrer at fyllet hopper bakover på spor-sluttens «pust»
 * (`currentTime → 0` før `trackIndex` avanserer); nytt spor nullstiller.
 */
export function ChapterProgressBar() {
  const { currentTime, duration } = useAudioElement();
  const trackIndex = useAudioTourStore((s) => s.trackIndex);
  const tracks = useAudioTourStore((s) => s.tracks);
  const phase = useAudioTourStore((s) => s.phase);

  // Ferske verdier til rAF-loopen uten å re-binde den hver render.
  const stateRef = useRef({ trackIndex, tracks, phase, duration });
  stateRef.current = { trackIndex, tracks, phase, duration };

  // Ekstrapolerings-anker: siste kjente (currentTime, wall-clock). Re-ankres ved
  // hvert nytt sample + ved spor-/fase-skifte.
  const anchorRef = useRef({ ct: 0, wall: 0 });
  useEffect(() => {
    anchorRef.current = { ct: currentTime, wall: performance.now() };
  }, [currentTime, trackIndex, phase]);

  const fillRef = useRef<HTMLSpanElement | null>(null);
  const heldRef = useRef({ trackIndex: -1, within: 0 });

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const { trackIndex, tracks, phase, duration } = stateRef.current;
      const curDur = (tracks[trackIndex]?.durationSec ?? 0) || duration || 0;
      let estCt = anchorRef.current.ct;
      if (phase === "playing" && anchorRef.current.wall > 0) {
        estCt += (performance.now() - anchorRef.current.wall) / 1000;
      }
      let within =
        phase === "ended"
          ? 1
          : curDur > 0
            ? Math.min(1, Math.max(0, estCt / curDur))
            : 0;

      // Monoton guard på samme spor; nytt spor nullstiller (within følger fresh).
      const held = heldRef.current;
      if (trackIndex === held.trackIndex) {
        if (within < held.within) within = held.within;
      } else {
        held.trackIndex = trackIndex;
      }
      held.within = within;

      if (fillRef.current) {
        fillRef.current.style.transform = `scaleX(${within})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (tracks.length === 0) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/15">
      <span
        ref={fillRef}
        aria-hidden
        className="absolute inset-0 origin-left bg-white/80 will-change-transform"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
