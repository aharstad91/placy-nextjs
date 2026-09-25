"use client";

import { useBoardAgent } from "@/components/variants/report/board/agent/board-agent";
import { AgentPanel } from "@/components/variants/report/board/agent/AgentPanel";
import { BoardVoiceControl } from "@/components/variants/report/board/voice/BoardVoiceControl";

/**
 * Samtaleflaten koblet til koordinatoren (2026-09-25). Én og samme flate i
 * desktopkolonnen og i mobilens sheet; bare rammen rundt er forskjellig.
 * Talens status, samtykke og avslutning er den eksisterende
 * `BoardVoiceControl`, vist over composeren når «Snakk» er valgt.
 */
export function BoardAgentSurface({ variant }: { variant: "column" | "sheet" }) {
  const agent = useBoardAgent();
  if (!agent) return null;
  return (
    <AgentPanel
      name={agent.name}
      entries={agent.entries}
      suggestions={agent.suggestions}
      input={agent.input}
      onInputChange={agent.setInput}
      onSend={agent.send}
      onSuggestion={agent.selectSuggestion}
      onDismissSuggestions={agent.dismissSuggestions}
      onPlaceFocus={agent.focusPlace}
      busy={agent.busy}
      voiceSlot={<BoardVoiceControl />}
      emptyTitle={`Spør ${agent.name} om Nyhavna`}
      emptyBody="Skriv et spørsmål, velg et forslag, eller trykk på et sted i kartet — så svarer hun her og viser det i kartet."
      variant={variant}
    />
  );
}
