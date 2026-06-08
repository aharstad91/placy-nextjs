/**
 * Statiske default-tekster og tema-definisjoner for basic-tier rapport-board.
 * Samme tekst for alle prosjekter — kan overskrives per prosjekt i Supabase
 * uten at re-kjøring av pipelinen clobbrer overstyringen (merge-semantikk).
 */

export interface ReportThemeDefault {
  id: string;
  name: string;
  icon: string;
  categories: string[];
  color: string;
  leadText: string;
}

export const REPORT_THEME_DEFAULTS: ReportThemeDefault[] = [
  {
    id: "hverdagsliv",
    name: "Hverdagsliv",
    icon: "ShoppingCart",
    categories: [
      "shopping",
      "supermarket",
      "pharmacy",
      "convenience",
      "liquor_store",
      "doctor",
      "dentist",
      "hospital",
      "haircare",
      "bank",
      "post",
    ],
    color: "#36d16f",
    leadText: "Dagligvarer, apotek og hverdagstjenester i nærheten.",
  },
  {
    id: "barn-oppvekst",
    name: "Barn & Oppvekst",
    icon: "GraduationCap",
    categories: ["skole", "barnehage", "lekeplass", "idrett"],
    color: "#f8ae17",
    leadText: "Skoler, barnehager og lekeplasser for familier med barn.",
  },
  {
    id: "mat-drikke",
    name: "Mat & Drikke",
    icon: "UtensilsCrossed",
    categories: ["restaurant", "cafe", "bar", "bakery"],
    color: "#f35a5a",
    leadText: "Restauranter, kaféer og spisesteder i nærområdet.",
  },
  {
    id: "natur-friluftsliv",
    name: "Natur & Friluftsliv",
    icon: "Trees",
    categories: ["park", "outdoor", "badeplass"],
    color: "#22c68d",
    leadText: "Parker, friluftsområder og badeplasser i nærheten.",
  },
  {
    id: "transport",
    name: "Transport & Mobilitet",
    icon: "Bus",
    categories: [
      "bus",
      "train",
      "tram",
      "bike",
      "parking",
      "carshare",
      "taxi",
      "charging_station",
    ],
    color: "#4d93f8",
    leadText: "Kollektivtransport, sykkel og parkeringsmuligheter.",
  },
  {
    id: "trening-aktivitet",
    name: "Trening & Aktivitet",
    icon: "Dumbbell",
    categories: ["gym", "swimming", "spa", "fitness_park"],
    color: "#f05da7",
    leadText: "Treningssentre, svømmehaller og aktivitetstilbud.",
  },
];

/**
 * Nærings-profil (kontorbygg / næringseiendom): samme motor, men fokus snudd
 * fra beboer til ansatt/besøkende. Ingen skole/barnehage/natur-tyngde — i
 * stedet lunsj, pendling, trening, hverdagstjenester og et "nabolag"-tema med
 * hotell/kultur for kunder og besøkende. Kategori-slugene er verifisert mot
 * GOOGLE_CATEGORY_MAP i poi-discovery.ts (movie_theater→cinema, hair_care→
 * haircare, hotel→hotel). 5 temaer (Mat & Drikke først — viktigste spørsmål
 * for ansatte er "hvor spiser vi lunsj?").
 */
export const NAERING_THEME_DEFAULTS: ReportThemeDefault[] = [
  {
    id: "mat-drikke",
    name: "Mat & Drikke",
    icon: "UtensilsCrossed",
    categories: ["restaurant", "cafe", "bar", "bakery"],
    color: "#f35a5a",
    leadText: "Lunsjsteder, kaféer og servering i gangavstand fra kontoret.",
  },
  {
    id: "transport",
    name: "Transport & Mobilitet",
    icon: "Bus",
    categories: ["bus", "train", "tram", "bike", "parking", "carshare", "taxi"],
    color: "#4d93f8",
    leadText: "Kollektivknutepunkt, sykkel og parkering for pendlende ansatte.",
  },
  {
    id: "trening-aktivitet",
    name: "Trening & Aktivitet",
    icon: "Dumbbell",
    categories: ["gym", "swimming", "fitness_park"],
    color: "#f05da7",
    leadText: "Treningssentre og aktivitetstilbud for økter før, under og etter jobb.",
  },
  {
    id: "hverdagstjenester",
    name: "Hverdagstjenester",
    icon: "ShoppingCart",
    categories: ["supermarket", "pharmacy", "haircare"],
    color: "#36d16f",
    leadText: "Dagligvare, apotek og praktiske ærend på vei til og fra jobb.",
  },
  {
    id: "nabolaget",
    name: "Nabolaget",
    icon: "MapPin",
    categories: ["park", "outdoor", "hotel", "museum", "cinema", "library"],
    color: "#22c68d",
    leadText: "Parker, hotell og kulturtilbud som gir kvartalet karakter for besøkende og kunder.",
  },
];

/** Profil-velger for rapport-board: bolig (default) eller næring. */
export type ReportProfile = "bolig" | "naering";

export function getThemeDefaults(profile: ReportProfile = "bolig"): ReportThemeDefault[] {
  return profile === "naering" ? NAERING_THEME_DEFAULTS : REPORT_THEME_DEFAULTS;
}

/**
 * Per-by discovery radius for Google Places og offentlige POI-kildar.
 * Bolig: fallback suburban (2500 m). Næring: kortere — ansatte går/sykler til
 * lunsj, ikke kjører til dagligvare (Trondheim 1500 m).
 */
export const REPORT_DISCOVERY_RADIUS: Record<string, number> = {
  oslo: 1500,
  bergen: 1800,
  trondheim: 2000,
  stavanger: 2000,
  default: 2500,
};

export const NAERING_DISCOVERY_RADIUS: Record<string, number> = {
  oslo: 1200,
  bergen: 1200,
  trondheim: 1500,
  stavanger: 1500,
  default: 1500,
};

export function getDiscoveryRadius(
  city: string | undefined,
  profile: ReportProfile = "bolig",
): number {
  const table =
    profile === "naering" ? NAERING_DISCOVERY_RADIUS : REPORT_DISCOVERY_RADIUS;
  if (!city) return table.default;
  const key = city.toLowerCase();
  return table[key] ?? table.default;
}
