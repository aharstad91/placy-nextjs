/**
 * Kjør arbeid ETTER at HTTP-svaret er sendt — in-process, uten jobbkø.
 *
 * Ratifisert async-grense (PRD 3 Unit 8, 2026-06-29): svaret returnerer
 * umiddelbart, pipelinen fullfører i samme prosess. Beslutningen nevnte
 * `unstable_after()` — fra Next 16 er API-et stabilt som `after()` fra
 * `next/server`, og helperen delegerer dit:
 *
 * - `after()` holder funksjonen i live til arbeidet er ferdig (opp til
 *   rutas `maxDuration`) — på Vercel OG self-host/dev.
 * - Utenfor request-scope (f.eks. enhetstester som kaller helperen direkte)
 *   kaster `after()` — da faller vi tilbake til et frikoblet promise pluss
 *   Vercel-request-contextens `waitUntil` der den finnes.
 *
 * Feil svelges med logging — kalleren eier sin egen feilhåndtering (f.eks.
 * status-oppdatering til failed) INNE i tasken.
 */

import { after } from "next/server";

interface VercelRequestContext {
  waitUntil?: (promise: Promise<unknown>) => void;
}

const VERCEL_REQUEST_CONTEXT = Symbol.for("@vercel/request-context");

export function runAfterResponse(task: () => Promise<void>): void {
  const run = () =>
    task().catch((err) => {
      console.error("[runAfterResponse] Uventet feil i etter-svar-arbeid:", err);
    });

  try {
    after(run);
  } catch {
    const promise = run();
    const holder = (
      globalThis as { [VERCEL_REQUEST_CONTEXT]?: { get?: () => VercelRequestContext } }
    )[VERCEL_REQUEST_CONTEXT];
    holder?.get?.()?.waitUntil?.(promise);
  }
}
