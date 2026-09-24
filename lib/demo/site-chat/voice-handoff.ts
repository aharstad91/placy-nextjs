import "server-only";

import { issueTranscript, MAX_TURNS, windowTurns, type TranscriptScope, type TranscriptTurn } from "@/lib/demo/site-chat/transcript";
import { LIVE_SESSION_MAX_MS } from "@/lib/live/session-limits";
import type { LiveTranscriptSink } from "@/lib/live/sideband";

/**
 * Tale → tekst i chatboksen (2026-09-24), for alle kunder.
 *
 * Når en talesamtale i chatboksen er over, skal tekstchatten kunne fortsette
 * fra det som ble sagt. Klienten har transkriptboblene, men dem kan den dikte
 * opp; assistentens ord må komme fra serveren. Sidebandet hører de samme
 * transkript-eventene som nettleseren (`session.input_transcript.delta` /
 * `session.output_transcript.delta`) og skriver dem hit, gruppert til turer.
 * Når talen er slutt, bytter klienten sesjonstokenet sitt mot et nytt signert
 * historikktoken (`/api/prototype/live/handoff`): tekstturene fra før talen
 * pluss taleturene, i samme vindu som tekstchatten ellers bruker.
 *
 * På den delte stemmen (`lib/live/hosted-control.ts`) finnes ingen slik
 * utveksling: forespørslene kan havne på ulike funksjonsinstanser. Der eier
 * kontrollforbindelsen sitt eget opptak (`createVoiceRecording`) og sender det
 * signerte tokenet tilbake på den SAMME forbindelsen før den lukkes.
 *
 * ## Livstid og avgrensning (lokal rute)
 *
 * - Bare i minnet i denne Node-prosessen, aldri på disk eller i database.
 * - Nøkkelen er supervisorens tilfeldige sesjonstoken (UUID) OG den besøkendes
 *   ID; et token fra en annen besøkende gir ingenting. Innslaget husker
 *   kunden og datasettet (`TranscriptScope`) talen startet for, og det nye
 *   tokenet signeres alltid for akkurat den kunden.
 * - Innslaget lever mens sesjonen varer og `HANDOFF_TTL_MS` etter at den er
 *   lukket; deretter er det borte. En omstart av serveren sletter alt, og da
 *   sier UI-et ærlig at overføringen feilet.
 * - Høyst `MAX_ENTRIES` innslag samtidig; eldste faller ut først.
 * - Opptaket holder høyst `MAX_TURNS` × 2 turer; vinduet i tokenet klipper
 *   videre til samme tak som tekstchatten.
 */

const HANDOFF_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 50;
/** Samme skille som nettleserens transkript (`useLive`): pause hos samme taler = ny tur. */
const TURN_GAP_MS = 1500;
const MAX_TURN_CHARS = 2000;

/** Det én talesesjon har hørt og sagt, bundet til kunden og den besøkende. */
interface VoiceRecordingState {
  scope: TranscriptScope;
  visitorId: string;
  snapshotId: string;
  baseTurns: TranscriptTurn[];
  baseTrimmed: boolean;
  voiceTurns: TranscriptTurn[];
  lastRole: "user" | "assistant" | null;
  lastEndMs: number | null;
  closed: boolean;
}

interface HandoffEntry {
  recording: VoiceRecording;
  expiresAt: number;
}

export interface VoiceRecordingInput {
  scope: TranscriptScope;
  visitorId: string;
  /** Innholdsversjonen tekstchatten verifiserer mot (kildens egen, ikke prosjektets). */
  snapshotId: string;
  baseTurns: readonly TranscriptTurn[];
  baseTrimmed: boolean;
}

export type VoiceHandoffResult =
  | { ok: true; transcript: string; voiceTurns: number; trimmed: boolean }
  | { ok: false };

export interface VoiceRecording {
  readonly customerId: string;
  /** Mottakeren sidebandet skriver til. */
  sink: LiveTranscriptSink;
  /** Nytt signert token for tekstchatten, bare for den samme besøkende. */
  issue: (visitorId: string) => VoiceHandoffResult;
  onClose?: () => void;
}

/**
 * Opptaket for én talesesjon, uten lagring (2026-09-24). Den delte stemmen
 * (`lib/live/hosted-control.ts`) eier ett opptak per kontrollforbindelse og
 * sender tokenet tilbake på den samme forbindelsen når talen er slutt; den
 * lokale ruta legger opptaket i minnelageret under (`startVoiceHandoff`).
 */
export function createVoiceRecording(input: VoiceRecordingInput): VoiceRecording {
  const entry: VoiceRecordingState = {
    scope: input.scope,
    visitorId: input.visitorId,
    snapshotId: input.snapshotId,
    baseTurns: [...input.baseTurns],
    baseTrimmed: input.baseTrimmed,
    voiceTurns: [],
    lastRole: null,
    lastEndMs: null,
    closed: false,
  };
  const push = (role: "user" | "assistant", text: string) => {
    entry.voiceTurns.push({ role, text: text.slice(0, MAX_TURN_CHARS), via: "voice" });
    if (entry.voiceTurns.length > MAX_TURNS * 2) entry.voiceTurns.splice(0, entry.voiceTurns.length - MAX_TURNS * 2);
  };
  const recording: VoiceRecording = {
    customerId: input.scope.customerId,
    sink: {
      delta(role, delta, timing) {
        if (entry.closed) return;
        const last = entry.voiceTurns.at(-1);
        const gap = timing.startMs !== null && entry.lastEndMs !== null && timing.startMs - entry.lastEndMs > TURN_GAP_MS;
        if (!last || entry.lastRole !== role || gap) push(role, delta);
        else last.text = (last.text + delta).slice(0, MAX_TURN_CHARS);
        entry.lastRole = role;
        entry.lastEndMs = timing.endMs ?? timing.startMs ?? entry.lastEndMs;
      },
      typed(text) {
        if (entry.closed || !text.trim()) return;
        push("user", text.trim());
        // En skrevet melding avslutter ev. pågående talt tur.
        entry.lastRole = null;
      },
      close() {
        if (entry.closed) return;
        entry.closed = true;
        recording.onClose?.();
      },
    },
    issue(visitorId) {
      if (visitorId !== entry.visitorId) return { ok: false };
      const voiceTurns = entry.voiceTurns.filter((turn) => turn.text.trim());
      const window = windowTurns(entry.baseTurns, voiceTurns);
      const trimmed = window.trimmed || entry.baseTrimmed;
      const transcript = issueTranscript({
        scope: entry.scope,
        visitorId,
        snapshotId: entry.snapshotId,
        previousTurns: [],
        newTurns: window.turns,
        previousTrimmed: trimmed,
      });
      return { ok: true, transcript, voiceTurns: voiceTurns.length, trimmed };
    },
  };
  return recording;
}

const globals = globalThis as typeof globalThis & { placySiteChatVoiceHandoffs?: Map<string, HandoffEntry> };

function store(): Map<string, HandoffEntry> {
  globals.placySiteChatVoiceHandoffs ??= new Map();
  return globals.placySiteChatVoiceHandoffs;
}

function prune(now: number) {
  const entries = store();
  for (const [key, entry] of entries) if (entry.expiresAt <= now) entries.delete(key);
  // Map beholder innsettingsrekkefølgen: de første er de eldste.
  while (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value!);
}

/**
 * Den lokale ruta: starter opptaket for én talesesjon og legger det i
 * prosessens minne under sesjonstokenet. `baseTurns` er de VERIFISERTE turene
 * talen startet med (tomt når det ikke fantes noe gyldig token). Returnerer
 * mottakeren sidebandet skriver til.
 */
export function startVoiceHandoff(sessionToken: string, input: VoiceRecordingInput, now = Date.now()): LiveTranscriptSink {
  prune(now);
  const recording = createVoiceRecording(input);
  const entry: HandoffEntry = { recording, expiresAt: now + LIVE_SESSION_MAX_MS + HANDOFF_TTL_MS };
  recording.onClose = () => { entry.expiresAt = Date.now() + HANDOFF_TTL_MS; };
  store().set(sessionToken, entry);
  return recording.sink;
}

/** Kunden en pågående eller nylig avsluttet taleoverføring tilhører, eller null. */
export function voiceHandoffCustomer(sessionToken: string, now = Date.now()): string | null {
  const entry = store().get(sessionToken);
  return entry && entry.expiresAt > now ? entry.recording.customerId : null;
}

/**
 * Nytt signert historikktoken av turene før talen pluss det sesjonen faktisk
 * sa og hørte. `ok: false` når sesjonen er ukjent, utløpt eller tilhører en
 * annen besøkende — kallstedet skal da si ærlig fra, ikke late som.
 */
export function issueVoiceHandoff(sessionToken: string, visitorId: string, now = Date.now()): VoiceHandoffResult {
  const entry = store().get(sessionToken);
  if (!entry || entry.expiresAt <= now) return { ok: false };
  return entry.recording.issue(visitorId);
}
