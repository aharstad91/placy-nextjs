"use client";

import { useBoard } from "@/components/variants/report/board/board-state";
import { useBoardAgent } from "@/components/variants/report/board/agent/board-agent";
import { AgentModeToggle } from "@/components/variants/report/board/agent/AgentModeToggle";
import { BoardVoiceControl } from "@/components/variants/report/board/voice/BoardVoiceControl";

/**
 * Inngangen til Anja der boardet har en (2026-09-25): veksleren
 * «Utforsk / Spør Anja» når agentmodusen er på, ellers dagens talekontroll.
 * Samme valg i desktopkolonnen og alle mobilens sheets, så de ikke kan skli
 * fra hverandre.
 */
export function BoardAssistantEntry() {
  const agent = useBoardAgent();
  if (agent) {
    return <AgentModeToggle mode={agent.mode} onChange={agent.setMode} name={agent.name} claimFocus={agent.claimToggleFocus} />;
  }
  return <BoardVoiceControl />;
}

/** Om boardet har en Anja-inngang i det hele tatt: agentmodus, en assistent eller en lokal demo med stemme. */
export function useHasBoardAssistant(): boolean {
  const agent = useBoardAgent();
  const { data } = useBoard();
  return Boolean(agent || data.assistant?.enabled || data.demoSnapshotId);
}
