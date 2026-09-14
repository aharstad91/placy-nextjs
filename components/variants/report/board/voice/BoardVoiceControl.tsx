"use client";

import { useEffect, useRef } from "react";
import { Mic, RotateCcw, TriangleAlert } from "lucide-react";
import { BOARD_VOICE_TESTID, useBoardVoice, type BoardVoice } from "@/components/variants/report/board/voice/board-voice";
import { cn } from "@/lib/utils";
import styles from "./BoardVoiceControl.module.css";

/**
 * Samtalen med guiden som ÉN sirkel og to tekstlinjer (2026-09-14).
 *
 * Sirkelen er både handlingen og statusindikatoren: mikrofon når hun er klar,
 * roterende ring mens hun kobler til, pustende ring mens hun lytter (og en ring
 * som følger stemmen din når hun hører deg), fire punkter i bane mens hun
 * finner svar, og de samme punktene som lydbølge når hun snakker. Etter
 * samtalen en restart-pil. Sirkelen beholder plass og størrelse hele veien;
 * bare formen inni endres, så feltet aldri skyver innholdet under.
 *
 * Teksten sier tilstanden med få ord («Jeg lytter», «Finner svar …»,
 * «Snakker») og under den hva du kan gjøre. Ingen transkripsjon og ingen
 * stemmevelger: guiden forklarer med stemmen, kartet og panelet viser
 * innholdet, og hun har én stemme.
 *
 * Å avslutte er sirkelen selv: hover/fokus viser «Avslutt samtalen» som
 * tooltip uten å skjule statusen, og på berøringsskjerm står «Avslutt» som
 * teksthandling under statusen. Samtalen bor i `BoardVoiceProvider`.
 *
 * FØR og ETTER samtalen er feltet en kompakt inngang på én linje (2026-09-14):
 * en liten sirkel og «Snakk med Anja», eller «Snakk med Anja igjen» når en
 * samtale er avsluttet. Hele linjen er knappen. Den står nederst i panelet på
 * desktop, og skal ta så lite plass at innholdet kommer først; statusfeltet
 * med hjelpetekst vokser fram først når samtalen faktisk går. «Samtalen er
 * avsluttet» sies ikke lenger: det ordet «igjen» sier det.
 */
type FieldState = "idle" | "connecting" | "listening" | "hearing" | "thinking" | "speaking" | "ended" | "attention";

function fieldState(voice: BoardVoice): FieldState {
  switch (voice.status) {
    case "connecting": return "connecting";
    case "listening": return voice.hearing ? "hearing" : "listening";
    case "thinking": return "thinking";
    case "speaking": return "speaking";
    case "error": return "attention";
    default: return voice.ended ? "ended" : "idle";
  }
}

/** Feilmeldingene er «hva som er galt. hva du gjør.»: første setning er hovedtekst, resten hjelpetekst. */
function splitError(message: string): { main: string; sub: string } {
  const cut = message.indexOf(". ");
  if (cut < 0) return { main: message.replace(/\.$/, ""), sub: "Trykk på sirkelen for å prøve igjen" };
  return { main: message.slice(0, cut), sub: message.slice(cut + 2) };
}

function copy(state: FieldState, voice: BoardVoice, name: string): { main: string; sub: string } {
  const base = baseCopy(state, voice, name);
  // Merknader fra samtalen («avsluttes om to minutter», «noe avbrøt svaret») tar hjelpetekstens plass mens samtalen går.
  return voice.notice && ACTIVE.has(state) ? { ...base, sub: voice.notice } : base;
}

function baseCopy(state: FieldState, voice: BoardVoice, name: string): { main: string; sub: string } {
  switch (state) {
    case "idle": return { main: `Snakk med ${name}`, sub: voice.guided ? "AI-guide fra Placy" : "Spør om nabolaget" };
    case "connecting": return { main: "Kobler til …", sub: "Et øyeblikk" };
    case "listening":
    case "hearing": return { main: "Jeg lytter", sub: "Spør om det du vil vite" };
    case "thinking": return { main: "Finner svar …", sub: voice.guided ? "Leser det som er skrevet om nabolaget" : "Slår opp i nabolaget" };
    case "speaking": return { main: "Snakker", sub: "Snakk for å avbryte" };
    case "ended": return { main: `Snakk med ${name} igjen`, sub: "" };
    case "attention": return splitError(voice.error ?? "Samtalen ble avbrutt. Trykk på sirkelen for å prøve igjen");
  }
}

const ACTIVE: ReadonlySet<FieldState> = new Set(["connecting", "listening", "hearing", "thinking", "speaking"]);

export function BoardVoiceControl() {
  const voice = useBoardVoice();
  const field = useRef<HTMLDivElement>(null);
  const hearing = voice?.status === "listening" && voice.hearing;
  const micLevel = voice?.micLevel;

  // Ringen følger mikrofonnivået i en animasjonsramme, uten å rendre React.
  useEffect(() => {
    const element = field.current;
    if (!element || !hearing || !micLevel) return;
    let frame = 0;
    let shown = 1;
    const tick = () => {
      const target = 1 + Math.max(0, micLevel.current ?? 0) * 0.22;
      shown += (target - shown) * 0.35;
      element.style.setProperty("--lvl", shown.toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); element.style.removeProperty("--lvl"); };
  }, [hearing, micLevel]);

  if (!voice) return null;
  const name = voice.guided ? "Anja" : "Placy";
  const state = fieldState(voice);
  const active = ACTIVE.has(state);
  const text = copy(state, voice, name);
  const label = active ? "Avslutt samtalen" : state === "attention" ? "Prøv igjen" : text.main;
  const glyph = state === "idle" || state === "listening" || state === "hearing" ? "mic"
    : state === "thinking" || state === "speaking" ? "dots"
      : state === "ended" ? "again"
        : state === "attention" ? "warn" : null;

  // Inngangen: én linje, hele linjen er knappen. Teksten ER knappens navn.
  if (state === "idle" || state === "ended") {
    return (
      <button
        type="button"
        onClick={voice.toggle}
        disabled={voice.connecting}
        data-testid={BOARD_VOICE_TESTID}
        data-s={state}
        className={cn(styles.field, styles.entry)}
      >
        <span className={styles.orb} aria-hidden="true">
          {state === "ended" ? <RotateCcw size={16} strokeWidth={2.3} /> : <Mic size={16} strokeWidth={2.25} />}
        </span>
        <span className={styles.main}>{text.main}</span>
      </button>
    );
  }

  return (
    <div>
      <div ref={field} data-testid={BOARD_VOICE_TESTID} data-s={state} className={cn(styles.field, active && styles.active)} role="group" aria-label={`${name}, stemmeguide`}>
        <button type="button" onClick={voice.toggle} disabled={voice.connecting} aria-label={label} className={styles.orb}>
          <span className={styles.tip} aria-hidden="true">Avslutt samtalen</span>
          <span className={styles.halo} aria-hidden="true" />
          <span className={cn(styles.glyph, glyph === "mic" && styles.glyphOn)} aria-hidden="true"><Mic size={19} strokeWidth={2.25} /></span>
          <span className={cn(styles.glyph, styles.dots, glyph === "dots" && styles.glyphOn)} aria-hidden="true"><i /><i /><i /><i /></span>
          <span className={cn(styles.glyph, glyph === "again" && styles.glyphOn)} aria-hidden="true"><RotateCcw size={19} strokeWidth={2.3} /></span>
          <span className={cn(styles.glyph, glyph === "warn" && styles.glyphOn)} aria-hidden="true"><TriangleAlert size={19} strokeWidth={2.2} /></span>
        </button>
        <div className={styles.text}>
          <p role={state === "attention" ? "alert" : "status"} aria-live="polite" className={styles.main}>{text.main}</p>
          <p className={styles.sub}>
            <span className={styles.subText}>{text.sub}</span>
            {active && <button type="button" onClick={voice.toggle} disabled={voice.connecting} className={styles.end}>Avslutt</button>}
          </p>
        </div>
      </div>
      {voice.morePlaces && (
        <div className="mt-2 rounded-xl bg-stone-100 p-2.5">
          <p className="text-xs text-stone-600">Utforsk flere steder i nærheten</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {voice.morePlaces.options.slice(0, 1).map(option => (
              <button key={option.radiusKm} type="button" disabled={voice.connecting} onClick={() => voice.morePlaces?.show(option.radiusKm)}
                className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-200 disabled:opacity-50">
                Vis flere steder
              </button>
            ))}
          </div>
          {!voice.morePlaces.options.length && <p className="text-xs text-stone-500">Alle stedene i utvalget er vist.</p>}
        </div>
      )}
    </div>
  );
}
