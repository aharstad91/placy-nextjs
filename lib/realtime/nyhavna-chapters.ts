import type { BoardCategory, BoardData, BoardPOI } from "@/components/variants/report/board/board-data";
import type { FaqEntry } from "@/lib/generators/faq-generator";
import { nyhavnaKnowledge, type KnowledgeTheme } from "@/lib/demo/nyhavna-leve/knowledge";
import type { TravelMode } from "@/lib/types";

/**
 * Temakapitler – den faktapakken modellen får når et tema åpnes (2026-09-13).
 *
 * Et kapittel er IKKE ny kurering. Det er boardets eget innhold for temaet,
 * pakket én gang og avgrenset: introen, spørsmålene og svarene, de navngitte
 * stedene med kart-ID, de kildekontrollerte omtalene (for Nyhavnas egne temaer)
 * og – når det finnes – prosjektinnhold fra nyhavna.no. Alt bærer ID-er
 * modellen kan bruke i kartverktøyene, og ingenting den ikke skal si.
 *
 * Pakken hentes ved temainngang, ikke i hver tur. FAQ-katalogen ligger i den
 * faste instruksjonen, fordi den lar et katalogspørsmål besvares og vises i
 * kartet i ÉN runde; kapittelet bærer derfor bare spørsmåls-ID-ene (innholdet
 * to ganger kostet 500–1 000 tokens per temainngang, målt 2026-09-13), og er
 * dybden og overgangene.
 */

/** Slik kilden merker seg selv i temaene fra nyhavna.no. */
const KNOWLEDGE_THEME_BY_CATEGORY: Record<string, KnowledgeTheme[]> = {
  "leve-servering": ["cafe-and-restaurants"],
  "leve-park": ["parks", "promenade"],
  "leve-kultur": ["art-and-culture"],
};

const FAQ_LINK = /\[([^\]]+)\]\((poi|category):([^)]+)\)/g;

export interface SpokenFaq {
  id: string;
  question: string;
  /** Svaret uten lenkemarkering – slik det skal sies. */
  answer: string;
  /** Kart-ID-ene svaret peker på, i tekstens rekkefølge. */
  show: { id: string; name: string }[];
  category_ids: string[];
}

/** Skreller `[tekst](poi:id)`/`[tekst](category:id)` til tale + ID-lister. */
export function spokenFaq(entry: FaqEntry, poisById: ReadonlyMap<string, BoardPOI>): SpokenFaq {
  const show: { id: string; name: string }[] = [];
  const category_ids: string[] = [];
  const answer = entry.answer.replace(FAQ_LINK, (_match, text: string, kind: string, id: string) => {
    if (kind === "poi") {
      const poi = poisById.get(id.toLowerCase());
      if (poi && !show.some((s) => s.id === String(poi.id))) show.push({ id: String(poi.id), name: text });
    } else if (!category_ids.includes(id)) category_ids.push(id);
    return text;
  });
  return { id: entry.id, question: entry.question, answer, show, category_ids };
}

export function boardPoisById(board: BoardData): Map<string, BoardPOI> {
  return new Map(board.categories.flatMap((c) => c.pois).map((p) => [String(p.id).toLowerCase(), p]));
}

/** Første setninger av en tekst, kuttet på setningsslutt. */
function firstSentences(text: string | undefined, max: number): string {
  const full = String(text ?? "").replace(/\s+/g, " ").trim();
  const sentences = full.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!sentences || sentences.length <= max) return full;
  return sentences.slice(0, max).join("").trim();
}

const minutes = (poi: BoardPOI, mode: TravelMode) => {
  const v = poi.raw.travelTime?.[mode];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

export interface ChapterPlace {
  id: string;
  name: string;
  type: string;
  minutes_walk: number | null;
  status: "existing" | "planned";
  location_precision: "sourced" | "approximate" | "unknown";
  location_note?: string;
}

export interface ChapterPack {
  theme_id: string;
  name: string;
  intro: string;
  source?: { label: string; page?: string; url: string };
  /** Temaets spørsmål i katalogen (ID). Selve spørsmålene og svarene står i instruksjonen. */
  faq_ids: string[];
  /** Temaets navngitte steder – kuratorens utvalg, ellers de nærmeste målte. */
  places: ChapterPlace[];
  /** Kildekontrollerte omtaler fra nyhavna.no (bare Nyhavnas egne temaer). */
  curated: Array<{
    id: string; name: string; map_poi_id: string | null; status: string; summary: string;
    facts: string[]; uncertainties: string[];
  }>;
  /** Prosjektinnhold fra nyhavna.no, hentet per tema. */
  project_info: ProjectInfo[];
  /** Steder kilden nevner uten kartplassering. Skal aldri få markør. */
  unplaced: string[];
  place_count: number;
  note: string;
}

export interface ProjectInfo {
  id: string;
  title: string;
  status: string;
  text: string;
  source: { url: string; page: string; checked_at: string };
}

/** Prosjektinnholdet er en egen modul (kan mangle i tester) – derfor injisert. */
export interface ProjectInfoProvider {
  forTheme: (themeId: string, limit: number) => ProjectInfo[];
  search: (query: string, themes: readonly string[], limit: number) => ProjectInfo[];
}

export const NO_PROJECT_INFO: ProjectInfoProvider = { forTheme: () => [], search: () => [] };

export const CHAPTER_NOTE =
  "Bruk bare fakta herfra, fra katalogen og fra kunnskapsverktøyene. Skill dagens tilbud fra planlagt utvikling. Steder uten kart-ID skal ikke få markør. Reisetider er minutter fra boardets adresse.";

export function buildChapter(
  board: BoardData,
  category: BoardCategory,
  travelMode: TravelMode,
  projectInfo: ProjectInfoProvider = NO_PROJECT_INFO,
): ChapterPack {
  const highlights = category.editorial?.highlights ?? [];
  const pickPool: BoardPOI[] = highlights.length
    ? highlights.map((h) => category.pois.find((p) => p.id.toLowerCase() === String(h.id).toLowerCase())).filter((p): p is BoardPOI => p !== undefined)
    : category.pois.filter((p) => minutes(p, travelMode) !== null);
  const places = pickPool
    .slice()
    .sort((a, b) => (minutes(a, travelMode) ?? Infinity) - (minutes(b, travelMode) ?? Infinity) || a.name.localeCompare(b.name, "nb"))
    .slice(0, 4)
    .map<ChapterPlace>((p) => ({
      id: String(p.id), name: p.name, type: p.raw.category.name,
      minutes_walk: minutes(p, "walk"),
      status: p.raw.developmentStatus ?? "existing",
      location_precision: p.raw.locationPrecision ?? "unknown",
      location_note: p.raw.locationNote,
    }));
  const knowledgeThemes = KNOWLEDGE_THEME_BY_CATEGORY[String(category.id)] ?? [];
  const curated = nyhavnaKnowledge.entities
    .filter((e) => e.themes.some((t) => knowledgeThemes.includes(t)))
    .map((e) => ({
      id: e.id, name: e.name, map_poi_id: e.mapPoiId, status: e.status, summary: e.summary,
      facts: e.facts.filter((f) => f.verification === "confirmed").slice(0, 3).map((f) => f.text),
      uncertainties: e.facts.filter((f) => f.verification === "unresolved").map((f) => f.text),
    }));
  const intro = category.editorial?.intro ?? firstSentences(category.editorial?.body ?? category.body ?? category.lead, 2) ?? category.lead;
  return {
    theme_id: String(category.id),
    name: category.label,
    intro,
    source: category.editorial?.source ? { label: category.editorial.source.label, page: category.editorial.source.page, url: category.editorial.source.url } : undefined,
    faq_ids: (category.editorial?.faq ?? []).map((entry) => entry.id),
    places,
    curated,
    project_info: projectInfo.forTheme(String(category.id), 3),
    unplaced: category.editorial?.unplaced ?? [],
    place_count: category.pois.length,
    note: CHAPTER_NOTE,
  };
}

/** Kort versjon ved retur fra en avstikker: navn, intro, stedene – ikke omtalene og prosjektinnholdet igjen. */
export function chapterSummary(chapter: ChapterPack): Pick<ChapterPack, "theme_id" | "name" | "intro" | "places" | "unplaced" | "faq_ids"> {
  return {
    theme_id: chapter.theme_id,
    name: chapter.name,
    intro: chapter.intro,
    places: chapter.places,
    unplaced: chapter.unplaced,
    faq_ids: chapter.faq_ids,
  };
}
