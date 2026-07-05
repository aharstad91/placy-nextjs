#!/usr/bin/env npx tsx
/**
 * verify:log-event — kontrollert rund-tur-verifikasjon av instrumenterings-
 * kjeden (PRD 13, post-audit-fiks a7737b3) mot PROD v2.events.
 *
 * Gjør NØYAKTIG dette:
 *   1. teller events (baseline)
 *   2. logger ETT event via den EKTE logEvent-kjeden med komplett ny form:
 *      klient-stil sessionId (UUID v4) + projectId + kontekst-konvolutt
 *      (payload.context) + test-merking (payload.test=true + unik verify_run)
 *   3. leser raden tilbake via service-role og verifiserer HVERT felt
 *   4. sletter KUN sin egen rad (id-basert)
 *   5. verifiserer at events-count er netto uendret
 *
 * RØRER ALDRI andre rader. De 19 eksisterende pre-fiks-radene er
 * Andreas-gated (DECISIONS-QUEUE #1) og skal ikke slettes her.
 *
 * Kjøring (env MÅ eksporteres — tsx-mot-prod-mønsteret):
 *   set -a; source .env.local; set +a; npx tsx scripts/verify-log-event.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "node:crypto";
import { logEvent } from "../lib/instrumentation/log-event";
import type { EngagementContextEnvelope } from "../lib/instrumentation/event-types";
import { createServerClient } from "../lib/supabase/client";

const VERIFY_RUN = randomUUID();
const SESSION_ID = randomUUID(); // klient-stil økt-nøkkel (engagement-scope-mønsteret)
const PROJECT_ID = `verify-script-${VERIFY_RUN.slice(0, 8)}`;

const ENVELOPE: EngagementContextEnvelope = {
  mode: "report",
  has_3d_addon: true,
  categories_presented: ["natur", "transport"],
  locale: "no",
};

interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

async function main(): Promise<void> {
  const checks: Check[] = [];
  const client = createServerClient();
  const db = client.schema("v2");

  // 1. Baseline-count
  const { count: before, error: countError } = await db
    .from("events")
    .select("id", { count: "exact", head: true });
  if (countError || before === null) {
    console.error("FEIL: klarte ikke telle events:", countError?.message);
    process.exit(1);
  }
  console.log(`Baseline: ${before} rader i v2.events`);

  // 2. Logg via den EKTE kjeden (fail-soft — verifiseres ved tilbakelesing)
  await logEvent({
    eventType: "board_viewed",
    projectId: PROJECT_ID,
    sessionId: SESSION_ID,
    payload: { test: true, verify_run: VERIFY_RUN, context: ENVELOPE },
  });

  // 3. Les tilbake på unik merking
  const { data: rows, error: readError } = await db
    .from("events")
    .select("id, event_type, project_id, session_id, payload, created_at")
    .eq("payload->>verify_run", VERIFY_RUN);

  if (readError) {
    console.error("FEIL: tilbakelesing feilet:", readError.message);
    process.exit(1);
  }

  checks.push({
    name: "nøyaktig ÉN rad skrevet",
    ok: rows?.length === 1,
    detail: `fant ${rows?.length ?? 0}`,
  });

  const row = rows?.[0] as
    | {
        id: string;
        event_type: string;
        project_id: string | null;
        session_id: string | null;
        payload: {
          test?: boolean;
          verify_run?: string;
          context?: EngagementContextEnvelope;
        } | null;
      }
    | undefined;

  if (row) {
    checks.push(
      { name: "event_type", ok: row.event_type === "board_viewed" },
      { name: "project_id båret gjennom", ok: row.project_id === PROJECT_ID },
      {
        name: "klient-sessionId brukt VERBATIM (isSessionIdShape-stien)",
        ok: row.session_id === SESSION_ID,
        detail: `db=${row.session_id?.slice(0, 8)}… forventet=${SESSION_ID.slice(0, 8)}…`,
      },
      { name: "payload.test=true (test-merking)", ok: row.payload?.test === true },
      {
        name: "kontekst-konvolutt komplett",
        ok:
          row.payload?.context?.mode === "report" &&
          row.payload?.context?.has_3d_addon === true &&
          JSON.stringify(row.payload?.context?.categories_presented) ===
            JSON.stringify(["natur", "transport"]) &&
          row.payload?.context?.locale === "no",
      }
    );

    // 4. Slett KUN egen rad (id-basert — aldri noe bredere)
    const { error: deleteError } = await db.from("events").delete().eq("id", row.id);
    checks.push({
      name: "egen test-rad slettet (id-basert)",
      ok: !deleteError,
      detail: deleteError?.message,
    });
  }

  // 5. Netto uendret
  const { count: after } = await db
    .from("events")
    .select("id", { count: "exact", head: true });
  checks.push({
    name: "events-count netto uendret",
    ok: after === before,
    detail: `før=${before} etter=${after}`,
  });

  // Rapport
  let failed = 0;
  for (const c of checks) {
    const mark = c.ok ? "✓" : "✗";
    console.log(`${mark} ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
    if (!c.ok) failed++;
  }
  console.log(
    failed === 0
      ? "\nALLE SJEKKER GRØNNE — logEvent-kjeden fungerer ende-til-ende mot prod."
      : `\n${failed} SJEKK(ER) RØDE — se over.`
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Uventet feil:", err);
  process.exit(1);
});
