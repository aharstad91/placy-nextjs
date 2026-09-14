"use client";

import { LoaderCircle, Mic, Square } from "lucide-react";
import { BOARD_VOICE_TESTID, useBoardVoice } from "@/components/variants/report/board/voice/board-voice";
import type { LiveStatus } from "@/lib/live/types";
import { LIVE_VOICES, type LiveVoice } from "@/lib/live/voices";
import { cn } from "@/lib/utils";

/**
 * Samtalen med Placy som én knapp i flaten (2026-09-13).
 *
 * Erstatter det store «Utforsk med Placy»-kortet. Kortet forklarte seg selv med
 * to startknapper, tre forslag, historikk, kilder og forbruk, og sto som et
 * fremmed panel over boardet. Demoen trenger det motsatte: samtalen skal ligge
 * INNE i flaten den snakker om, under spørsmålet og fanene, og bare ha to
 * tilstander en trenger å forstå: spill og stopp.
 *
 * Det som er borte, er borte med vilje: tekstmodus (boardet har spørsmålene
 * skrevet ut alt), forslagsbrikker (spørsmålskatalogen er forslagene), kilde-
 * og historikklister (kartet og kortene viser stedene). Det som er igjen er
 * status i én linje og Placys siste setning i to, så en demo i et rom med støy
 * fortsatt kan følges.
 *
 * Mikrofon, ikke play, som startikon: på mobilens liste står knappen rett
 * under omvisningens «La nabolaget presentere seg», som alt har en play-trekant,
 * og to like trekanter over hverandre leste som samme handling to ganger.
 * Stopp er stopp begge steder.
 *
 * Selve samtalen bor i `BoardVoiceProvider`; denne kan stå flere steder.
 */
const statusLabels: Record<LiveStatus, string> = {
  idle: "Snakk med Placy om nabolaget",
  connecting: "Kobler til …",
  listening: "Lytter. Spør om nabolaget",
  thinking: "Undersøker …",
  speaking: "Placy svarer",
  error: "Samtalen er stoppet",
};

export function BoardVoiceControl() {
  const voice = useBoardVoice();
  if (!voice) return null;
  const { status, running, connecting, notice, error, latest, toggle } = voice;
  const label = voice.guided
    ? ({ idle: "La Anja vise deg nærområdet", listening: "Spør, eller si «fortsett»", speaking: "Anja forteller · du kan avbryte", thinking: "Et øyeblikk …" } as Partial<Record<LiveStatus, string>>)[status]
    : undefined;

  return (
    <div data-testid={BOARD_VOICE_TESTID} className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        aria-label={running ? "Stopp samtalen med Placy" : "Start samtale med Placy"}
        aria-pressed={running}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-[background-color,box-shadow] duration-200",
          running
            ? "bg-stone-900 text-white"
            : "bg-stone-900/[0.06] text-stone-900 hover:bg-stone-900/10",
          status === "speaking" && "shadow-[0_0_0_5px_rgba(28,25,23,0.1)]",
        )}
      >
        {connecting
          ? <LoaderCircle size={16} className="animate-spin" />
          : running
            ? <Square size={12} fill="currentColor" />
            : <Mic size={15} strokeWidth={2.25} />}
      </button>
      <div className="min-w-0 flex-1">
        {voice.guided && <p className="text-xs leading-5 text-stone-500">Anja · AI-guide fra Placy</p>}
        <p role="status" aria-live="polite" className="text-[13px] font-semibold leading-5 text-stone-900">
          {notice ?? label ?? statusLabels[status]}
        </p>
        {voice.morePlaces && (
          <div className="mt-2 rounded-xl bg-stone-100 p-2.5">
            <p className="text-xs text-stone-600">Utforsk flere steder i nærheten</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {voice.morePlaces.options.slice(0, 1).map(option => (
                <button key={option.radiusKm} type="button" disabled={connecting} onClick={() => voice.morePlaces?.show(option.radiusKm)}
                  className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-200 disabled:opacity-50">
                  Vis flere steder
                </button>
              ))}
            </div>
            {!voice.morePlaces.options.length && <p className="text-xs text-stone-500">Alle stedene i utvalget er vist.</p>}
          </div>
        )}
        {voice.voiceSelection && (
          <label className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
            Stemme
            <select
              aria-label="Velg stemme"
              value={voice.voiceSelection.value}
              disabled={running}
              onChange={event => voice.voiceSelection?.select(event.target.value as LiveVoice | "")}
              className="rounded-md border border-stone-200 bg-white px-2 py-1 text-stone-900 disabled:opacity-50"
            >
              <option value="">Standard</option>
              {LIVE_VOICES.map(name => <option key={name} value={name}>{name[0].toUpperCase() + name.slice(1)}</option>)}
            </select>
            <span>{running ? "Stopp for å bytte stemme" : "Velg, og start samtalen"}</span>
          </label>
        )}
        {error
          ? <p role="alert" className="text-[12px] leading-[1.45] text-[#944d38]">{error}</p>
          : running && latest
            ? <p data-testid="board-voice-latest" className="line-clamp-2 text-[12px] leading-[1.45] text-stone-500">{latest}</p>
            : null}
      </div>
    </div>
  );
}
