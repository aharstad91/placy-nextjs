"use server";

// Engasjements-logger (server-action-grensen). Eid av PRD 13 (§5.3 / Unit 2).
// Skriver til v2.events via service-role-klienten — aldri klient→Supabase direkte.

import { createServerClient } from "@/lib/supabase/client";
import { isEventType, type EventType } from "./event-types";
import { generateSessionId } from "./session-id";

export interface LogEventInput {
  eventType: EventType;
  projectId?: string;
  productId?: string;
  poiId?: string; // kun for poi_clicked
  payload?: Record<string, unknown>; // { category_id } | { voiceover_segment } | ...
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
 * session_id injiseres server-side (§5.4) og settes ALDRI av kalleren. NB: id-en
 * genereres per kall i denne baselinen; deling på tvers av events i SAMME board-
 * render-økt (gruppering for aggregering) wires inn når PRD 9 etablerer render-
 * sesjons-konteksten (emit-sites, Unit 5). Personvern-invarianten (anonym, ikke-PII,
 * ikke persistert) holder uansett.
 */
export async function logEvent(input: LogEventInput): Promise<void> {
  try {
    if (!isEventType(input.eventType)) {
      console.warn(`[logEvent] ukjent event_type avvist: ${String(input.eventType)}`);
      return;
    }

    const client = createServerClient();
    const { error } = await client
      .schema("v2")
      .from("events")
      .insert({
        event_type: input.eventType,
        project_id: input.projectId ?? null,
        product_id: input.productId ?? null,
        poi_id: input.poiId ?? null,
        payload: (input.payload ?? null) as never,
        session_id: generateSessionId(),
      });

    if (error) {
      console.error("[logEvent] INSERT mot v2.events feilet:", error.message);
    }
  } catch (err) {
    console.error("[logEvent] uventet feil (fail-soft, render uberørt):", err);
  }
}
