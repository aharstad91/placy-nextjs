/**
 * Delte typer for Nyhavna-demoens Live-bane (GPT-Live-1, 2026-09-13).
 *
 * Protokollen er OpenAI Live API (`/v1/live/sessions`), ikke Realtime. Stemmen
 * (gpt-live-1) eier lyd, samtaleflyt og delegering; en Responses-backend eier
 * resonnering og verktøyvalg; Placy validerer og utfører ALLE verktøy (kunnskap
 * på serveren, kart i nettleseren) og eier applikasjonstilstanden.
 *
 * Kartkommandoene går IKKE lenger via modellens datakanal: serveren sender
 * «kartdirektiver» til nettleseren over en SSE-strøm, og nettleseren svarer med
 * kartstatus over HTTP. Én eier per handling (jf. Live-dokumentasjonen).
 */
import type { RealtimeTool } from "@/lib/realtime/types";

export type LiveStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

/**
 * Ett innslag i transkriptet. Live sender fragmenter uten turgrenser, så `id`
 * er nettleserens egen gruppering (taler + pause), ikke en ID fra API-et.
 */
export interface LiveMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

/** Verktøydefinisjon slik Responses-backenden får den (samme skjema som før). */
export type LiveFunctionTool = RealtimeTool;

/** En kartkommando serveren ber nettleseren utføre. `id` er direktivets egen ID (ikke et call_id). */
export interface MapDirective {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/** Nettleserens svar på et kartdirektiv: ren kartstatus, aldri fakta. */
export interface MapDirectiveResult {
  id: string;
  output: unknown;
}

/** Meldinger serveren sender nettleseren over SSE-strømmen (`/api/prototype/live/map`). */
export type LiveServerMessage =
  | { type: "map"; directive: MapDirective }
  | { type: "activity"; activity: "working" | "answering" | "idle" }
  | { type: "ended"; reason: LiveEndReason; message: string }
  /** Den delte stemmens chatflate: signert historikk til tekstchatten (`lib/live/hosted-control.ts`). */
  | { type: "handoff"; status: "ready" | "failed"; transcript?: string; voiceTurns?: number; trimmed?: boolean }
  | { type: "hello" };

export type LiveEndReason = "manual" | "limit" | "idle" | "connection" | "error";

/** Hva nettleseren melder serveren om brukerens egne handlinger i flaten (`/api/prototype/live/context`). */
export type LiveContextMessage =
  | { kind: "theme"; id: string; label?: string }
  | { kind: "place"; id: string; name?: string }
  | { kind: "state"; selected_category_id: string | null; selected_place_id: string | null; travel_mode: string; revealed_place_ids?: string[] }
  | { kind: "text"; text: string };

/** Resultatet av et server-verktøy: det backenden får, og kartdirektiver serveren selv utløser. */
export interface ToolOutcome {
  result: unknown;
  directives?: Array<Pick<MapDirective, "name" | "args">>;
}

/** Bruk pr. samtale: stemme i sekunder (Live) og backend-tokens (Responses), separat. */
export interface LiveUsage {
  voiceSeconds: number;
  backendResponses: number;
  backendInputTokens: number;
  backendCachedTokens: number;
  backendOutputTokens: number;
  estimatedUsd: number;
  /** false når en backend-runde manglet usage eller modellen mangler prisliste. */
  complete: boolean;
}

/**
 * Målepunkter for ÉN delegering (én brukerforespørsel backenden jobbet med),
 * i millisekunder fra delegeringen ble opprettet. Session-tidslinjen (offset_ms,
 * start_ms) brukes der den finnes; veggklokke ellers.
 */
export interface DelegationTiming {
  delegation_id: string;
  /** Live-tidslinje: når backenden ble bedt om hjelp. */
  offset_ms: number;
  /** Siste brukertranskript før delegeringen (slutt) – hvor lang stillhet før modellen ba om hjelp. */
  user_end_ms: number | null;
  /** Første ord stemmen sa etter delegeringen (typisk «jeg sjekker…»), og når. */
  ack_words: string;
  ack_ms: number | null;
  /** Første kartdirektiv sendt til nettleseren, og når kartet bekreftet. */
  first_map_call: string | null;
  first_map_args: string | null;
  first_map_call_ms: number | null;
  map_ok_ms: number | null;
  /** Backendens runder: hver `response.completed/failed/incomplete` med innhold, status og tokens. */
  rounds: Array<{ done_ms: number; output: string[]; status: string; error?: string; input_tokens: number; cached_tokens: number; output_tokens: number }>;
  /** Når backenden var ferdig med sitt siste svar. */
  backend_done_ms: number | null;
  /** Første ord stemmen sa ETTER at backenden var ferdig – selve svaret – og når. */
  answer_words: string;
  answer_ms: number | null;
  end: "done" | "superseded" | "failed" | "ended";
}

/** Én omvisningstilstand slik kartet/flaten melder den inn. */
export interface LiveBoardState {
  selected_category_id: string | null;
  selected_place_id: string | null;
  travel_mode: string;
  revealed_place_ids?: string[];
}

/**
 * Samtalen som ÉN serverside-enhet, slik sideband-et trenger den.
 *
 * Strukturell kontrakt, ikke en importert klasse: sideband-et skal kunne testes
 * med en liten fake, og domenemodulen (`lib/realtime/nyhavna-conversation.ts`)
 * oppfyller den uten å vite om Live-banen.
 */
export interface LiveConversation {
  execute(name: string, args: Record<string, unknown>): ToolOutcome | Promise<ToolOutcome>;
  /** Speiler nettleserens kartsvar i tilstanden (fremhevingsrekkefølge, åpnet sted, tømming). */
  observeBrowserResult(name: string, args: Record<string, unknown>, output: unknown): void;
  /** Kompakt omvisningsnotat når tilstanden er endret, ellers null. Legges SIST i backend-instruksen. */
  noteIfChanged(): string | null;
  /** 1–2 linjer om hva kartet viser nå, til stemmen. Bare når det er endret. */
  mapContextIfChanged(): string | null;
  onMapSelection(kind: "theme" | "place", id: string): { commentary: string; directives: Array<Pick<MapDirective, "name" | "args">> } | null;
  setBoardState(state: LiveBoardState): void;
}
