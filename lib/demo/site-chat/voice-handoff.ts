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
 * ## Livstid og avgrensning
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

interface HandoffEntry {
  scope: TranscriptScope;
  visitorId: string;
  snapshotId: string;
  baseTurns: TranscriptTurn[];
  baseTrimmed: boolean;
  voiceTurns: TranscriptTurn[];
  lastRole: "user" | "assistant" | null;
  lastEndMs: number | null;
  closed: boolean;
  expiresAt: number;
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
 * Starter opptaket for én talesesjon. `baseTurns` er de VERIFISERTE turene
 * talen startet med (tomt når det ikke fantes noe gyldig token). Returnerer
 * mottakeren sidebandet skriver til.
 */
export function startVoiceHandoff(
  sessionToken: string,
  input: { scope: TranscriptScope; visitorId: string; snapshotId: string; baseTurns: readonly TranscriptTurn[]; baseTrimmed: boolean },
  now = Date.now(),
): LiveTranscriptSink {
  prune(now);
  const entry: HandoffEntry = {
    scope: input.scope,
    visitorId: input.visitorId,
    snapshotId: input.snapshotId,
    baseTurns: [...input.baseTurns],
    baseTrimmed: input.baseTrimmed,
    voiceTurns: [],
    lastRole: null,
    lastEndMs: null,
    closed: false,
    expiresAt: now + LIVE_SESSION_MAX_MS + HANDOFF_TTL_MS,
  };
  store().set(sessionToken, entry);

  const push = (role: "user" | "assistant", text: string) => {
    entry.voiceTurns.push({ role, text: text.slice(0, MAX_TURN_CHARS), via: "voice" });
    if (entry.voiceTurns.length > MAX_TURNS * 2) entry.voiceTurns.splice(0, entry.voiceTurns.length - MAX_TURNS * 2);
  };

  return {
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
      entry.expiresAt = Date.now() + HANDOFF_TTL_MS;
    },
  };
}

/** Kunden en pågående eller nylig avsluttet taleoverføring tilhører, eller null. */
export function voiceHandoffCustomer(sessionToken: string, now = Date.now()): string | null {
  const entry = store().get(sessionToken);
  return entry && entry.expiresAt > now ? entry.scope.customerId : null;
}

export type VoiceHandoffResult =
  | { ok: true; transcript: string; voiceTurns: number; trimmed: boolean }
  | { ok: false };

/**
 * Nytt signert historikktoken av turene før talen pluss det sesjonen faktisk
 * sa og hørte. `ok: false` når sesjonen er ukjent, utløpt eller tilhører en
 * annen besøkende — kallstedet skal da si ærlig fra, ikke late som.
 */
export function issueVoiceHandoff(sessionToken: string, visitorId: string, now = Date.now()): VoiceHandoffResult {
  const entry = store().get(sessionToken);
  if (!entry || entry.expiresAt <= now || entry.visitorId !== visitorId) return { ok: false };
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
}
