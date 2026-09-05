// Bygger id → navn-oppslagene rapporten trenger, fra boardets egne data.
// Rapporten lagrer aldri tekst — bare id-er — så navn slås opp ved lesing.

import type { Project } from "@/lib/types";
import { faqQuestionsForTheme, AREA_BOARD_QUESTIONS } from "@/lib/editorial/category-specs";
import type { InsightLabels } from "./types";

export function buildInsightLabels(project: Project): InsightLabels {
  const themes = project.reportConfig?.themes ?? [];

  const categories = themes.map((t) => ({ id: t.id, label: t.name }));

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
