import type { RealtimeTool } from "@/lib/realtime/types";

/**
 * Kartkommandoene – de eneste verktøyene NETTLESEREN utfører.
 *
 * Definert ett sted og delt av serveren (som sender lista til modellen) og
 * klienten (som sjekker at et kall er et kjent kartverktøy før det kjøres).
 * Serveren eier alle kunnskapsverktøy; nettleseren returnerer bare kartstatus,
 * aldri fakta. Se `lib/realtime/nyhavna-knowledge.ts` og `board-voice.tsx`.
 */
const schema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object", properties, required, additionalProperties: false,
});

export const nyhavnaMapTools: RealtimeTool[] = [
  {
    type: "function", name: "highlight_places",
    description: "Fremhev 1–6 steder samtidig i kartet, i den rekkefølgen du omtaler dem, uten å åpne dem; erstatter forrige fremheving. Bare kart-ID-er fra kapittel, katalog («vis:») eller map_poi_id. Kall i samme svar som du omtaler stedene.",
    parameters: schema({
      poi_ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
      answered_faq_ids: { type: "array", items: { type: "string" }, maxItems: 4, description: "Katalogspørsmål svaret dekker (ID)." },
    }, ["poi_ids"]),
  },
  {
    type: "function", name: "clear_highlights",
    description: "Fjern fremhevingen i kartet.",
    parameters: schema({}),
  },
  {
    type: "function", name: "show_place",
    description: "Åpne ETT sted med detaljkort og flytt kartet dit, når brukeren vil vite mer om ett sted. Fremhevingen beholdes; stedets fakta følger etter kartsvaret.",
    parameters: schema({
      poi_id: { type: "string" },
      answered_faq_ids: { type: "array", items: { type: "string" }, maxItems: 4, description: "Katalogspørsmål svaret dekker (ID)." },
    }, ["poi_id"]),
  },
  {
    type: "function", name: "show_category",
    description: "Vis et tema i kartet og flaten (tema-ID).",
    parameters: schema({ category_id: { type: "string" } }, ["category_id"]),
  },
  {
    type: "function", name: "set_travel_mode",
    description: "walk, bike eller car for de lagrede reisetidene.",
    parameters: schema({ mode: { type: "string", enum: ["walk", "bike", "car"] } }, ["mode"]),
  },
  {
    type: "function", name: "reset_board",
    description: "Tilbake til oversikten; fjerner fremhevingen.",
    parameters: schema({}),
  },
];
