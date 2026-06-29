import { describe, expect, it } from "vitest";
import {
  useAudioTourPhase,
  useCurrentTrack,
} from "@/lib/stores/audio-tour-store";
import type {
  AudioTourPhase,
  AudioTrack,
  AudioTrackCategoryId,
  UseAudioTourPhase,
  UseCurrentTrack,
} from "@/lib/audio-tour/beat-signal-contract";
import type { BoardCategoryId } from "@/lib/board/board-types";

/**
 * Beat-signal-KONTRAKT-håndhevelse (rC1, lag-back-edge).
 *
 * Disse assertion-ene er kompilerings-tids-vakter: hvis PRD 14s owner-impl
 * (r14.6) drifter `useCurrentTrack`/`useAudioTourPhase` bort fra de hoistede
 * Lag-2-signaturene, feiler `npx tsc --noEmit` her — IKKE bare runtime. Det er
 * dét som gjør kontrakten bindende mot owner-impl.
 */

// ── Kompilerings-tids-kontrakt: store-selektorene MÅ være assignable til de
//    hoistede signaturene (begge retninger der det er meningsfullt). ──────────

// Owner-impl honorerer kontrakt-signaturen (store → kontrakt).
const _phaseHonorsContract: UseAudioTourPhase = useAudioTourPhase;
const _trackHonorsContract: UseCurrentTrack = useCurrentTrack;

// Kontrakt-signaturen er oppfylt av owner-impl (kontrakt → store). Fanger
// utilsiktet snevring i store-en (f.eks. om noen la til et påkrevd argument).
const _phaseImpl: typeof useAudioTourPhase = _phaseHonorsContract;
const _trackImpl: typeof useCurrentTrack = _trackHonorsContract;

void _phaseImpl;
void _trackImpl;

describe("beat-signal-kontrakt (rC1)", () => {
  it("eksponerer alle fem tour-fasene og ingen flere", () => {
    // Eksplisitt enumerasjon — beat-choreografien (PRD 10) matcher mot disse.
    const phases: AudioTourPhase[] = [
      "idle",
      "playing",
      "paused",
      "ended",
      "error",
    ];
    // Uttømmende: en variabel typet som AudioTourPhase MÅ være én av de fem.
    const assertExhaustive = (p: AudioTourPhase): string => {
      switch (p) {
        case "idle":
        case "playing":
        case "paused":
        case "ended":
        case "error":
          return p;
        default: {
          const _never: never = p;
          return _never;
        }
      }
    };
    expect(phases.map(assertExhaustive)).toEqual(phases);
  });

  it("categoryId-shapen bærer de tre beat-special-verdiene + board-kategorier", () => {
    // De tre special-verdiene choreografi-grenene matcher på (welcome/home/outro).
    const welcome: AudioTrackCategoryId = "welcome";
    const home: AudioTrackCategoryId = "home";
    const outro: AudioTrackCategoryId = "outro";
    // En vilkårlig board-kategori-ID er også en gyldig spor-kategori.
    const board: AudioTrackCategoryId = "mat-drikke" as BoardCategoryId;

    expect([welcome, home, outro]).toEqual(["welcome", "home", "outro"]);
    expect(typeof board).toBe("string");
  });

  it("AudioTrack-shapen matcher det beat-signalet eksponerer", () => {
    // url + manus påkrevd, durationSec optional — beat→tour-varighet leser den.
    const track: AudioTrack = {
      categoryId: "home",
      url: "/audio/x/hjem.mp3",
      manus: "hjem-manus",
      durationSec: 12,
    };
    const minimal: AudioTrack = {
      categoryId: "welcome",
      url: "/audio/x/welcome.mp3",
      manus: "velkommen",
    };

    expect(track.durationSec).toBe(12);
    expect(minimal.durationSec).toBeUndefined();
    expect(minimal.categoryId).toBe("welcome");
  });

  it("selektor-funksjonene er kallbare uten argumenter (signatur-arity)", () => {
    // Kontrakten er null-arg selektorer; owner-impl må bevare arity.
    expect(useAudioTourPhase).toHaveLength(0);
    expect(useCurrentTrack).toHaveLength(0);
  });
});
