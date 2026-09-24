/**
 * Temaraden i chatboksen (2026-09-24), felles for alle kunder: Boardets egne
 * kategorier (id, navn, ikon, farge fra `loadLiveDemo`s board), hver med tre
 * kuraterte spørsmålsforslag fra kundens profil. Et tema uten forslag vises
 * ikke. Temavalget styrer bare forslagene; Anja har samme kunnskap uansett.
 */

export const QUESTIONS_PER_CATEGORY = 3;

/** Det raden trenger fra boardets `BoardCategory` — ikke steder, tekster eller redaksjon. */
export interface BoardCategoryMeta {
  id: string;
  label: string;
  icon: string;
  color: string;
}

export interface ChatCategory {
  id: string;
  label: string;
  /** Lucide-navn; widgeten tegner bare ikoner den selv kjenner. */
  icon: string;
  color: string;
  questions: string[];
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const ICON_NAME = /^[A-Za-z0-9]{1,40}$/;
const CATEGORY_ID = /^[a-z0-9-]{1,60}$/;

/**
 * Metadata for temaraden, i Boardets rekkefølge. Det første temaet (prosjektet)
 * er standardvalget; der står sidens egne forslag først, fylt opp med
 * temaets kuraterte til tre — så åpningen fortsatt gir sidetilpassede forslag,
 * uten et eget, dobbelt sett ved siden av raden.
 */
export function chatCategories(
  categories: readonly BoardCategoryMeta[],
  pageStarters: readonly string[],
  questionsById: Readonly<Record<string, readonly string[]>>,
): ChatCategory[] {
  const usable = categories.filter(
    (category) =>
      questionsById[category.id] &&
      CATEGORY_ID.test(category.id) &&
      HEX_COLOR.test(category.color) &&
      ICON_NAME.test(category.icon) &&
      category.label.trim().length > 0,
  );
  return usable.map((category, index) => {
    const curated = questionsById[category.id];
    return {
      id: category.id,
      label: category.label.trim().slice(0, 40),
      icon: category.icon,
      color: category.color,
      questions: index === 0 ? withPageStarters(pageStarters, curated) : [...curated],
    };
  });
}

function withPageStarters(pageStarters: readonly string[], curated: readonly string[]): string[] {
  const questions: string[] = [];
  const seen = new Set<string>();
  for (const text of [...pageStarters, ...curated]) {
    const key = text.trim().toLocaleLowerCase("nb");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    questions.push(text.trim());
    if (questions.length === QUESTIONS_PER_CATEGORY) break;
  }
  return questions;
}
