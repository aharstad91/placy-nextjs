import type { Json } from "@/lib/supabase/types";

const STANDARD_ASSISTANT_FEATURES = {
  faqProgress: true,
  revealPlaces: true,
  followHighlightCategory: true,
  unscopedCategoryList: true,
  narrationFocus: true,
  voicePacing: true,
  guidedPersona: true,
} as const;

function objectValue(value: Json | undefined): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {};
}

/** Adds the standard-board capabilities without discarding project copy. */
export function mergeBoardAssistantConfig(
  previous: Json | undefined,
  input: { name: string; greeting?: string | null },
): Json {
  const assistant = objectValue(previous);
  const features = objectValue(assistant.features);
  return {
    ...assistant,
    enabled: true,
    name: input.name,
    guided: true,
    features: {
      ...features,
      ...STANDARD_ASSISTANT_FEATURES,
    },
    ...(input.greeting ? { greeting: input.greeting } : {}),
  };
}
