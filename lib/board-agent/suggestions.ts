import type { BoardData } from "@/components/variants/report/board/board-data";
import type { AgentSuggestion } from "@/lib/board-agent/types";

/**
 * Knaggene Anja kan by på i samtalen (2026-09-25, R5).
 *
 * Boardets eget innhold — kategoriene, «Verdt å merke seg» og FAQ — lever
 * videre i agentmodusen som konkrete forslag. De er ikke hardkodede
 * chattekster: alt kommer fra `BoardData`, og et forslag er alltid noe
 * boardet faktisk kan svare på (FAQ-en har et godkjent svar, stedet finnes i
 * kartet, temaet har et kapittel).
 *
 * Rekkefølgen følger det brukeren står i: finnes et tema i samtalen, kommer
 * temaets eget spørsmål og sted først, så et annet tema å gå videre til. Uten
 * tema er det boardets egne spørsmål og temaene selv.
 *
 * Brukte og avviste forslag kommer ikke tilbake av seg selv (ingen mekanisk
 * repetisjon); nøkkelen er stabil per innhold (`faq:<id>`, `place:<id>`,
 * `theme:<id>`), så samme knagg ikke kan dukke opp under to navn.
 */

export interface SuggestionContext {
  /** Temaet samtalen står i nå, eller null. */
  categoryId: string | null;
  /** Nøkler som alt er brukt i samtalen. */
  used: ReadonlySet<string>;
  /** Nøkler brukeren har sagt «ikke nå» til. */
  dismissed: ReadonlySet<string>;
  limit?: number;
}

export const suggestionKey = {
  faq: (id: string) => `faq:${id}`,
  place: (id: string) => `place:${id}`,
  theme: (id: string) => `theme:${id}`,
};

export function agentSuggestions(data: BoardData, context: SuggestionContext): AgentSuggestion[] {
  const limit = context.limit ?? 3;
  const blocked = (key: string) => context.used.has(key) || context.dismissed.has(key);
  const current = context.categoryId ? data.categories.find((c) => String(c.id) === context.categoryId) ?? null : null;

  const faqs = (entries: readonly { id: string; question: string }[] | undefined): AgentSuggestion[] =>
    (entries ?? []).map((entry) => ({ key: suggestionKey.faq(entry.id), kind: "faq" as const, faqId: entry.id, label: entry.question }));
  const places = (category: BoardData["categories"][number]): AgentSuggestion[] =>
    (category.editorial?.highlights ?? []).map((place) => ({
      key: suggestionKey.place(String(place.id)),
      kind: "place" as const,
      poiId: String(place.id),
      label: place.name,
      categoryId: String(category.id),
    }));
  const themes = data.categories
    .filter((category) => category.pois.length > 0 && category !== current)
    .map((category): AgentSuggestion => ({ key: suggestionKey.theme(String(category.id)), kind: "theme", categoryId: String(category.id), label: category.label }));

  // Én kandidatliste per gruppe, flettet så hver gruppe får sin tur før noen
  // gruppe får to: tre forslag skal ikke være tre FAQ-er om samme ting.
  const groups: AgentSuggestion[][] = current
    ? [faqs(current.editorial?.faq), places(current), themes, faqs(data.globalFaq)]
    : [faqs(data.globalFaq), themes, data.categories.flatMap(places)];

  const picked: AgentSuggestion[] = [];
  const seen = new Set<string>();
  const queues = groups.map((group) => group.filter((s) => !blocked(s.key)));
  while (picked.length < limit && queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (!next || seen.has(next.key)) continue;
      seen.add(next.key);
      picked.push(next);
      if (picked.length >= limit) break;
    }
  }
  return picked;
}
