/**
 * Temaraden i Leangenbukta-chatten (2026-09-24): Boardets egne kategorier,
 * hver med tre kuraterte spørsmålsforslag.
 *
 * Kategoriene (id, navn, ikon, farge) leses fra `loadLiveDemo`s board — ikke
 * en egen liste her. Bare spørsmålene er demo-spesifikke, knyttet til den
 * stabile kategori-ID-en. Et tema uten spørsmål her vises ikke i raden.
 *
 * Temavalget styrer bare forslagene; Anja har samme kunnskap uansett tema.
 * Spørsmålene lover derfor ingenting om pris, ledighet eller andre salgstall
 * i sanntid — de peker på det datasettet faktisk dekker.
 */
export const CATEGORY_QUESTIONS: Readonly<Record<string, readonly [string, string, string]>> = {
  "leangenbukta-prosjektet": [
    "Hva er Leangenbukta?",
    "Hvilke bygg består Leangenbukta av?",
    "Hvilke fellesarealer får beboerne?",
  ],
  hverdag: [
    "Hvilke dagligvarebutikker finnes på Lade?",
    "Hva finner jeg på City Lade?",
    "Hvilke apotek er omtalt i området?",
  ],
  oppvekst: [
    "Hva vet dere om Lade skole?",
    "Hvilke barnehager ligger i nærheten?",
    "Hvor kan barna leke ute?",
  ],
  servering: [
    "Hvor kan vi spise ved sjøen?",
    "Finnes det et bakeri i nærheten?",
    "Hva vet dere om Ladekaia?",
  ],
  natur: [
    "Hvilke badeplasser er omtalt i nærområdet?",
    "Hva er Ringve botaniske hage?",
    "Hva vet dere om Korsvika?",
  ],
  transport: [
    "Hva vet dere om Leangen stasjon?",
    "Hvilken sykkelforbindelse er planlagt?",
    "Hvordan kommer jeg meg til sentrum uten bil?",
  ],
  trening: [
    "Hvilke treningssentre er omtalt i området?",
    "Hva finnes i Leangen idrettspark?",
    "Hvor kan vi gå på skøyter?",
  ],
  opplevelser: [
    "Hva kan barnefamilier finne på i nærheten?",
    "Hva er Ringve Musikkmuseum?",
    "Finnes det et lekeland innendørs i nærheten?",
  ],
};

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
export function chatCategories(categories: readonly BoardCategoryMeta[], pageStarters: readonly string[]): ChatCategory[] {
  const usable = categories.filter(
    (category) =>
      CATEGORY_QUESTIONS[category.id] &&
      CATEGORY_ID.test(category.id) &&
      HEX_COLOR.test(category.color) &&
      ICON_NAME.test(category.icon) &&
      category.label.trim().length > 0,
  );
  return usable.map((category, index) => {
    const curated = CATEGORY_QUESTIONS[category.id];
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
