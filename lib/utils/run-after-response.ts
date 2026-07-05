/**
 * Kjør arbeid ETTER at HTTP-svaret er sendt — in-process, uten jobbkø.
 *
 * Ratifisert async-grense (PRD 3 Unit 8, 2026-06-29): svaret returnerer
 * umiddelbart, pipelinen fullfører i samme prosess. Beslutningen nevnte
 * `unstable_after()` — det API-et finnes først i Next 15 (ikke 14.2.35),
 * så semantikken implementeres her i stedet:
 *
 * - På Vercel: plukker opp request-contextens `waitUntil` (samme mekanisme
 *   som `@vercel/functions`) så funksjonen holdes i live til arbeidet er
 *   ferdig (opp til rutas `maxDuration`).
 * - Lokalt/self-host (langlevd Node-prosess): promiset kjører videre av
 *   seg selv etter svaret.
 *
 * Feil svelges med logging — kalleren eier sin egen feilhåndtering (f.eks.
 * status-oppdatering til failed) INNE i tasken.
 */

interface VercelRequestContext {
  waitUntil?: (promise: Promise<unknown>) => void;
}

const VERCEL_REQUEST_CONTEXT = Symbol.for("@vercel/request-context");

export function runAfterResponse(task: () => Promise<void>): void {
  const promise = task().catch((err) => {
    console.error("[runAfterResponse] Uventet feil i etter-svar-arbeid:", err);
  });

  const holder = (
    globalThis as { [VERCEL_REQUEST_CONTEXT]?: { get?: () => VercelRequestContext } }
  )[VERCEL_REQUEST_CONTEXT];
  holder?.get?.()?.waitUntil?.(promise);
}
