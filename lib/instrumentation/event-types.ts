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
  // Utforsk-modalen (migrasjon 085). «Utforsk»-klikket er det sterkeste
  // interessesignalet per POI, og var uinstrumentert — brukeren forsvant til
  // Google og signalet gikk tapt. De to typene skiller utfallene:
  //   poi_explore_opened   — modalen ble åpnet inne i Placy
  //   poi_outbound_clicked — fallback-lenken ble klikket (POI uten innhold)
  "poi_explore_opened",
  "poi_outbound_clicked",
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

/**
 * Kontekst-konvolutten (moat-2-build-input §2 Gap 1 — DET irreversible kravet):
 * rir i `payload.context` på HVERT event så tidlig volum aldri logges
 * confounded (et skole-klikk kan skilles fra «utforsker Ladestien»). Events
 * logget uten konvolutt kan ikke repareres i ettertid — de 19 pre-fiks-radene
 * i prod (uten `context`-nøkkel) er nettopp derfor ubrukelige som moat-data.
 *
 * Feltene er board-render-øktens statiske ramme; hendelses-spesifikke felt
 * (`category_id` osv.) ligger ved siden av konvolutten i payload. `area_id`
 * bæres IKKE her — strøk avledes stabilt server-side ved aggregering via
 * `project_id` → prosjektkoordinat → `find-area-for-point` (PRD 8).
 * Utvidelse (f.eks. travel_mode, viewport) er additivt — payload er jsonb.
 */
export interface EngagementContextEnvelope {
  /** Board-flate: boligrapport eller event-board (D3-modusen). */
  mode: "report" | "event";
  /** Ortogonalt render-flagg — 3D-motor aktiv på boardet. */
  has_3d_addon: boolean;
  /** Presentert kategori-rekkefølge (id-er, i faktisk vist rekkefølge). */
  categories_presented: string[];
  /** UI-locale ved emit (no/en). */
  locale: string;
}

// Typede payloads per event-type. poi_clicket sin poi_id går i top-level
// events.poi_id (PRD 13 §5.3), ikke i payload; poi_clicked bærer i tillegg
// kategorien klikket skjedde i. ALLE payloads bærer kontekst-konvolutten
// (`context`) — optional i typen kun for bakoverkompatible/degraderte stier;
// emit-sitene skal alltid sende den (via EngagementEmitter).
export interface EventPayloads {
  board_viewed: { context?: EngagementContextEnvelope };
  category_opened: { category_id: string; context?: EngagementContextEnvelope };
  voiceover_played: {
    voiceover_segment: string;
    context?: EngagementContextEnvelope;
  };
  poi_clicked: { category_id?: string; context?: EngagementContextEnvelope };
  /**
   * Utforsk-modalen åpnet. `has_grounding` skiller de to grunnene modalen kan
   * åpnes av (grounded narrativ vs. bare Google-fakta) — uten det ville
   * aggregeringen ikke kunne si om innholdet drev interessen eller bare fantes.
   *
   * ToS-GRENSE: vi logger AT modalen ble åpnet. Vi logger ALDRI klikk på
   * enkelte kildelenker eller Search Suggestions — tracking av interaksjoner med
   * spesifikke Grounded Results er forbudt per Gemini API Additional Terms.
   */
  poi_explore_opened: {
    category_id?: string;
    has_grounding: boolean;
    context?: EngagementContextEnvelope;
  };
  /** Fallback-lenken til Google klikket (POI-et hadde ikke nok innhold). */
  poi_outbound_clicked: {
    category_id?: string;
    context?: EngagementContextEnvelope;
  };
}

// Hjelpetype: payload-formen for en gitt event-type (undefined der ingen payload).
export type PayloadFor<T extends EventType> = EventPayloads[T];
