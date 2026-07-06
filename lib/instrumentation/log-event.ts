"use server";

// Engasjements-logger (server-action-grensen). Eid av PRD 13 (§5.3 / Unit 2).
// Skriver til v2.events via service-role-klienten — aldri klient→Supabase direkte.

import { createServerClient } from "@/lib/supabase/client";
import { type EventType } from "./event-types";
import { generateSessionId, isSessionIdShape } from "./session-id";
import { parseLogEventInput } from "./event-schema";
import { allowEvent } from "./event-throttle";

export interface LogEventInput {
  eventType: EventType;
  projectId?: string;
  productId?: string;
  poiId?: string; // kun for poi_clicked
  payload?: Record<string, unknown>; // { category_id, context } | { voiceover_segment, context } | ...
  /**
   * Klient-generert økt-nøkkel (én per board-mount, engagement-scope.tsx).
   * Valideres med `isSessionIdShape` — ugyldig/fraværende → fersk server-id
   * (eventet beholdes, grupperingen degraderes for akkurat det eventet).
   */
  sessionId?: string;
}

/**
 * Fire-and-forget / FAIL-SOFT engasjements-logger.
 *
 * Et feilet event-INSERT skal ALDRI velte board-rendringen — instrumentering er
 * observabilitet, ikke en kritisk skrivesti. HELE kroppen (inkl. selve
 * createServerClient()-oppslaget) er derfor i try/catch: PRD 1 Beslutning 10 lar
 * createServerClient() fail-FAST-e ved manglende SUPABASE_SERVICE_ROLE_KEY (riktig
 * for provisjon/admin), men her fail-SOFTer vi rundt det kastet. Feil logges (ingen
 * stille swallow — CLAUDE.md), men kastes aldri videre. Tier-agnostisk (G6).
 *
 * session_id (§5.4): emit-sitene deler ÉN klient-generert økt-nøkkel per
 * board-mount via `EngagementEmitter` (engagement-scope.tsx) — det er den som
 * grupperer en økts events for aggregering. Server-side håndheves KUN formen
 * (opaque UUID v4 via `isSessionIdShape`); ugyldig/fraværende → fersk
 * server-generert id. Personvern-invarianten (anonym, ikke-PII, aldri
 * persistert på tvers av økter) holder i begge stier.
 */
export async function logEvent(input: LogEventInput): Promise<void> {
  try {
    // (1) SKJEMA-VALIDERING (audit-herding 2026-07-06): inputen valideres FØR
    // insert. Kjent event_type + typet payload per event-type (ukjente PAYLOAD-
    // nøkler avvist), id-feltene på forventet form, total-størrelse kappet.
    // Ugyldig → stille drop (fail-soft: aldri kast mot kalleren). `sessionId`
    // plukkes bevisst IKKE av validatoren — den valideres på FORM under og
    // degraderer (fersk server-id) i stedet for å droppe eventet.
    const parsed = parseLogEventInput(input);
    if (!parsed.ok) {
      console.warn(`[logEvent] input avvist av validering: ${parsed.reason}`);
      return;
    }
    const clean = parsed.data;

    // (2) session_id (§5.4): kun FORMEN håndheves (opaque UUID v4). Ugyldig/
    // fraværende → fersk server-id (eventet beholdes, kun grupperingen degraderes).
    const sessionId = isSessionIdShape(input.sessionId)
      ? input.sessionId
      : generateSessionId();

    // (3) VOLUM-DEMPING (audit-herding 2026-07-06): kveler replay-loops mot et
    // kjent project_id. Dempet event droppes stille — fail-soft-kontrakten holder
    // (ingen kast, render uberørt). Se event-throttle.ts for lag-valget.
    if (!allowEvent({ sessionId, projectId: clean.projectId })) {
      return;
    }

    const client = createServerClient();
    const { error } = await client
      .schema("v2")
      .from("events")
      .insert({
        event_type: clean.eventType,
        project_id: clean.projectId ?? null,
        product_id: clean.productId ?? null,
        poi_id: "poiId" in clean ? (clean.poiId ?? null) : null,
        // payload er nå et validert, typet objekt — ingen `as never`-cast lenger.
        payload: clean.payload ?? null,
        session_id: sessionId,
      });

    if (error) {
      console.error("[logEvent] INSERT mot v2.events feilet:", error.message);
    }
  } catch (err) {
    console.error("[logEvent] uventet feil (fail-soft, render uberørt):", err);
  }
}
