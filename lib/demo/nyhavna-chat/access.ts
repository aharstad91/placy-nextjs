import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { constantTimeEqual } from "@/lib/live/hosted-access";

/**
 * Tilgangen til chatten på Nyhavna-nettsidekopien (2026-09-24).
 *
 * ## Hvorfor ikke Leangenbuktas kode-cookie
 *
 * Leangenbukta-kopien ligger bak en tilgangskode. Nyhavna-kopien
 * (`/demo/nyhavna-nettside`) er en åpen side som allerede er delt; å legge en
 * innlogging foran den ville endret en leveranse som er i bruk. Chatten får
 * derfor en egen, anonym besøks-ID i en signert httpOnly-cookie, og kostnaden
 * begrenses av tre lag: chatten må slås eksplisitt på, en samlet døgnkvote i
 * et sentralt lager, og OpenAI-prosjektets harde spendtak.
 *
 * Den per-besøkende kvoten og historikkbindingen er ekte (to besøkende kan
 * aldri dele historikk), men en besøkende som sletter cookien får en ny ID.
 * Derfor er den SAMLEDE døgnkvoten den reelle grensen på en åpen side.
 *
 * ## Tre tilstander, og hvorfor den tredje feiler lukket
 *
 * 1. **Slått på** (`PLACY_NH_CHAT_ENABLED=true` og
 *    `PLACY_NH_CHAT_COOKIE_SECRET` ≥ 32 tegn): signert besøkscookie kreves
 *    og utstedes ved første kall. Slik prøves produksjonsatferden lokalt.
 * 2. **Ukonfigurert utviklingsserver**: bare loopback slipper inn, som
 *    besøkende `local`. Ingen konfigurasjon trengs for å jobbe lokalt.
 * 3. **Ukonfigurert produksjonsbygg**: chatten finnes ikke (404). Et deploy
 *    der noen har glemt miljøvariablene skal ikke få en åpen, betalt chat.
 *
 * Leangenbuktas cookie gir ingen tilgang her, og omvendt.
 */

export const NH_CHAT_COOKIE = "placy_nh_chat";
export const NH_CHAT_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

const MIN_SECRET_LENGTH = 32;
const VISITOR_ID_RE = /^[0-9a-f-]{36}$/;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export interface NhChatVisitor {
  visitorId: string;
  via: "local" | "cookie";
}

interface CookiePayload {
  v: 1;
  visitorId: string;
  exp: number;
}

function secret(): string | null {
  if (process.env.PLACY_NH_CHAT_ENABLED !== "true") return null;
  const value = process.env.PLACY_NH_CHAT_COOKIE_SECRET ?? "";
  return value.length >= MIN_SECRET_LENGTH ? value : null;
}

/** Om chatten er slått på med en signeringsnøkkel (tilstand 1). */
export function nhChatConfigured(): boolean {
  return secret() !== null;
}

/** Om chatten finnes i dette miljøet: slått på, eller en utviklingsserver. */
export function nhChatEnabled(): boolean {
  return nhChatConfigured() || process.env.NODE_ENV !== "production";
}

/**
 * Om stemmen i chatboksen kan brukes i et produksjonsbygg. Krever i tillegg
 * `PLACY_NH_CHAT_VOICE=true`, og går bare gjennom den delte stemmen
 * (`/api/live/control` med `PLACY_HOSTED_VOICE=true`): varig opptak, budsjett
 * og regnskap for prosjektet `nyhavna` (`lib/live/hosted-chat.ts`). Den lokale
 * ruta er aldri åpen for Nyhavna-besøkende utenfor en utviklingsserver.
 */
export function nhChatVoiceEnabled(): boolean {
  return nhChatConfigured() && process.env.PLACY_NH_CHAT_VOICE === "true";
}

function sign(body: string, key: string): string {
  return createHmac("sha256", key).update(body).digest("base64url");
}

/** Ny signert besøkscookie-verdi, eller null når chatten ikke er slått på. */
export function issueNhChatCookie(now = Date.now()): { value: string; visitorId: string } | null {
  const key = secret();
  if (!key) return null;
  const payload: CookiePayload = { v: 1, visitorId: randomUUID(), exp: now + NH_CHAT_MAX_AGE_SECONDS * 1000 };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { value: `${body}.${sign(body, key)}`, visitorId: payload.visitorId };
}

export function verifyNhChatCookie(token: string | undefined | null, now = Date.now()): NhChatVisitor | null {
  const key = secret();
  if (!key || !token || token.length > 512) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !constantTimeEqual(parts[1], sign(parts[0], key))) return null;
  try {
    const value = JSON.parse(Buffer.from(parts[0], "base64url").toString()) as Partial<CookiePayload>;
    if (value.v !== 1 || typeof value.visitorId !== "string" || !VISITOR_ID_RE.test(value.visitorId)) return null;
    if (typeof value.exp !== "number" || !Number.isFinite(value.exp)) return null;
    if (value.exp <= now || value.exp > now + NH_CHAT_MAX_AGE_SECONDS * 1000) return null;
    return { visitorId: value.visitorId, via: "cookie" };
  } catch {
    return null;
  }
}

function readCookie(cookieHeader: string | null, name: string): string | undefined {
  return cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function isLoopback(hostHeader: string | null): boolean {
  if (!hostHeader) return false;
  try {
    return LOOPBACK.has(new URL(`http://${hostHeader}`).hostname);
  } catch {
    return false;
  }
}

/**
 * Den besøkende for én forespørsel, uten å utstede noe. Brukes av stemmens
 * ruter: talen kan bare startes av en besøkende chatten allerede kjenner.
 */
export function nhChatVisitor(request: Request, now = Date.now()): NhChatVisitor | null {
  if (nhChatConfigured()) return verifyNhChatCookie(readCookie(request.headers.get("cookie"), NH_CHAT_COOKIE), now);
  if (process.env.NODE_ENV === "production") return null;
  const host = request.headers.get("host") ?? new URL(request.url).host;
  return isLoopback(host) ? { visitorId: "local", via: "local" } : null;
}

/**
 * Tekstchattens tilgang: den kjente besøkende, eller — når chatten er slått på
 * og cookien mangler eller er ugyldig — en ny anonym besøkende med cookien som
 * skal settes på svaret.
 */
export function nhChatAccess(request: Request, now = Date.now()): { visitor: NhChatVisitor; setCookie?: string } | null {
  const known = nhChatVisitor(request, now);
  if (known) return { visitor: known };
  const issued = issueNhChatCookie(now);
  if (!issued) return null;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return {
    visitor: { visitorId: issued.visitorId, via: "cookie" },
    setCookie: `${NH_CHAT_COOKIE}=${issued.value}; Path=/; Max-Age=${NH_CHAT_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`,
  };
}
