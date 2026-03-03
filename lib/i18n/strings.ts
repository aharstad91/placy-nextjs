/**
 * UI string dictionary for Report bilingual support.
 * Norwegian is the canonical language; English is the translation target.
 */

export type Locale = "no" | "en";

const strings = {
  no: {
    label: "Nabolagsrapport",
    places: "steder",
    withinWalking: "innen gåavstand",
    the: "De",
    rated: "vurderte",
    hasAvgOf: "har et snitt på",
    basedOn: "basert på",
    reviews: "anmeldelser",
    transportPoints: "transportpunkter",
    easyToGetAround: "gjør det enkelt å komme seg rundt",
    inTheArea: "I nærområdet finner du",
    avg: "Snitt",
    summary: "Oppsummert",
    byPlacy: "av Placy",
    recommended: "Anbefalt",
    localGem: "Lokal perle",
    heroIntroBolig: "Lurer du på hvordan det er å bo på {name}? Utforsk nabolaget.",
    heroIntroNaering: "Lurer du på hva som finnes rundt {name}? Se hva som er i nærheten.",
    heroIntroFallback: "Utforsk hva som finnes i nærheten av {name}.",
    selectThemes: "Velg temaer",
  },
  en: {
    label: "Neighborhood Report",
    places: "places",
    withinWalking: "within walking distance",
    the: "The",
    rated: "rated",
    hasAvgOf: "have an average of",
    basedOn: "based on",
    reviews: "reviews",
    transportPoints: "transport points",
    easyToGetAround: "make getting around easy",
    inTheArea: "In the neighborhood you'll find",
    avg: "Avg",
    summary: "Summary",
    byPlacy: "by Placy",
    recommended: "Recommended",
    localGem: "Local gem",
    heroIntroBolig: "Wondering what it's like to live at {name}? Explore the neighborhood.",
    heroIntroNaering: "Wondering what's around {name}? See what's nearby.",
    heroIntroFallback: "Explore what's nearby {name}.",
    selectThemes: "Select themes",
  },
} as const;

type StringKey = keyof (typeof strings)["no"];

export function t(locale: Locale, key: StringKey): string {
  return strings[locale][key];
}

/**
 * Theme questions — keyed by theme ID, bilingual.
 * These are UI labels, not theme configuration. Kept here as single source of truth.
 */
export const themeQuestions: Record<string, Record<Locale, string>> = {
  "barn-oppvekst": { no: "Er det bra for barna?", en: "Is it good for kids?" },
  "hverdagsliv": { no: "Hva kan jeg ordne i nærheten?", en: "What can I find nearby?" },
  "mat-drikke": { no: "Er det et levende nabolag?", en: "Is it a lively neighborhood?" },
  "opplevelser": { no: "Er det noe å gjøre her?", en: "Is there anything to do here?" },
  "natur-friluftsliv": { no: "Er det grønt i nærheten?", en: "Is there nature nearby?" },
  "trening-aktivitet": { no: "Kan jeg trene i nærheten?", en: "Can I exercise nearby?" },
  "transport": { no: "Hvordan kommer jeg meg rundt?", en: "How do I get around?" },
  // Næring-specific themes
  "hverdagstjenester": { no: "Hva kan jeg ordne i nærheten?", en: "What can I find nearby?" },
  "nabolaget": { no: "Hva finnes i nabolaget?", en: "What's in the neighborhood?" },
  // Legacy theme IDs (fallback)
  "kultur-opplevelser": { no: "Er det noe å gjøre her?", en: "Is there anything to do here?" },
  "barnefamilier": { no: "Er det bra for barna?", en: "Is it good for kids?" },
  "hverdagsbehov": { no: "Hva kan jeg ordne i nærheten?", en: "What can I find nearby?" },
  "trening-velvare": { no: "Kan jeg trene i nærheten?", en: "Can I exercise nearby?" },
};

export function getThemeQuestion(locale: Locale, themeId: string): string | undefined {
  return themeQuestions[themeId]?.[locale];
}

/**
 * Interpolation helper for {name} placeholders in string templates.
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}
