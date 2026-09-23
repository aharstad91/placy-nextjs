import "server-only";

import { MAP_TOOLS, type RealtimeTool } from "@/lib/realtime/types";

/**
 * Hvilke av Anjas verktøy tekstchatten skal FÅ TILBY modellen (2026-09-23).
 *
 * ## Regelen (KTD4): kartstyrende verktøy bare når Boardet er åpent
 *
 * Tekstchatten har ingen nettleserbro og intet kart å style — `demo.tools`
 * inneholder likevel navnene i `MAP_TOOLS` (utført av NETTLESEREN i Live) og de
 * tre presentasjonsverktøyene fra `lib/demo/local-board/presentation.ts`
 * (`present_neighbourhood`, `find_similar_places`, `reveal_more_places`), som
 * alle er skrevet for en guidet manus-omvisning SAMTIDIG med kartbevegelser.
 * Begge gruppene utelates helt fra listen modellen får:
 *
 * - `MAP_TOOLS`-navnene ville feilet stille (ingen bro å dispatche til) —
 *   verre, et forsøk fra modellen ville sett ut som et kart som ikke svarer.
 * - Presentasjonsverktøyene ER laget for å fortelle «her i kartet» og vente på
 *   at brukeren TRYKKER videre; i en tekstsamtale uten kart gir de setninger
 *   som «kartet fremhever nå» ingen mening, og «vil du se flere» uten en
 *   radius-utvidelse i et synlig kart er et løfte chatten ikke kan innfri.
 *
 * ## Hva som BEHOLDES, og hvorfor det er trygt
 *
 * `find_places`, `get_place_facts`, `get_place_address`, `get_board_facts` og
 * `find_project_info` er rene oppslag uten kartbivirkning. `set_interests` og
 * `open_theme` KAN returnere kartdirektiver (`highlight_places` via
 * `openMapFor`/presentasjonens `present()`) fordi det er samme
 * samtaletilstand som Live bruker — men backend-løkka i
 * `lib/demo/leangenbukta-chat/backend.ts` leser bare `.result` fra
 * `ToolOutcome` og dropper `.directives` uåpnet. Det finnes ingen bro å sende
 * dem til, så de forsvinner sporløst i stedet for å bli et løfte om et kart
 * som ikke er der. Instruksjonstillegget (`instructions.ts`) ber i tillegg
 * modellen aldri omtale kartet i tekstsvar.
 */

const TEXT_ONLY_EXCLUDED = new Set(["present_neighbourhood", "find_similar_places", "reveal_more_places"]);

export function textChatTools(tools: readonly RealtimeTool[]): RealtimeTool[] {
  return tools.filter((tool) => !MAP_TOOLS.has(tool.name) && !TEXT_ONLY_EXCLUDED.has(tool.name));
}

/**
 * Verktøy som teller som KUNNSKAPSBEVIS for et faktasvar (R9/AE5): et vellykket
 * kall her betyr at svaret hviler på noe fra det godkjente datagrunnlaget, ikke
 * bare på samtaletilstand. `set_interests`/`open_theme`/`note_detour`/
 * `return_to_tour` styrer bare omvisningens posisjon og telles ikke alene —
 * MEN `open_theme` og `set_interests` returnerer et kapittel med fakta, så de
 * telles når kapittelet faktisk inneholder noe (`isEvidence` i backend.ts).
 */
export const FACT_TOOL_NAMES = new Set(["find_places", "get_place_facts", "get_place_address", "get_board_facts", "find_project_info", "open_theme", "set_interests"]);
