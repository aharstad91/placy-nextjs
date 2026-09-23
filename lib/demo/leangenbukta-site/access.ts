import "server-only";

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * Tilgangen til Leangenbukta-kundedemoen (2026-09-23).
 *
 * ## Hva som beskyttes
 *
 * Nettsidekopien, Leangenbukta-boardet, tekstchatten og Leangenbuktas
 * stemmesamtale bruker SAMME tilgang: én kode gir én signert, tidsavgrenset
 * httpOnly-cookie, og alle fire flatene leser den samme cookien. En kunde logger
 * inn én gang og kan gå fritt mellom kopien, boardet og chatten.
 *
 * ## Tre tilstander, og hvorfor den tredje feiler lukket
 *
 * 1. **Konfigurert** (`PLACY_LB_DEMO_ACCESS_CODE` og
 *    `PLACY_LB_DEMO_COOKIE_SECRET` satt): cookie kreves overalt, også lokalt.
 *    Slik prøves produksjonsatferden på localhost før noe deles.
 * 2. **Ukonfigurert utviklingsserver**: bare loopback slipper inn, som den
 *    gamle `notFound()`-gaten. Ingen kode trengs for å jobbe lokalt.
 * 3. **Ukonfigurert produksjonsbygg**: ingen slipper inn. Et deploy der noen
 *    har glemt miljøvariablene skal gi 404, ikke en åpen demo.
 *
 * Host-headeren brukes bare i tilstand 2, som aldri gjelder et produksjonsbygg.
 * En forfalsket `Host: localhost` mot en delt demo gir derfor ingenting.
 */

export const LB_DEMO_COOKIE = "placy_lb_demo";
export const LB_DEMO_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;
export const LB_DEMO_ACCESS_PATH = "/demo/leangenbukta-tilgang";

const MIN_CODE_LENGTH = 12;
const MIN_SECRET_LENGTH = 32;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export interface LbDemoVisitor {
  /** Stabil per cookie; brukes til kvoter, aldri til å lagre innhold. */
  visitorId: string;
  /** `local` = ukonfigurert utviklingsserver, `code` = gyldig cookie. */
  via: "local" | "code";
}

interface AccessConfig {
  code: string;
  secret: string;
}

interface CookiePayload {
  v: 1;
  visitorId: string;
  exp: number;
  /** Hash av koden cookien ble utstedt for: ny kode ugyldiggjør gamle cookies. */
  code: string;
}

function config(): AccessConfig | null {
  const code = process.env.PLACY_LB_DEMO_ACCESS_CODE ?? "";
  const secret = process.env.PLACY_LB_DEMO_COOKIE_SECRET ?? "";
  if (code.length < MIN_CODE_LENGTH || secret.length < MIN_SECRET_LENGTH) return null;
  return { code, secret };
}

function constantTimeEqual(a: string, b: string): boolean {
  const first = createHash("sha256").update(a).digest();
  const second = createHash("sha256").update(b).digest();
  return timingSafeEqual(first, second);
}

function codeVersion(code: string): string {
  return createHash("sha256").update(`lb-demo:${code}`).digest("hex").slice(0, 32);
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/** Om demoen krever kode. Falsk betyr enten lokal utvikling eller lukket prod. */
export function lbDemoAccessConfigured(): boolean {
  return config() !== null;
}

/**
 * Bytter en innskrevet kode mot en cookieverdi, eller null ved feil kode.
 * Kallstedet setter cookien; denne funksjonen vet ingenting om HTTP.
 */
export function issueLbDemoCookie(code: string, now = Date.now()): string | null {
  const cfg = config();
  if (!cfg || typeof code !== "string" || code.length === 0 || code.length > 256) return null;
  if (!constantTimeEqual(code.trim(), cfg.code)) return null;
  const payload: CookiePayload = {
    v: 1,
    visitorId: randomUUID(),
    exp: now + LB_DEMO_MAX_AGE_SECONDS * 1000,
    code: codeVersion(cfg.code),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, cfg.secret)}`;
}

export function verifyLbDemoCookie(token: string | undefined | null, now = Date.now()): LbDemoVisitor | null {
  const cfg = config();
  if (!cfg || !token || token.length > 1024) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !constantTimeEqual(parts[1], sign(parts[0], cfg.secret))) return null;
  try {
    const value = JSON.parse(Buffer.from(parts[0], "base64url").toString()) as Partial<CookiePayload>;
    if (value.v !== 1 || typeof value.visitorId !== "string" || !/^[0-9a-f-]{36}$/.test(value.visitorId)) return null;
    if (value.code !== codeVersion(cfg.code)) return null;
    if (typeof value.exp !== "number" || !Number.isFinite(value.exp)) return null;
    if (value.exp <= now || value.exp > now + LB_DEMO_MAX_AGE_SECONDS * 1000) return null;
    return { visitorId: value.visitorId, via: "code" };
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
 * Tilgangen for én forespørsel, ut fra cookie- og host-headeren.
 *
 * Tar headerverdiene og ikke et `Request`, slik at både proxyen, ruter og
 * serverkomponenter (via `headers()`) kan bruke samme avgjørelse.
 */
export function lbDemoAccessFromHeaders(
  input: { cookie: string | null; host: string | null },
  now = Date.now(),
): LbDemoVisitor | null {
  if (config()) return verifyLbDemoCookie(readCookie(input.cookie, LB_DEMO_COOKIE), now);
  if (process.env.NODE_ENV === "production") return null;
  return isLoopback(input.host) ? { visitorId: "local", via: "local" } : null;
}

export function lbDemoAccess(request: Request, now = Date.now()): LbDemoVisitor | null {
  return lbDemoAccessFromHeaders(
    { cookie: request.headers.get("cookie"), host: request.headers.get("host") ?? new URL(request.url).host },
    now,
  );
}

/**
 * Adressen kunden sender tilbakemeldinger til. Miljøstyrt fordi det er Andreas
 * som bestemmer hvilken innboks en kundetest skal lande i.
 */
export function lbDemoFeedbackEmail(): string {
  const value = process.env.PLACY_LB_DEMO_FEEDBACK_EMAIL ?? "";
  return /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(value) ? value : "hei@placy.no";
}

/** Bare stier inne i demoen kan være mål etter innlogging — aldri en ekstern URL. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/demo/leangenbukta-") || value.startsWith("//") || value.includes("\\")) {
    return "/demo/leangenbukta-nettside";
  }
  if (value.startsWith(LB_DEMO_ACCESS_PATH)) return "/demo/leangenbukta-nettside";
  return value;
}
