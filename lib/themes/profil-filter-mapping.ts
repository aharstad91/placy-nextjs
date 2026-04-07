import type { ThemeDefinition } from "./theme-definitions";

export type Livsfase = "family" | "couple" | "single" | "senior";

export interface LivsfaseOption {
  id: Livsfase;
  label: string;
  icon: string;
  description: string;
  enabledThemes: string[];
}

export const LIVSFASE_OPTIONS: LivsfaseOption[] = [
  {
    id: "family",
    label: "Barnefamilie",
    icon: "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}",
    description: "Skole, barnehage, lekeplasser og trygge nabolag",
    enabledThemes: ["barn-oppvekst", "hverdagsliv", "natur-friluftsliv", "transport"],
  },
  {
    id: "couple",
    label: "Par uten barn",
    icon: "\u{1F491}",
    description: "Restauranter, kultur, trening og hverdagsliv",
    enabledThemes: ["mat-drikke", "opplevelser", "trening-aktivitet", "hverdagsliv"],
  },
  {
    id: "single",
    label: "Aktiv singel",
    icon: "\u{1F3C3}",
    description: "Uteliv, trening, opplevelser og mobilitet",
    enabledThemes: ["mat-drikke", "trening-aktivitet", "opplevelser", "transport"],
  },
  {
    id: "senior",
    label: "Pensjonist",
    icon: "\u{1F9D3}",
    description: "Hverdagstjenester, natur, kultur og transport",
    enabledThemes: ["hverdagsliv", "natur-friluftsliv", "opplevelser", "transport"],
  },
];

/**
 * Get category IDs to DISABLE for a given livsfase.
 * Takes all themes from bransjeprofil, finds those NOT in enabledThemes,
 * flattens their categories into a Set.
 */
export function getDisabledCategories(
  livsfase: Livsfase,
  allThemes: ThemeDefinition[]
): Set<string> {
  const option = LIVSFASE_OPTIONS.find((o) => o.id === livsfase);
  if (!option) return new Set();

  const disabled = new Set<string>();
  for (const theme of allThemes) {
    if (!option.enabledThemes.includes(theme.id)) {
      for (const cat of theme.categories) {
        disabled.add(cat);
      }
    }
  }
  return disabled;
}
