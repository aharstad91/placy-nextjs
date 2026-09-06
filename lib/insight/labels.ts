// Bygger id → navn-oppslagene rapporten trenger, fra boardets egne data.
// Rapporten lagrer aldri tekst — bare id-er — så navn slås opp ved lesing.
//
// ## Hvorfor oppslagene caches for seg
//
// Å bygge dem krever HELE board-produktet, og det produktet er ~3 MB. Next'
// datacache tar ikke imot noe over 2 MB: den skriver ikke, sier fra i loggen og
// går videre. `getCachedReportProduct` så altså ut som en cache og var ingen —
// i produksjon leste hver eneste innsiktsvisning boardet fra Supabase på nytt,
// målt til 3,5 s per sidebytte. (Board-sidene selv merker ingenting: de
// prerendres.)
//
// Oppslagene som kommer ut er derimot små — navn og spørsmål, ingen editorial,
// ingen bilder, ingen koordinater — og det er DEM vi cacher. Da betaler bare
// det første kallet etter en tømming for board-lesingen.
//
// Map-ene må gjennom en JSON-trygg mellomform: datacachen serialiserer, og en
// Map kommer tilbake som `{}`.

import { unstable_cache } from "next/cache";
import { getCachedReportProduct } from "@/lib/supabase/cached-board-reads";
import type { Project } from "@/lib/types";
import { faqQuestionsForTheme, AREA_BOARD_QUESTIONS } from "@/lib/editorial/category-specs";
import { getReportThemes } from "@/components/variants/report/report-themes";
import type { InsightLabels } from "./types";

export function buildInsightLabels(project: Project): InsightLabels {
  // Samme oppslag som boardet: reportConfig-temaene fylt ut med bransjeprofilens
  // navn/ikon/farge og kanonisk id — så rapporten bruker boardets id-er og farger.
  const themes = getReportThemes(project);

  const categories = themes.map((t) => ({ id: t.id, label: t.name, icon: t.icon, color: t.color }));

  // POI → tema: temaet lister kategori-id-ene sine; POI-et bærer kategori-id.
  const themeByCategoryId = new Map<string, string>();
  for (const t of themes) for (const c of t.categories) themeByCategoryId.set(c, t.id);
  const pois = new Map<string, { name: string; categoryId?: string }>();
  for (const p of project.pois) {
    pois.set(p.id, { name: p.name, categoryId: themeByCategoryId.get(p.category.id) });
  }

  // FAQ: malverkets spørsmål per tema + kurators egne + den globale lista.
  const faq = new Map<string, { question: string; categoryId?: string }>();
  for (const t of themes) {
    for (const q of faqQuestionsForTheme(t.id, t.categories)) {
      faq.set(q.question.id, { question: q.question.spørsmål, categoryId: t.id });
    }
    for (const c of t.faq ?? []) if (c.spørsmål) faq.set(c.id, { question: c.spørsmål, categoryId: t.id });
  }
  for (const q of AREA_BOARD_QUESTIONS) faq.set(q.id, { question: q.spørsmål });
  for (const c of project.reportConfig?.globalFaq ?? []) if (c.spørsmål) faq.set(c.id, { question: c.spørsmål });

  return { categories, pois, faq };
}

/** JSON-trygg mellomform av `InsightLabels` — Map-er som par-lister. */
interface InsightLabelsDTO {
  categories: InsightLabels["categories"];
  pois: Array<[string, { name: string; categoryId?: string }]>;
  faq: Array<[string, { question: string; categoryId?: string }]>;
}

const CACHE_SECONDS = 3600;

/**
 * Oppslagene for ett board, cachet i sin lille form. Deler produkt-taggen med
 * board-lesingen, så en re-provisjonering tømmer begge med én `revalidateTag`.
 */
export async function getCachedInsightLabels(
  customer: string,
  projectSlug: string,
): Promise<InsightLabels | null> {
  const dto = await unstable_cache(
    async (): Promise<InsightLabelsDTO | null> => {
      const project = await getCachedReportProduct(customer, projectSlug);
      if (!project) return null;
      const l = buildInsightLabels(project);
      return { categories: l.categories, pois: [...l.pois], faq: [...l.faq] };
    },
    ["insight-labels", customer, projectSlug],
    { tags: [`product:${customer}_${projectSlug}`], revalidate: CACHE_SECONDS },
  )();

  if (!dto) return null;
  return { categories: dto.categories, pois: new Map(dto.pois), faq: new Map(dto.faq) };
}
