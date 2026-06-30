"use client";

import { useReelsAudioOrchestration } from "./use-reels-audio-orchestration";

/**
 * Null-rendrende monteringspunkt for voiceover-orchestration-hooken.
 *
 * Lazy-load-grense (PRD 9 Unit 7 / PRD 2 Beslutning 14): denne modulen ligger
 * i en SEPARAT chunk (`reels-audio-orchestration`) som `dynamic(ssr:false)`-
 * importeres av `ReportReelsPage`, så et nivå-1-board uten spillbar VO ikke
 * betaler orchestration-koden (audio-tour-store-wiring + track-bygging) i
 * entry-chunken.
 *
 * Montert som SØSKEN (ikke wrapper) av board-layouten: hooken kjører rene
 * effekter og rendrer ingen UI, så søsken- vs. wrapper-plassering er
 * atferds-ekvivalent — men søsken-formen lar layout-treet rendre umiddelbart
 * uten å vente på at denne chunken lastes.
 */
export default function ReelsAudioOrchestrator() {
  useReelsAudioOrchestration();
  return null;
}
