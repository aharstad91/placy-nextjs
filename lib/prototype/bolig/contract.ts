/**
 * Felles kontrakt for bruktbolig-prototypen (mobil talesamtale).
 *
 * Tre parter deler denne fila: fixture/kunnskap (server), simulator og ekte
 * Realtime-hook (transport), og UI-komponentene (rendering). Ingen av dem
 * skal trenge å kjenne hverandre utover typene her.
 */

export type TopicId = "dagligvare" | "barn" | "natur" | "kollektiv" | "mat" | "selger";

export interface TopicDefinition {
  id: TopicId;
  /** Kort etikett i bunnkategoriene. */
  label: string;
  /** Det brukerens trykk sier til samtalen (vises som brukerens tur). */
  tapPrompt: string;
}

export const TOPICS: TopicDefinition[] = [
  { id: "dagligvare", label: "Dagligvare", tapPrompt: "Hva finnes av dagligvare i nærheten?" },
  { id: "barn", label: "Barn og oppvekst", tapPrompt: "Hvordan er det for barn her?" },
  { id: "natur", label: "Tur og natur", tapPrompt: "Hvor kan jeg gå tur?" },
  { id: "kollektiv", label: "Kollektiv", tapPrompt: "Hvordan kommer jeg meg rundt uten bil?" },
  { id: "mat", label: "Mat og kafé", tapPrompt: "Hvor kan vi spise eller ta en kaffe?" },
  { id: "selger", label: "Selgeren forteller", tapPrompt: "Hva likte selgeren best med å bo her?" },
];

export const TOPIC_IDS = TOPICS.map(t => t.id) as [TopicId, ...TopicId[]];
export const isTopicId = (value: unknown): value is TopicId => typeof value === "string" && (TOPIC_IDS as string[]).includes(value);

/** Opphav. Må følge innholdet både i verktøyresultater og på skjermen. */
export type Provenance = "documented" | "seller" | "example" | "unknown";

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  documented: "Dokumentert",
  seller: "Selgeren forteller",
  example: "Eksempeldata",
  unknown: "Ukjent",
};

export interface Source {
  id: string;
  label: string;
  /** Kun faktiske, kontrollerte URL-er. Aldri oppdiktet. */
  url?: string;
  /** ISO-dato for når kilden/opplysningen sist ble kontrollert. */
  checkedAt: string;
  kind: "register" | "google" | "osm" | "placy" | "measured" | "web";
}

export interface Fact {
  id: string;
  text: string;
  provenance: "documented" | "example";
  sourceIds: string[];
  checkedAt?: string;
}

export interface PlaceImage {
  src: string;
  alt: string;
  /** "illustration" merkes synlig i UI fordi den ikke viser stedet. */
  kind: "photo" | "illustration";
  credit?: string;
}

export interface Place {
  id: string;
  name: string;
  /** Kategorietikett, f.eks. «Dagligvare», «Barneskole». */
  kind: string;
  topics: TopicId[];
  lat: number;
  lng: number;
  provenance: "documented" | "example";
  sourceIds: string[];
  facts: Fact[];
  /** Målt gangtid i minutter fra eksempelboligen (Mapbox Directions). */
  walkMinutes?: number;
  walkSourceId?: string;
  address?: string;
  website?: string;
  mapsUrl?: string;
  image?: PlaceImage;
  openingHours?: string[];
  /** Kort forbehold, f.eks. «Omtrentlig plassering». */
  note?: string;
}

export interface SellerNote {
  id: string;
  topics: TopicId[];
  text: string;
  /** Alle selgersitater i demoen er fiktive og merkes slik. */
  provenance: "example";
}

export interface Unknown {
  id: string;
  topics: TopicId[];
  /** Spørsmålet folk stiller, f.eks. «Hvilken skolekrets tilhører boligen?» */
  question: string;
  /** Kort ærlig svar. */
  answer: string;
  /** Faktisk kilde for videre undersøkelse, hvis vi har en. */
  sourceIds: string[];
}

export interface TopicSummary {
  topic: TopicId;
  text: string;
  provenance: "documented";
  sourceIds: string[];
}

export interface House {
  id: string;
  title: string;
  addressLabel: string;
  provenance: "example";
  lat: number;
  lng: number;
  intro: string;
  image?: PlaceImage;
  facts: Fact[];
}

export interface BoligFixture {
  version: number;
  house: House;
  topics: TopicSummary[];
  places: Place[];
  seller: SellerNote[];
  unknowns: Unknown[];
  sources: Source[];
}

/* ---------- Verktøyresultater (server → modell OG nettleser) ---------- */

export interface PlaceRef {
  id: string;
  name: string;
  kind: string;
  walk_min: number | null;
  provenance: Provenance;
  fact?: string;
}

export interface ToolSource { id: string; label: string; url?: string; checked_at: string }

export type ToolResult =
  | { kind: "topic"; topic: TopicId; summary?: string; places: PlaceRef[]; seller: Array<{ id: string; text: string; provenance: "example" }>; unknowns: Array<{ id: string; question: string; answer: string }>; source_ids: string[]; note: string }
  | { kind: "place"; place: PlaceRef & { facts: Array<{ text: string; source_id: string; provenance: Provenance }>; address?: string; opening_hours?: string[]; sources: ToolSource[]; note?: string }; seller: Array<{ id: string; text: string; provenance: "example" }> }
  | { kind: "search"; query: string; places: PlaceRef[]; note: string }
  | { kind: "house"; title: string; provenance: "example"; facts: Array<{ text: string; provenance: Provenance }>; topics: TopicId[]; note: string }
  | { kind: "map"; ok: boolean; place_id?: string; error?: string }
  | { kind: "error"; error: string };

/* ---------- Blokker (det UI rendrer) ---------- */

export type Block =
  | { id: string; turn: number; kind: "user"; text: string }
  | { id: string; turn: number; kind: "answer"; text: string; done: boolean }
  | { id: string; turn: number; kind: "places"; placeIds: string[]; topic?: TopicId }
  | { id: string; turn: number; kind: "seller"; noteIds: string[] }
  | { id: string; turn: number; kind: "unknown"; unknownIds: string[] }
  | { id: string; turn: number; kind: "sources"; sourceIds: string[] }
  | { id: string; turn: number; kind: "notice"; text: string };

export type BlockKind = Block["kind"];

/* ---------- Sesjon (simulert eller ekte) ---------- */

export type SessionStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error" | "ended";

export const STATUS_LABEL: Record<SessionStatus, string> = {
  idle: "Klar",
  connecting: "Kobler til",
  listening: "Lytter",
  thinking: "Tenker",
  speaking: "Snakker",
  error: "Feil",
  ended: "Avsluttet",
};

export interface SessionUsage {
  responses: number;
  /** Estimert modellforbruk i USD, null når tallene ikke er komplette. */
  estimatedUsd: number | null;
}

export interface SessionState {
  status: SessionStatus;
  blocks: Block[];
  error: string | null;
  notice: string | null;
  muted: boolean;
  activeTopic: TopicId | null;
  selectedPlaceId: string | null;
  /** true = lokal simulering, aldri bevis på samtalekvalitet. */
  simulated: boolean;
  usage: SessionUsage | null;
}

export interface SessionActions {
  /** Aktiverer mikrofon og (ekte) betalt samtale. */
  start: () => void | Promise<void>;
  /** Stopper lyd og mikrofon umiddelbart og avslutter samtalen. */
  stop: () => void;
  /** Avbryter pågående svar/lyd uten å avslutte samtalen. */
  interrupt: () => void;
  toggleMute: () => void;
  /** Brukerens kategoritrykk → ett svar. Siste trykk vinner. */
  tapCategory: (topic: TopicId) => void;
  /** Brukerens stedsvalg i kart/kort → kontekst + kort svar. */
  selectPlace: (placeId: string) => void;
  clearSelection: () => void;
}

export type VoiceSession = SessionState & SessionActions;
