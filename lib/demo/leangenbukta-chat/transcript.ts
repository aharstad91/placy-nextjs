import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { constantTimeEqual } from "@/lib/live/hosted-access";

/**
 * Samtaletokenet tekstchatten og talen sender frem og tilbake (2026-09-23, utvidet 2026-09-24).
 *
 * ## Hvorfor et signert token og ikke en serversesjon
 *
 * Serveren lagrer ingen samtaler (se `lib/demo/leangenbukta-chat/backend.ts`).
 * Historikken må derfor bæres av klienten mellom kall, men den kan ikke være
 * ren tekst i klienten: en besøkende skal ikke kunne dikte opp at «assistenten»
 * har sagt noe den aldri har sagt, og to besøkende skal aldri kunne dele
 * historikk ved å bytte token. Et HMAC-signert token løser begge: bare
 * serveren kan skrive et gyldig token, og payloaden binder historikken til
 * ÉN besøkende og ÉN innholdsversjon.
 *
 * ## Én samtale på tvers av skriving og tale
 *
 * Samme token bærer både skrevne og talte turer (`via`). Tekstchatten utsteder
 * det etter hvert svar; ved oppstart av tale verifiseres det og legges inn som
 * Live-sesjonens `session.input`; når talen er slutt utsteder serveren et nytt
 * token av det sidebandet selv hørte (`voice-handoff.ts`). Assistentens talte
 * turer kommer bare fra serverens egen transkripsjon, aldri fra klienten.
 *
 * ## Vinduet
 *
 * Historikken er et glidende vindu: høyst `MAX_TURNS` turer, høyst
 * `MAX_TOTAL_CHARS` tegn og høyst `MAX_TOTAL_BYTES` UTF-8-byte til sammen;
 * eldste turer faller ut først. `trimmed`
 * sier at noe har falt ut, så UI-et aldri lover at hele samtalen huskes.
 * Bytegrensen holder også Unicode-tunge meldinger under Live sitt tak på
 * 8 192 tokens for `session.input`, og under grensen for et signert token.
 *
 * ## Hemmeligheten
 *
 * Samme mønster som `lib/demo/leangenbukta-site/access.ts`: en konfigurert
 * `PLACY_LB_DEMO_COOKIE_SECRET` brukes når den finnes (også i produksjon), og
 * en tilfeldig prosess-hemmelighet dekker lokal utvikling uten konfigurasjon.
 * Prosess-hemmeligheten er ny ved hver serverstart, så gamle tokens fra en
 * tidligere økt blir ugyldige helt av seg selv — det er riktig oppførsel, ikke
 * en feil, siden ingenting annet husker den økten heller.
 */

const MIN_SECRET_LENGTH = 32;
export const MAX_TURNS = 40;
export const MAX_TOTAL_CHARS = 12000;
export const MAX_TOTAL_BYTES = 8000;
const MAX_TEXT_LENGTH = 2000;
/** Base64 av høyst 8 000 tekstbyte pluss 40 turers JSON-omslag, med margin. */
export const MAX_TRANSCRIPT_TOKEN_LENGTH = 24576;

export interface TranscriptTurn {
  role: "user" | "assistant";
  text: string;
  /** Hvor turen skjedde. Utelatt = skrevet (alle tokens fra før talen fantes). */
  via?: "voice";
}

interface TranscriptPayload {
  v: 1;
  visitorId: string;
  snapshotId: string;
  turns: TranscriptTurn[];
  /** Eldre turer har falt ut av vinduet. */
  trimmed?: boolean;
}

/** Resultatet av en gyldig dekoding: hvilket innhold den ble bygget for, turene, og om vinduet har klippet. */
export interface VerifiedTranscript {
  snapshotId: string;
  turns: TranscriptTurn[];
  trimmed: boolean;
}

let devSecret: string | null = null;

function secret(): string {
  // Nyhavna-kopien (2026-09-24) bruker samme token med sin egen nøkkel når
  // Leangenbuktas ikke er satt. Tokenet binder uansett besøkende OG
  // innholdsversjon, så en nøkkel delt mellom kopiene lar ingen historikk
  // krysse fra den ene demoen til den andre.
  for (const configured of [process.env.PLACY_LB_DEMO_COOKIE_SECRET ?? "", process.env.PLACY_NH_CHAT_COOKIE_SECRET ?? ""]) {
    if (configured.length >= MIN_SECRET_LENGTH) return configured;
  }
  devSecret ??= randomBytes(32).toString("hex");
  return devSecret;
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

/**
 * Legger nye turer etter de forrige og klipper til vinduet: først antall, så
 * samlet lengde, eldste først. Tomme turer droppes; lange kappes per tur.
 */
export function windowTurns(
  previous: readonly TranscriptTurn[],
  added: readonly TranscriptTurn[],
): { turns: TranscriptTurn[]; trimmed: boolean } {
  const all = [...previous, ...added]
    .map((turn) => ({ ...turn, text: turn.text.trim().slice(0, MAX_TEXT_LENGTH) }))
    .filter((turn) => turn.text);
  let turns = all.slice(-MAX_TURNS);
  let total = turns.reduce((sum, turn) => sum + turn.text.length, 0);
  let bytes = turns.reduce((sum, turn) => sum + Buffer.byteLength(turn.text, "utf8"), 0);
  while (turns.length > 1 && (total > MAX_TOTAL_CHARS || bytes > MAX_TOTAL_BYTES)) {
    total -= turns[0].text.length;
    bytes -= Buffer.byteLength(turns[0].text, "utf8");
    turns = turns.slice(1);
  }
  return { turns, trimmed: turns.length < all.length };
}

/**
 * Bygger neste token av forrige turer pluss de nye. Kalles etter et FERDIG
 * tekstsvar eller når en talesamtale er avsluttet, aldri med turer klienten
 * selv har påstått at assistenten sa.
 */
export function issueTranscript(input: {
  visitorId: string;
  snapshotId: string;
  previousTurns: readonly TranscriptTurn[];
  newTurns: readonly TranscriptTurn[];
  /** Forrige token hadde alt klippet bort eldre turer. */
  previousTrimmed?: boolean;
}): string {
  const window = windowTurns(input.previousTurns, input.newTurns);
  const payload: TranscriptPayload = {
    v: 1,
    visitorId: input.visitorId,
    snapshotId: input.snapshotId,
    turns: window.turns,
    ...(window.trimmed || input.previousTrimmed ? { trimmed: true } : {}),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/**
 * Dekoder og verifiserer et token for AKKURAT denne besøkende.
 *
 * Returnerer `null` ved ugyldig signatur, feil form, eller en annen
 * besøkendes token — kallstedet starter da uten historikk, i tråd med R10
 * («to besøkende kan aldri dele historikk»). Et gyldig token med en annen
 * `snapshotId` enn den kallstedet forventer returneres derimot slik det er:
 * det er kallstedets ansvar å oversette det til en 409, ikke denne funksjonens.
 */
export function verifyTranscript(token: string | null | undefined, visitorId: string): VerifiedTranscript | null {
  if (!token || token.length > MAX_TRANSCRIPT_TOKEN_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!constantTimeEqual(signature, sign(body))) return null;
  try {
    const value = JSON.parse(Buffer.from(body, "base64url").toString()) as Partial<TranscriptPayload>;
    if (value.v !== 1 || typeof value.visitorId !== "string" || typeof value.snapshotId !== "string" || !Array.isArray(value.turns)) return null;
    if (value.visitorId !== visitorId) return null;
    if (value.turns.length > MAX_TURNS) return null;
    const turns = value.turns.filter(
      (turn): turn is TranscriptTurn =>
        Boolean(turn) && (turn.role === "user" || turn.role === "assistant") && typeof turn.text === "string"
        && turn.text.length <= MAX_TEXT_LENGTH && (turn.via === undefined || turn.via === "voice"),
    );
    if (turns.length !== value.turns.length) return null;
    return { snapshotId: value.snapshotId, turns, trimmed: value.trimmed === true };
  } catch {
    return null;
  }
}
