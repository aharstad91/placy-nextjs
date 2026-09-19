import { z } from "zod";

import type { Json } from "@/lib/supabase/types";

const faqSchema = z.object({
  id: z.string().min(1),
  spørsmål: z.string().min(1).optional(),
  svar: z.string().min(1),
});

const themePatchSchema = z.object({
  id: z.string().min(1),
  prepend: z.boolean().default(false),
  name: z.string().min(1).optional(),
  icon: z.string().min(1).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  categories: z.array(z.string().min(1)).optional(),
  intro: z.string().min(1).optional(),
  editorial: z.object({ body: z.string(), highlightPoiIds: z.array(z.string()).optional() }).optional(),
  faq: z.array(faqSchema).optional(),
});

export const boardContentInputSchema = z.object({
  reportConfig: z.object({
    label: z.string().min(1).optional(),
    heroIntro: z.string().min(1).optional(),
    district: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    pinSubtitle: z.string().optional(),
    pinAccent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    hideBrokerCard: z.boolean().optional(),
  }),
  themes: z.array(themePatchSchema),
  globalFaq: z.array(faqSchema).default([]),
});

function objectValue(value: Json | undefined): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {};
}

function mergeFaq(current: Json | undefined, patches: z.infer<typeof faqSchema>[]) {
  const existing = Array.isArray(current) ? current : [];
  const patchById = new Map(patches.map((entry) => [entry.id, entry]));
  const merged = existing.map((entry) => {
    const value = objectValue(entry);
    const id = typeof value.id === "string" ? value.id : null;
    return id && patchById.has(id) ? patchById.get(id)! : entry;
  });
  const existingIds = new Set(existing.flatMap((entry) => {
    const value = objectValue(entry);
    return typeof value.id === "string" ? [value.id] : [];
  }));
  return [...merged, ...patches.filter((entry) => !existingIds.has(entry.id))];
}

/** Merges curated content without replacing pipeline-owned theme configuration. */
export function mergeBoardContentConfig(currentInput: Json, inputValue: unknown): Json {
  const input = boardContentInputSchema.parse(inputValue);
  const current = objectValue(currentInput);
  const reportConfig = objectValue(current.reportConfig);
  const currentThemes = Array.isArray(reportConfig.themes) ? reportConfig.themes : [];
  const patchById = new Map(input.themes.map((patch) => [patch.id, patch]));
  const existingIds = new Set<string>();
  const mergedThemes = currentThemes.map((theme) => {
    const value = objectValue(theme);
    const id = typeof value.id === "string" ? value.id : null;
    if (!id) return theme;
    existingIds.add(id);
    const patch = patchById.get(id);
    if (!patch) return theme;
    const faq = patch.faq;
    const fields = Object.fromEntries(
      Object.entries(patch).filter(([key]) => key !== "prepend" && key !== "faq"),
    );
    return {
      ...value,
      ...fields,
      ...(faq ? { faq: mergeFaq(value.faq, faq) } : {}),
    };
  });
  const additions = input.themes.filter((patch) => !existingIds.has(patch.id));
  for (const addition of additions) {
    if (!addition.name || !addition.icon || !addition.color || !addition.categories) {
      throw new Error(`Nytt tema ${addition.id} mangler name, icon, color eller categories`);
    }
  }
  const cleanAddition = (patch: typeof additions[number]) => Object.fromEntries(
    Object.entries(patch).filter(([key]) => key !== "prepend"),
  );
  const prepended = additions.filter((patch) => patch.prepend).map(cleanAddition);
  const appended = additions.filter((patch) => !patch.prepend).map(cleanAddition);
  return {
    ...current,
    reportConfig: {
      ...reportConfig,
      ...input.reportConfig,
      themes: [...prepended, ...mergedThemes, ...appended],
      ...(input.globalFaq.length > 0
        ? { globalFaq: mergeFaq(reportConfig.globalFaq, input.globalFaq) }
        : {}),
    },
  } as Json;
}
