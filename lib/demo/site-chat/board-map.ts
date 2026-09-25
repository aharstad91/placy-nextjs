import "server-only";

import type { BoardData, BoardPOI } from "@/components/variants/report/board/board-data";
import { findBoardPOI } from "@/components/variants/report/board/board-data";
import { boardLinkResolvers, parseLinkedText } from "@/lib/board/poi-link-text";
import { BOARD_DIRECTIVE_NAMES, type BoardChatMapState, type BoardDirective } from "@/lib/board-agent/types";
import { textChatTools } from "@/lib/demo/site-chat/text-tools";
import type { RealtimeTool } from "@/lib/realtime/types";

/**
 * Boardets egen agentmodus, server-siden (2026-09-25, KTD3/KTD4).
 *
 * Tre ting bor her, alle avledet av `BoardData` alene — ingen av dem har noe
 * med tekstchattens nettsidekopi å gjøre:
 *
 * 1. `createBoardMapPort` — validerer et kartverktøykall MOT BOARDETS EGNE
 *    DATA og returnerer et direktiv (`lib/board-agent/types.ts`), aldri
 *    modellens egne koordinater eller fakta. Speiler feilteksten og
 *    `{ok, shown, highlighted, rejected}`-formen i
 *    `lib/realtime/board-tools.ts` (klientens utførelse) — samme kontrakt,
 *    men uten dispatch/kamera, for det finnes intet nettleservindu her.
 * 2. `boardChatTools` — tekstchattens vanlige verktøy PLUSS de allowlistede
 *    kartverktøyene, definisjonene hentet fra `demo.tools` (samme skjema
 *    Anjas taleflate bruker).
 * 3. FAQ-hjelperne — svaret på et FAQ-brukerinitiativ er alltid FAQ-ens egen
 *    godkjente tekst, aldri modellen: `findBoardFaq` (`lib/board-agent/faq.ts`) finner spørsmålet,
 *    `faqAnswerPlainText` fjerner lenkemarkeringen (`[tekst](poi:id)`) og
 *    henter ut de refererte, GYLDIGE POI-ID-ene til en `highlight_places`-
 *    forespørsel gjennom SAMME port som verktøykall valideres med.
 */

export interface BoardMapExecuteResult {
  result: unknown;
  directive: BoardDirective | null;
}

export interface BoardMapPort {
  execute(name: string, args: Record<string, unknown>): BoardMapExecuteResult;
}

const HIGHLIGHT_LIMIT = 6;

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Verktøyene modellen selv kan kalle for å styre Boardets kart, validert mot `board` alene. */
export function createBoardMapPort(board: BoardData): BoardMapPort {
  const execute = (name: string, args: Record<string, unknown>): BoardMapExecuteResult => {
    switch (name) {
      case "highlight_places": {
        const requested = stringArray(args.poi_ids);
        if (!requested.length) {
          return { result: { error: "poi_ids mangler. Bruk kart-ID-er fra verktøysvarene." }, directive: null };
        }
        const found: BoardPOI[] = [];
        const rejected: string[] = [];
        for (const id of requested.slice(0, HIGHLIGHT_LIMIT)) {
          const poi = findBoardPOI(board.categories, id);
          if (!poi) rejected.push(id);
          else if (!found.some((p) => p.id === poi.id)) found.push(poi);
        }
        if (!found.length) {
          return { result: { error: `Ukjente kart-ID-er: ${rejected.join(", ")}. Ingen steder ble fremhevet.` }, directive: null };
        }
        const highlighted = found.map((p, i) => ({ ord: i + 1, id: String(p.id), name: p.name }));
        return {
          result: { ok: true, shown: found.map((p) => p.name).join(", "), highlighted, ...(rejected.length ? { rejected } : {}) },
          directive: { name: "highlight_places", args: { poi_ids: found.map((p) => String(p.id)) } },
        };
      }
      case "clear_highlights":
        return { result: { ok: true, shown: "Fremhevingen er fjernet" }, directive: { name: "clear_highlights", args: {} } };
      case "show_place": {
        const poi = typeof args.poi_id === "string" ? findBoardPOI(board.categories, args.poi_id) : null;
        if (!poi) return { result: { error: "Ukjent sted. Bruk en kart-ID fra verktøysvarene." }, directive: null };
        return { result: { ok: true, shown: poi.name, poi_id: String(poi.id) }, directive: { name: "show_place", args: { poi_id: String(poi.id) } } };
      }
      case "show_category": {
        const category = typeof args.category_id === "string" ? board.categories.find((c) => String(c.id) === args.category_id) : undefined;
        if (!category) return { result: { error: "Ukjent tema-ID. Bruk en tema-ID fra boardets temaer." }, directive: null };
        return { result: { ok: true, shown: category.label, category_id: String(category.id) }, directive: { name: "show_category", args: { category_id: String(category.id) } } };
      }
      case "set_travel_mode": {
        const mode = args.mode;
        if (mode !== "walk" && mode !== "bike" && mode !== "car") return { result: { error: "Ukjent reisemåte." }, directive: null };
        const available = board.categories.some((c) => c.pois.some((p) => p.raw.travelTime?.[mode] !== undefined));
        if (!available) return { result: { error: "Boardet har ingen lagrede reisetider for denne reisemåten." }, directive: null };
        return { result: { ok: true, shown: `Reisemåte: ${mode}` }, directive: { name: "set_travel_mode", args: { mode } } };
      }
      default:
        return { result: { error: `Ukjent kartkommando: ${name}.` }, directive: null };
    }
  };
  return { execute };
}

const DIRECTIVE_NAME_SET = new Set<string>(BOARD_DIRECTIVE_NAMES);

/** Tekstverktøyene pluss de allowlistede kartverktøyene, med samme skjema Anjas taleflate får. */
export function boardChatTools(tools: readonly RealtimeTool[]): RealtimeTool[] {
  return [...textChatTools(tools), ...tools.filter((tool) => DIRECTIVE_NAME_SET.has(tool.name))];
}

/**
 * FAQ-svarets ren tekst (lenkemarkeringen `[tekst](poi:id)` fjernet, teksten
 * beholdt) pluss de GYLDIGE, refererte POI-ID-ene — degradert, aldri
 * sensurert (`lib/board/poi-link-text.ts`).
 */
export function faqAnswerPlainText(board: BoardData, answer: string): { text: string; poiIds: string[] } {
  const resolvers = boardLinkResolvers(board.poisById, board.categories.map((c) => String(c.id)));
  const nodes = parseLinkedText(answer, resolvers);
  const text = nodes.map((node) => node.text).join("");
  const poiIds = [...new Set(nodes.filter((node) => node.kind === "poi").map((node) => (node as { poiId: string }).poiId))];
  return { text, poiIds };
}

/** Kort linje til slutt i instruksen: hva kartet viser akkurat nå. Ukjente ID-er ignoreres. */
export function boardMapStateNote(board: BoardData, state: BoardChatMapState | undefined | null): string | null {
  if (!state) return null;
  const category = state.selectedCategoryId ? board.categories.find((c) => String(c.id) === state.selectedCategoryId) : null;
  const place = state.selectedPlaceId ? findBoardPOI(board.categories, state.selectedPlaceId) : null;
  const parts: string[] = [];
  if (category) parts.push(`tema ${category.label}`);
  if (place) parts.push(`valgt sted ${place.name}`);
  parts.push(`reisemåte ${state.travelMode}`);
  return `Kartet nå: ${parts.join(", ")}.`;
}
