"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAudioTourStore } from "@/lib/stores/audio-tour-store";

/**
 * Delt `<audio>`-element + provider for audio-tour. Mountes ÉN gang (i
 * BoardScaffold) slik at iOS Safari sin "first user gesture unlocks audio"-
 * regel kun trenger å passere én gang for hele touren — bytte av spor
 * gjenbruker samme element via `src`-mutation.
 *
 * Sync-regler:
 * - `phase === "playing"` og `tracks[trackIndex].url` endrer seg → sett src,
 *   `load()` og `play()`. `play()`-promise rejection (autoplay blokkert eller
 *   media-error) trigger `setError()` slik at banner kan vise retry-state.
 * - `phase` blir `paused`/`ended`/`idle`/`error` → `audio.pause()`.
 * - `audio.onended` → `store.next()` (auto-advance til neste track).
 * - `audio.onerror` → `store.setError()`.
 *
 * `currentTime` og `duration` eksponeres via context (oppdateres ~4 Hz via
 * `timeupdate`-event). Kun PlayerBanner forbruker dem, så re-render-flommen
 * holdes lokal til banner-treet.
 */

export interface AudioElementContextValue {
  currentTime: number;
  duration: number;
  /** iOS Safari låser opp `<audio>`-elementet etter første `play()`-kall
   *  innenfor user-gesture-stack. Kalles fra click-handler før første
   *  audio-tour-start når UI ikke kan stole på at samme tap utløser
   *  `useAudioTourStore.start()` (f.eks. Reels-intro-unlock-knapp). */
  unlock: () => Promise<void>;
  /** Demp/avdemp VO-en. Bor her (ikke i tour-store) fordi mute er en ren
   *  egenskap ved `<audio>`-elementet — phase/track er uberørt. Persisterer på
   *  tvers av spor-bytter (samme element). Forbrukes av transport-menyen. */
  muted: boolean;
  toggleMuted: () => void;
}

/** Eksponert for testing — `PlayerBanner.test.tsx` wrapper med dette
 *  direkte for å hoppe over audio-elementets side-effekter. */
export const AudioElementContext =
  createContext<AudioElementContextValue | null>(null);

interface AudioElementProviderProps {
  children: ReactNode;
  /** Når true (default), auto-skip til neste spor i tracks-arrayet ved
   *  audio.onended (board-tour-mønster). Når false, pause i stedet — kaller
   *  i tillegg `onTrackEnded` hvis gitt så konsumenten kan reagere på
   *  per-spor-slutt uten å gå videre. Reels-routen bruker false. */
  autoAdvance?: boolean;
  /** Kalles når et spor slutter naturlig (audio.onended) OG autoAdvance er
   *  false. Brukes av Reels-orchestrator for å fade til map-fase. */
  onTrackEnded?: () => void;
}

export function AudioElementProvider({
  children,
  autoAdvance = true,
  onTrackEnded,
}: AudioElementProviderProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const toggleMuted = useCallback(() => setMuted((m) => !m), []);

  // Hent stable action-refs + reaktive felter separat — undgår at hele
  // sync-effekten re-runs hver gang trackIndex endrer seg pga ny action-ref.
  const next = useAudioTourStore((s) => s.next);
  const pause = useAudioTourStore((s) => s.pause);
  const setError = useAudioTourStore((s) => s.setError);
  const phase = useAudioTourStore((s) => s.phase);
  const trackIndex = useAudioTourStore((s) => s.trackIndex);
  const tracks = useAudioTourStore((s) => s.tracks);

  // Effekt 1: sett src + play når playing og track-kilde endrer seg.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (phase !== "playing") return;
    const url = tracks[trackIndex]?.url;
    if (!url) return;
    const absoluteUrl = new URL(url, window.location.origin).href;
    if (audio.src !== absoluteUrl) {
      audio.src = url;
      audio.load();
    }
    void audio.play().catch(() => setError());
  }, [phase, trackIndex, tracks, setError]);

  // Effekt 2: pause når phase ikke er playing.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (phase !== "playing") {
      audio.pause();
    }
  }, [phase]);

  // Effekt 2b: speil mute-state til elementet. `audio.muted` persisterer på
  // tvers av src-bytter, men vi setter den her så den overlever ev. element-
  // re-attach og holdes som single source of truth.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.muted = muted;
  }, [muted]);

  // Effekt 3: audio-event-handlers — én gang per mount.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      setCurrentTime(0);
      if (autoAdvance) {
        next();
      } else {
        pause("manual");
        onTrackEnded?.();
      }
    };
    const onError = () => setError();
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [autoAdvance, next, pause, onTrackEnded, setError]);

  const unlock = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    // iOS unlocker `<audio>`-elementet etter første `play()`-kall i user-
    // gesture-stack. For å garantere at en src eksisterer (ellers henger
    // play() i Chrome), bruk en data-URL med 0.1s stillhet.
    if (!audio.src) {
      audio.src =
        "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgP////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAnEMnYRZAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";
    }
    try {
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // Selv ved error har play() blitt forsøkt i gesture-stack — iOS
      // unlocker elementet uansett.
    }
  };

  return (
    <AudioElementContext.Provider
      value={{ currentTime, duration, unlock, muted, toggleMuted }}
    >
      <audio ref={audioRef} preload="metadata" className="sr-only" />
      {children}
    </AudioElementContext.Provider>
  );
}

export function useAudioElement(): AudioElementContextValue {
  const ctx = useContext(AudioElementContext);
  if (!ctx) {
    throw new Error("useAudioElement må kalles innenfor <AudioElementProvider>");
  }
  return ctx;
}
