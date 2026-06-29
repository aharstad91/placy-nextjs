// Event-type-taksonomi — TS-siden av v2.events.event_type CHECK-constrainten.
// Eid av PRD 13 (instrumentering). Speiler startsettet i PRD 1 Unit 2 AC3
// (supabase/migrations/070_baseline.sql → events_event_type_check).
//
// 🔒 TO-STEGS UTVIDELSESGRENSE (drift-kontrakt): å legge til en ny event-type
// krever BÅDE (1) en ny migrasjon som utvider DB-CHECK-en (PRD 1 Unit 2 AC3:
// «utvidbart via senere migrasjon») OG (2) en bump av EVENT_TYPES her. Hold dem
// synkrone — koden må ALDRI sende en event_type DB-CHECK-en avviser.

export const EVENT_TYPES = [
  "board_viewed",
  "category_opened",
  "voiceover_played",
  "poi_clicked",
] as const;

// Avledet fra tuppelen (ikke en duplikat-union — én sannhetskilde).
export type EventType = (typeof EVENT_TYPES)[number];

/**
 * Parse-guard som avviser verdier utenfor settet, slik at kode aldri sender en
 * event_type DB-CHECK-en ville avvist. Brukes ved utrygge grenser (input).
 */
export function isEventType(value: unknown): value is EventType {
  return (
    typeof value === "string" &&
    (EVENT_TYPES as readonly string[]).includes(value)
  );
}

// Typede payloads per event-type. board_viewed og poi_clicked bærer INGEN
// payload — poi_clicket sin poi_id går i top-level events.poi_id (PRD 13 §5.3),
// ikke i payload. category_opened/voiceover_played har hver sin hendelses-
// spesifikke payload.
export interface EventPayloads {
  board_viewed: undefined;
  category_opened: { category_id: string };
  voiceover_played: { voiceover_segment: string };
  poi_clicked: undefined;
}

// Hjelpetype: payload-formen for en gitt event-type (undefined der ingen payload).
export type PayloadFor<T extends EventType> = EventPayloads[T];
