import type { AgentEntry } from "@/lib/board-agent/types";
import { TYPED_MESSAGE_ID_PREFIX } from "@/lib/live/types";

/**
 * Samtalens ÉN historikk i agentmodusen (2026-09-25, R2).
 *
 * Tekst og tale er to transporter, men brukeren skal se én samtale. Innslag
 * fra tekstbanen legges til og byttes ut her (et «svar på vei»-innslag blir
 * svaret eller en feil). Taletranskriptet fra `useLive` flettes inn etter
 * innslagets egen ID: samme melding oppdateres mens den vokser, og vises
 * aldri to ganger. Et nytt talestart nullstiller `useLive`s liste, men
 * historikken her beholder det som alt ble sagt.
 */

/** Taleinnslaget slik `useLive` rapporterer det. */
export interface VoiceFeedMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export type FeedAction =
  | { type: "add"; entry: AgentEntry }
  /** Bytt ut et innslag (typisk `pending`) med null eller flere nye. */
  | { type: "replace"; id: string; entries: AgentEntry[] }
  | { type: "voice"; messages: readonly VoiceFeedMessage[] };

export const voiceEntryId = (messageId: string) => `voice-${messageId}`;

const typedDuringVoice = (messageId: string) => messageId.startsWith(TYPED_MESSAGE_ID_PREFIX);

export function feedReducer(entries: AgentEntry[], action: FeedAction): AgentEntry[] {
  switch (action.type) {
    case "add":
      return entries.some((entry) => entry.id === action.entry.id) ? entries : [...entries, action.entry];
    case "replace": {
      const index = entries.findIndex((entry) => entry.id === action.id);
      if (index < 0) return action.entries.length ? [...entries, ...action.entries] : entries;
      return [...entries.slice(0, index), ...action.entries, ...entries.slice(index + 1)];
    }
    case "voice": {
      let next = entries;
      for (const message of action.messages) {
        const text = message.text.trim();
        if (!text) continue;
        const id = voiceEntryId(message.id);
        const index = next.findIndex((entry) => entry.id === id);
        if (index < 0) {
          next = [...next, { id, kind: message.role, text, via: typedDuringVoice(message.id) ? "text" : "voice" }];
          continue;
        }
        const current = next[index];
        if ((current.kind === "user" || current.kind === "assistant") && current.text !== text) {
          next = [...next.slice(0, index), { ...current, text }, ...next.slice(index + 1)];
        }
      }
      return next;
    }
  }
}
