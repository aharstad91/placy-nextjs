"use client";

import { LoaderCircle, Mic, Square } from "lucide-react";
import { BOARD_VOICE_TESTID, useBoardVoice } from "@/components/variants/report/board/voice/board-voice";
import type { LiveStatus } from "@/lib/live/types";
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
        <p role="status" aria-live="polite" className="truncate text-[13px] font-semibold leading-5 text-stone-900">
          {notice ?? statusLabels[status]}
        </p>
        {error
          ? <p role="alert" className="text-[12px] leading-[1.45] text-[#944d38]">{error}</p>
          : running && latest
            ? <p data-testid="board-voice-latest" className="line-clamp-2 text-[12px] leading-[1.45] text-stone-500">{latest}</p>
            : null}
      </div>
    </div>
  );
}
