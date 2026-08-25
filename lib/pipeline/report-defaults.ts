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
      // Recall-fiks 2026-08-12 (Straumen-fasitøvelsen)
      "kirke",
      "veterinar",
      "trafikkskole",
      "butikk",
    ],
    color: "#36d16f",
    leadText: "Dagligvarer, apotek og hverdagstjenester i nærheten.",
  },
  {
    id: "barn-oppvekst",
    name: "Barn & Oppvekst",
    icon: "GraduationCap",
    categories: ["skole", "barnehage", "lekeplass", "idrett", "fritidsklubb"],
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
    // marina/campground/hundepark var alt natur-mappet i seed-osm-pois.ts,
    // men manglet her — POI-ene lå i poolen uten å rendre (recall-fiks 2026-08-12)
    categories: ["park", "outdoor", "badeplass", "marina", "campground", "hundepark"],
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
      "fuel",
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
 * Discovery-radius for boligprofilen: ETT tall, ingen per-by-tabell.
 *
 * ## Hvorfor tabellen ble fjernet (2026-08-24)
 *
 * Her lå det per-by-verdier — Oslo 1 500 m, Bergen 1 800, Trondheim 2 000 —
 * med 2 500 m som fallback når byen var ukjent. Det gjorde at Å KJENNE byen
 * krympet boardet: en Trondheims-adresse fikk 500 meter mindre nabolag enn en
 * adresse pipelinen ikke klarte å plassere. Ingen av de 12 eksisterende
 * boardene hadde truffet tabellen ennå (alle kjørte fallback 2 500 m), så
 * fella var fortsatt uavfyrt — men den var reell.
 *
 * Premisset bak per-by-verdiene var at tett by trenger kortere radius fordi
 * det ligger mer innenfor den. Det er et RELEVANS-argument, og relevans hører
 * i sorteringen og i board-rendringen der den er synlig — ikke i importen, der
 * konsekvensen er at stedet ikke finnes. Folk bruker området rundt hjemmet sitt
 * enten det ligger 400 meter eller 3 kilometer unna.
 *
 * 3 000 m er valgt fordi det dekker det folk faktisk regner som nabolaget sitt
 * til fots og på sykkel, og fordi kysten/dalsidene i norske byer strekker seg
 * lineært — et 2 000-meters kutt fjerner systematisk sjøkanten og marka, som
 * er nettopp det som selger boligen.
 */
export const BOLIG_DISCOVERY_RADIUS_M = 3000;

/**
 * Næringsprofilen beholder per-by-tabellen: der er premisset et annet (ansatte
 * går til lunsj i arbeidstiden, de flytter ikke inn), og profilen er ikke
 * berørt av funnet over. Endres den, skal det være på egne premisser.
 */
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
  if (profile !== "naering") return BOLIG_DISCOVERY_RADIUS_M;
  if (!city) return NAERING_DISCOVERY_RADIUS.default;
  return (
    NAERING_DISCOVERY_RADIUS[city.toLowerCase()] ??
    NAERING_DISCOVERY_RADIUS.default
  );
}
