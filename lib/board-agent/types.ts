/**
 * Kontrakten for Boardets agentmodus «Spør Anja» (prototype, 2026-09-25).
 *
 * Tre deler snakker sammen gjennom disse typene, og ingen av dem importerer
 * noe server-only herfra:
 *
 * - Board-tekstbanen (`app/api/demo/nyhavna-board-chat/route.ts`): tar et
 *   skrevet spørsmål ELLER et strukturert brukerinitiativ (sted, FAQ, tema),
 *   svarer med kildekontrollert tekst og et allowlistet sett kartdirektiver.
 * - Samtalekoordinatoren (`components/variants/report/board/agent/`): eier
 *   modusen, feeden og historikktokenet, og utfører direktivene gjennom
 *   `executeBoardTool` — aldri frie koordinater eller fakta fra serveren.
 * - Samtalepanelet: rendrer feeden, forslagene og composeren.
 *
 * Planen: `docs/plans/2026-09-25-1220-feat-nyhavna-board-agentmodus-prototype-plan.md`.
 */

/** Sidebarens to flater: dagens utforsking, eller samtalen med Anja. */
export type AgentMode = "explore" | "agent";

/** Inne i samtalen: skrive eller snakke. Samme historikk begge veier. */
export type AgentInput = "write" | "talk";

export const BOARD_CHAT_ENDPOINT = "/api/demo/nyhavna-board-chat";

/** Board-tekstbanens ene «side» i kundens sideregister. */
export const BOARD_CHAT_PAGE_ID = "board";

/** Samme grense som tekstfeltet og serveren. */
export const BOARD_CHAT_MESSAGE_MAX = 600;

/**
 * Et bevisst valg brukeren gjorde i kartet eller i en Board-liste. Serveren
 * slår opp navn, spørsmål og fakta selv; klienten sender bare ID-en.
 */
export type BoardChatIntent =
  | { kind: "place"; poiId: string }
  | { kind: "faq"; faqId: string }
  | { kind: "theme"; categoryId: string };

export type BoardTravelMode = "walk" | "bike" | "car";

/** Det kartet viser akkurat nå. Ukjente ID-er ignoreres av serveren. */
export interface BoardChatMapState {
  selectedCategoryId: string | null;
  selectedPlaceId: string | null;
  travelMode: BoardTravelMode;
}

/** Nøyaktig ett av `message` og `intent`. */
export interface BoardChatRequest {
  pageId: typeof BOARD_CHAT_PAGE_ID;
  message?: string;
  intent?: BoardChatIntent;
  /** Forrige signerte historikktoken (tekst eller tale). */
  transcript?: string;
  board?: BoardChatMapState;
}

/** Kartkommandoene tekstbanen kan returnere. Alt annet avvises av begge sider. */
export const BOARD_DIRECTIVE_NAMES = [
  "highlight_places",
  "show_place",
  "show_category",
  "set_travel_mode",
  "clear_highlights",
] as const;

export type BoardDirectiveName = (typeof BOARD_DIRECTIVE_NAMES)[number];

/** Høyst så mange direktiver per svar. */
export const BOARD_DIRECTIVE_MAX = 4;

export interface BoardDirective {
  name: BoardDirectiveName;
  args: Record<string, unknown>;
}

export function isBoardDirectiveName(name: unknown): name is BoardDirectiveName {
  return typeof name === "string" && (BOARD_DIRECTIVE_NAMES as readonly string[]).includes(name);
}

/** Speiler `ChatSource` i `lib/demo/site-chat/sources.ts` (server-only). */
export interface BoardChatSource {
  id: string;
  label: string;
  page: string;
  checkedAt: string;
}

/** Speiler `ResolvedLink` i `lib/demo/site-chat/profile.ts`. */
export interface BoardChatLink {
  id: string;
  label: string;
  href: string;
}

export type BoardChatAnswerType = "fact" | "gap" | "smalltalk" | "refusal";

export interface BoardChatReply {
  reply: string;
  answerType: BoardChatAnswerType;
  links: BoardChatLink[];
  sources: BoardChatSource[];
  notice: string | null;
  /** Nytt signert historikktoken; sendes med neste melding og ved talestart. */
  transcript: string;
  datasetVersion: string;
  directives: BoardDirective[];
}

export interface BoardChatError {
  error: string;
  links?: BoardChatLink[];
}

// ---------------------------------------------------------------------------
// Feeden
// ---------------------------------------------------------------------------

/** Hvor et stedsvalg kom fra. Bare for presentasjon og måling. */
export type AgentPlaceOrigin = "map" | "highlight" | "suggestion" | "list";

export type AgentEntry =
  | { id: string; kind: "user"; text: string; via: "text" | "voice" }
  | {
      id: string;
      kind: "assistant";
      text: string;
      via: "text" | "voice";
      sources?: BoardChatSource[];
      links?: BoardChatLink[];
      notice?: string | null;
    }
  /** Brukeren valgte et sted: vises straks, før svaret kommer. */
  | { id: string; kind: "place"; poiId: string; name: string; categoryLabel: string | null; origin: AgentPlaceOrigin }
  | { id: string; kind: "faq"; faqId: string; question: string }
  | { id: string; kind: "theme"; categoryId: string; label: string }
  /** Svaret er på vei (tekstbanen). Erstattes av svaret eller en feil. */
  | { id: string; kind: "pending"; forEntryId: string | null }
  | { id: string; kind: "status"; tone: "error" | "info"; text: string };

export type AgentSuggestion =
  | { key: string; kind: "faq"; faqId: string; label: string }
  | { key: string; kind: "place"; poiId: string; label: string; categoryId: string }
  | { key: string; kind: "theme"; categoryId: string; label: string };
