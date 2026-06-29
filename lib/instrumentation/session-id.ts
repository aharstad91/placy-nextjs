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

/** Genererer en ny anonym økt-nøkkel for én board-render-økt. */
export function generateSessionId(): string {
  return randomUUID();
}
