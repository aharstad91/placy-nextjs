// Anonym, ikke-personidentifiserende økt-nøkkel for instrumentering.
// Eid av PRD 13 (§5.4, G3). Landet beslutning: PRD 1 deferret `events.session_id`-
// kilden hit (PRD 1 Åpent spørsmål #5).
//
// KONTRAKT:
//  • Generert SERVER-SIDE (importen av `node:crypto` håndhever dette — modulen
//    kan ikke lastes i klient/edge-bundle).
//  • En opaque random-verdi (UUID v4) per board-render-økt. IKKE knyttet til IP,
//    e-post eller bruker-id; INGEN determinisme fra request-metadata → kan ikke
//    re-identifisere en person.
//  • IKKE persistert som tverr-økt-identifikator (genereres ferskt per økt).
//  • ALDRI lagret i Zustand (CLAUDE.md — ingen sensitiv data i store); lever kun
//    server-side / i `events`-raden.
//  • Ingen cookie-samtykke kreves: nøkkelen er anonym per personvern-kontrakten
//    (PRD 1 «NY tabell — events»: «ingen individuell tracking uten samtykke»).

import { randomUUID } from "node:crypto";

/**
 * Genererer en ny anonym økt-nøkkel. Server-side FALLBACK: den primære økt-
 * nøkkelen genereres nå KLIENT-side, én per board-mount (engagement-scope.tsx,
 * audit-fiks 2026-07-05) og valideres her med `isSessionIdShape` — denne
 * funksjonen brukes når kalleren ikke leverer en gyldig id.
 */
export function generateSessionId(): string {
  return randomUUID();
}

// UUID v4-form (lowercase hex) — formen `crypto.randomUUID()` produserer i
// både Node og nettleser.
const SESSION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Shape-guard for klient-leverte økt-nøkler: aksepter kun opaque UUID v4 så
 * en manipulert klient ikke kan smugle vilkårlige strenger (PII, injection-
 * forsøk) inn i `events.session_id`. Ugyldig form → kalleren faller tilbake
 * til `generateSessionId()` (eventet beholdes, kun grupperingen degraderes).
 */
export function isSessionIdShape(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID_RE.test(value);
}
