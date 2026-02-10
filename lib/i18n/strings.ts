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
  },
} as const;

type StringKey = keyof (typeof strings)["no"];

export function t(locale: Locale, key: StringKey): string {
  return strings[locale][key];
}
