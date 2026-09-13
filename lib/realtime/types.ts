export type RealtimeStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

export interface RealtimeMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
}

export interface RealtimeTool {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface RealtimeReferenceSource {
  id?: string;
  title?: string;
  label?: string;
  page?: string;
  checkedAt?: string;
  url?: string;
}

export interface RealtimeReference {
  mapPoiId?: string | null;
  id: string;
  name: string;
  sources?: RealtimeReferenceSource[];
}

/** Verktøyene NETTLESEREN utfører. Definisjonene ligger i `map-tools.ts`; navnene her er gaten begge sider sjekker mot. */
export const MAP_TOOLS = new Set(["show_category", "show_place", "set_travel_mode", "reset_board", "highlight_places", "clear_highlights"]);

export const MAP_INTERRUPT_MARKER = "Placy: brukeren tar over kartet; avbryt tidligere kartkommandoer.";

export const SESSION_END_PREFIX = "Placy sesjonsstopp: ";

export const RATE_WAIT_PREFIX = "Placy venter på kapasitet: ";
