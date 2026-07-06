// Volum-demping for Moat-2-ingest ("Innsikt"). Eid av PRD 13, audit-herding
// 2026-07-06.
//
// HVORFOR: `logEvent` er en `"use server"`-action (POST-endepunkt). Uten demping
// kan én angriper replaye emit-kallet i loop → millioner fake-events mot et kjent
// project_id → datasettet forgiftet + DoS-by-cost (én insert per kall).
//
// VALG (audit-arkitektur alt. A): IP er utilgjengelig i en server-action, så vi
// demper på nøkler vi HAR i inputen — `session_id` (klient-generert, én per
// board-mount) og `project_id`. To lag:
//   • per-økt:      en normal økt fyrer en håndfull events; et tak per session_id
//                   stopper replay av ÉN økt-nøkkel.
//   • per-prosjekt: en angriper som roterer ferske UUID-er mot ETT project_id
//                   omgår per-økt-taket — derfor et (romsligere) tak per project_id.
// Begge er in-memory fixed-window, samme mønster som lib/utils/rate-limit.ts
// (bevisst for prototype-stadiet: kvote-vern mot enkel misbruk, ikke distribuert
// garanti). Fail-open ved manglende nøkkel: et event uten project_id (degradert
// sti) skal ikke blokkeres — demping er misbruks-vern, ikke funksjonell gate.

import { createRateLimiter } from "@/lib/utils/rate-limit";

// Per board-mount fyrer emit-sitene noen få events (board_viewed + kategori-/poi-/
// voiceover-interaksjoner). 120/min per økt er langt over reell bruk, men kveler
// en replay-loop mot én økt-nøkkel.
const PER_SESSION_LIMIT = 120;
// Et travelt board med mange samtidige besøkende genererer legitimt mange events
// mot samme project_id. 2000/min er raust for ekte trafikk, men stopper en angriper
// som roterer session-id-er mot ett kjent project_id.
const PER_PROJECT_LIMIT = 2000;
const WINDOW_MS = 60_000;

const sessionLimiter = createRateLimiter({ limit: PER_SESSION_LIMIT, windowMs: WINDOW_MS });
const projectLimiter = createRateLimiter({ limit: PER_PROJECT_LIMIT, windowMs: WINDOW_MS });

/**
 * True = eventet er innenfor volum-grensene og kan skrives. False = demp (drop).
 * Sjekker begge lag; ETHVERT lag over grensen → drop. Manglende nøkkel hopper
 * over det laget (fail-open) — degraderte events blokkeres aldri av dempingen.
 */
export function allowEvent(keys: {
  sessionId?: string;
  projectId?: string;
}): boolean {
  if (keys.sessionId && !sessionLimiter.check(`s:${keys.sessionId}`)) {
    return false;
  }
  if (keys.projectId && !projectLimiter.check(`p:${keys.projectId}`)) {
    return false;
  }
  return true;
}
