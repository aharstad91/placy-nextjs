import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { constantTimeEqual } from "@/lib/live/hosted-access";

/**
 * Samtaletokenet tekstchatten sender frem og tilbake (2026-09-23).
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
const MAX_TURNS = 6;
const MAX_TOKEN_LENGTH = 8192;
const MAX_TEXT_LENGTH = 2000;

export interface TranscriptTurn {
  role: "user" | "assistant";
  text: string;
}

interface TranscriptPayload {
  v: 1;
  visitorId: string;
  snapshotId: string;
  turns: TranscriptTurn[];
}

/** Resultatet av en gyldig dekoding: hvem den gjelder, hvilket innhold den ble bygget for, og turene. */
export type VerifiedTranscript = Pick<TranscriptPayload, "snapshotId" | "turns">;

let devSecret: string | null = null;

function secret(): string {
  const configured = process.env.PLACY_LB_DEMO_COOKIE_SECRET ?? "";
  if (configured.length >= MIN_SECRET_LENGTH) return configured;
  devSecret ??= randomBytes(32).toString("hex");
  return devSecret;
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

/**
 * Bygger neste token av forrige turer pluss den nye vekslingen, klippet til de
 * siste `MAX_TURNS` turene. Kalles etter et FERDIG svar, aldri før.
 */
export function issueTranscript(input: {
  visitorId: string;
  snapshotId: string;
  previousTurns: readonly TranscriptTurn[];
  userText: string;
  assistantText: string;
}): string {
  const turns: TranscriptTurn[] = [
    ...input.previousTurns,
    { role: "user" as const, text: input.userText.slice(0, MAX_TEXT_LENGTH) },
    { role: "assistant" as const, text: input.assistantText.slice(0, MAX_TEXT_LENGTH) },
  ].slice(-MAX_TURNS);
  const payload: TranscriptPayload = { v: 1, visitorId: input.visitorId, snapshotId: input.snapshotId, turns };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/**
 * Dekoder og verifiserer et token for AKKURAT denne besøkende.
 *
 * Returnerer `null` ved ugyldig signatur, feil form, eller en annen
 * besøkendes token — kallstedet starter da uten historikk, stille, i tråd med
 * R10 («to besøkende kan aldri dele historikk»). Et gyldig token med en annen
 * `snapshotId` enn den kallstedet forventer returneres derimot slik det er:
 * det er kallstedets ansvar å oversette det til en 409, ikke denne funksjonens.
 */
export function verifyTranscript(token: string | null | undefined, visitorId: string): VerifiedTranscript | null {
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
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
        Boolean(turn) && (turn.role === "user" || turn.role === "assistant") && typeof turn.text === "string" && turn.text.length <= MAX_TEXT_LENGTH,
    );
    if (turns.length !== value.turns.length) return null;
    return { snapshotId: value.snapshotId, turns };
  } catch {
    return null;
  }
}
