import type { LiveMessage, LiveStatus } from "@/lib/live/types";

/**
 * Kanalen mellom Leangenbuktas chatwidget og talebroen (2026-09-24).
 *
 * `public/embed/placy-chat.js` er den ENESTE synlige flaten (Shadow DOM, ingen
 * byggesteg). Talen trenger WebRTC og `useLive`, som bare finnes i React-appen.
 * Broen (`app/demo/leangenbukta-nettside/voice-bridge.tsx`) er derfor usynlig og
 * snakker med widgeten gjennom tre CustomEvents på `window`:
 *
 * - `hello`   widget → bro: «finnes du?» Broen svarer med en `state`.
 * - `state`   bro → widget: status, feil, varsel og hele transkriptet med
 *             stabile ID-er. Widgeten oppdaterer boblene sine etter ID-en, så
 *             samme melding aldri vises to ganger.
 * - `command` widget → bro: start, stopp eller skrevet tekst under talen.
 *
 * Uten bro (widgeten innbygget på en ekstern side) kommer det aldri en
 * `state`, og widgeten viser bare tekstchatten slik den alltid har gjort.
 *
 * Widgeten har sin egen kopi av hendelsesnavnene: den er et frittstående
 * skript og kan ikke importere noe. `voice-channel.test.ts` holder dem like.
 */

export const VOICE_EVENTS = {
  hello: "placy-chat:voice-hello",
  state: "placy-chat:voice-state",
  command: "placy-chat:voice-command",
} as const;

/** Datasettet chatboksens stemme snakker ut fra; samme som `LB_VOICE_DATASET` på serveren. */
export const CHAT_VOICE_DATASET = "leangenbukta-lokal";

/** Hilsenen er en instruksjon til stemmen, ikke en ferdig replikk (se `useLive`). */
export const CHAT_VOICE_GREETING =
  "Si en kort hilsen på norsk: at du er Anja fra Placy, at dette er en ny talesamtale, og spør hva de lurer på om å bo i Leangenbukta. Høyst to setninger.";

/** Samme grense som tekstfeltet og tekstchattens server (600 tegn). */
export const VOICE_TEXT_MAX = 600;

export type VoiceCommand = { type: "start" } | { type: "stop" } | { type: "text"; text: string };

export interface VoiceWidgetMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export interface VoiceWidgetState {
  available: boolean;
  status: LiveStatus;
  error: string | null;
  notice: string | null;
  messages: VoiceWidgetMessage[];
}

/** Kommandoen fra widgeten, eller null. Alt som ikke er en kjent form avvises. */
export function parseVoiceCommand(detail: unknown): VoiceCommand | null {
  if (!detail || typeof detail !== "object") return null;
  const value = detail as { type?: unknown; text?: unknown };
  if (value.type === "start" || value.type === "stop") return { type: value.type };
  if (value.type === "text" && typeof value.text === "string") {
    const text = value.text.trim().slice(0, VOICE_TEXT_MAX);
    return text ? { type: "text", text } : null;
  }
  return null;
}

/**
 * Tilstanden widgeten får. ID-ene er `useLive` sine egne (tilfeldige per
 * innslag), med et prefiks så de ikke kan kollidere med noe widgeten lager.
 * Tomme innslag sendes ikke: en boble uten tekst er bare støy.
 */
export function voiceWidgetState(input: {
  status: LiveStatus;
  error: string | null;
  notice: string | null;
  messages: readonly LiveMessage[];
}): VoiceWidgetState {
  return {
    available: true,
    status: input.status,
    error: input.status === "error" ? input.error : null,
    notice: input.notice,
    messages: input.messages
      .filter((message) => message.text.trim())
      .map((message) => ({ id: `voice-${message.id}`, role: message.role, text: message.text.trim() })),
  };
}
