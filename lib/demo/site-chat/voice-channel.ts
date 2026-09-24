import type { LiveMessage, LiveStatus } from "@/lib/live/types";
import type { LiveContinuity } from "@/lib/live/use-live";

/**
 * Kanalen mellom chatwidgeten og talebroen (2026-09-24), felles for alle kunder.
 *
 * `public/embed/placy-chat.js` er den ENESTE synlige flaten (Shadow DOM, ingen
 * byggesteg). Talen trenger WebRTC og `useLive`, som bare finnes i React-appen.
 * Broen (`components/demo/site-chat-voice-bridge.tsx`) er derfor usynlig og
 * snakker med widgeten gjennom tre CustomEvents på `window`:
 *
 * - `hello`   widget → bro: «finnes du?» Broen svarer med en `state`.
 * - `state`   bro → widget: status, feil, varsel og hele transkriptet med
 *             stabile ID-er. Widgeten oppdaterer boblene sine etter ID-en, så
 *             samme melding aldri vises to ganger. I tillegg `continuity`
 *             (hva talen fikk med seg fra tekstchatten) og `handoff` (nytt
 *             signert historikktoken for tekstchatten når talen er slutt).
 * - `command` widget → bro: start (med tekstchattens signerte token), stopp
 *             eller skrevet tekst under talen.
 *
 * ## Én samtale på tvers av skriving og tale
 *
 * Tekst → tale: `start.transcript` er tekstchattens signerte token. Broen gir
 * det til `useLive`, serveren verifiserer det mot den besøkende og legger
 * turene i Live-sesjonen. Tale → tekst: når en serversesjon er slutt, bytter
 * broen sesjonstokenet mot et nytt signert token (`/api/prototype/live/handoff`)
 * og sender det til widgeten som `handoff`. Widgeten bruker det som sitt nye
 * tekst-token; klientens egne bobler blir aldri historikk.
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

/**
 * Hilsenen når tekstchattens historikk ligger i sesjonen: fortsett, ikke begynn
 * på nytt. Felles for alle kunder; kundens egen første hilsen står i profilen.
 */
export const CONTINUED_VOICE_GREETING =
  "Samtalen fortsetter muntlig fra chatboksen. Si kort på norsk at du er Anja og gjerne fortsetter muntlig, knytt an til det dere nettopp snakket om med noen få ord, og spør hva mer de lurer på. Ikke si at dette er en ny samtale, og ikke gjenta svar du alt har gitt. Høyst to setninger."

/** Samme tak som serverens `MAX_TRANSCRIPT_TOKEN_LENGTH` (transcript.ts er server-only). */
export const VOICE_TRANSCRIPT_MAX = 24576;

/** Samme grense som tekstfeltet og tekstchattens server (600 tegn). */
export const VOICE_TEXT_MAX = 600;

export type VoiceCommand = { type: "start"; transcript?: string } | { type: "stop" } | { type: "text"; text: string };

/**
 * Overføringen til tekstchatten etter en talesesjon. `id` øker per sesjon, så
 * widgeten behandler hver overføring én gang.
 */
export type VoiceHandoff =
  | { id: number; status: "pending" }
  | { id: number; status: "ready"; transcript: string; voiceTurns: number; trimmed: boolean }
  | { id: number; status: "failed" };

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
  continuity: LiveContinuity | null;
  handoff: VoiceHandoff | null;
}

/** Kommandoen fra widgeten, eller null. Alt som ikke er en kjent form avvises. */
export function parseVoiceCommand(detail: unknown): VoiceCommand | null {
  if (!detail || typeof detail !== "object") return null;
  const value = detail as { type?: unknown; text?: unknown };
  if (value.type === "stop") return { type: "stop" };
  if (value.type === "start") {
    const transcript = (detail as { transcript?: unknown }).transcript;
    // Tokenet er ugjennomsiktig for broen; serveren verifiserer det.
    return typeof transcript === "string" && transcript && transcript.length <= VOICE_TRANSCRIPT_MAX ? { type: "start", transcript } : { type: "start" };
  }
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
  continuity?: LiveContinuity | null;
  handoff?: VoiceHandoff | null;
}): VoiceWidgetState {
  return {
    available: true,
    status: input.status,
    error: input.status === "error" ? input.error : null,
    notice: input.notice,
    messages: input.messages
      .filter((message) => message.text.trim())
      .map((message) => ({ id: `voice-${message.id}`, role: message.role, text: message.text.trim() })),
    continuity: input.continuity ?? null,
    handoff: input.handoff ?? null,
  };
}
