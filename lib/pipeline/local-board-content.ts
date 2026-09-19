import { z } from "zod";

import {
  localBoardSchema,
  localFaqsSchema,
} from "@/lib/demo/local-board/schema";

const mappingSchema = z.array(z.object({
  localPlaceId: z.string().min(1),
  poiId: z.string().min(1),
  evidence: z.string().min(1),
}));

const optionsSchema = z.object({
  ownCategoryThemeIds: z.array(z.string().min(1)).default([]),
  faqAnswerOverrides: z.record(z.string(), z.string().min(1)).default({}),
  hideBrokerCard: z.boolean().default(true),
  standalonePoiIds: z.array(z.string().min(1)).default([]),
});

const POI_LINK_RE = /\[([^\]]+)\]\(poi:([^)]+)\)/g;

function rewritePoiLinks(answer: string, mappingByLocalId: ReadonlyMap<string, string>) {
  return answer.replace(POI_LINK_RE, (_match, label: string, localPlaceId: string) => {
    const poiId = mappingByLocalId.get(localPlaceId.trim());
    return poiId ? `[${label}](poi:${poiId})` : label;
  });
}

/** Converts local-board copy to a merge input for an ordinary report board. */
export function buildLocalBoardContent(
  boardInput: unknown,
  faqInput: unknown,
  mappingsInput: unknown,
  optionsInput: unknown,
) {
  const board = localBoardSchema.parse(boardInput);
  const faqs = localFaqsSchema.parse(faqInput);
  const mappings = mappingSchema.parse(mappingsInput);
  const options = optionsSchema.parse(optionsInput);
  const mappingByLocalId = new Map(mappings.map((mapping) => [mapping.localPlaceId, mapping.poiId]));
  const ownCategoryThemeIds = new Set(options.ownCategoryThemeIds);

  const faqByCategory = new Map<string, typeof faqs>();
  for (const faq of faqs) {
    const categoryId = faq.categoryId ?? "";
    faqByCategory.set(categoryId, [...(faqByCategory.get(categoryId) ?? []), faq]);
  }
  const convertFaq = (faq: typeof faqs[number]) => ({
    id: faq.id,
    spørsmål: faq.question,
    svar: rewritePoiLinks(
      options.faqAnswerOverrides[faq.id] ?? faq.answer,
      mappingByLocalId,
    ),
  });
  const themes = board.categories.map((category) => {
    const ownCategory = ownCategoryThemeIds.has(category.id);
    const presentation = board.presentation?.find((entry) => entry.categoryId === category.id);
    return {
      id: category.id,
      ...(ownCategory ? {
        prepend: true,
        name: category.name,
        icon: category.icon,
        color: category.color,
        categories: [category.id],
        ...(category.lead ? { intro: category.lead } : {}),
        editorial: {
          body: presentation?.text ?? category.body,
          highlightPoiIds: presentation?.placeIds.flatMap((placeId) => {
            const poiId = mappingByLocalId.get(placeId);
            return poiId ? [poiId] : [];
          }) ?? [],
        },
      } : {}),
      faq: (faqByCategory.get(category.id) ?? []).map(convertFaq),
    };
  });
  return {
    reportConfig: {
      label: board.name,
      ...(board.intro ? { heroIntro: board.intro } : {}),
      ...(board.district ? { district: board.district } : {}),
      ...(board.city ? { city: board.city } : {}),
      pinSubtitle: board.pinSubtitle,
      ...(board.pinAccent ? { pinAccent: board.pinAccent } : {}),
      hideBrokerCard: options.hideBrokerCard,
      ...(options.standalonePoiIds.length > 0
        ? { standalonePoiIds: options.standalonePoiIds }
        : {}),
    },
    themes,
    globalFaq: (faqByCategory.get("") ?? []).map(convertFaq),
  };
}
