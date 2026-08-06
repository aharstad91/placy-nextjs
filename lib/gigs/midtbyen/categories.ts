/**
 * Fra Midtbyens 28 kategorifiltre til noe en besøkende orker å lese.
 *
 * Kilden er bygd for å filtrere en tekstliste: «Dame», «Herre», «Tilbehør»,
 * «Sko». Det er nyttig når man vet hva man leter etter, og ubrukelig som
 * inngang på et kart. Sju grupper er nok til å velge mellom med tommelen.
 *
 * ÉN gruppe per butikk. `POI.category` er ett felt, ikke en liste, og
 * board-laget grupperer på nettopp det. 44 av 147 butikker bærer termer som
 * peker mot flere grupper, så tilordningen må avgjøres — den kan ikke overlates
 * til rekkefølgen i `data-terms`.
 *
 * Avgjørelsen ligger på TERMEN, ikke på gruppen. En sportsbutikk fører også
 * dame- og herreklær; «Sport & Fritid» sier hva butikken *er*, mens «Dame» bare
 * sier hva den fører. Gruppevis prioritet ville tvunget alle sportsbutikker
 * inn i klesgruppen, eller alle klesbutikker som fører hudpleie inn i
 * helsegruppen. Vektene under uttrykker hvor mye en term forteller om butikkens
 * identitet.
 */

export interface MidtbyenGroup {
  id: string;
  label: string;
  /** Lucide-navn. MÅ finnes i ICON_MAP i `lib/utils/map-icons.ts` — ukjente
   *  navn faller stille tilbake til MapPin, og da ser alle gruppene like ut. */
  icon: string;
  color: string;
}

export const ANNET_GROUP_ID = "annet";

export const MIDTBYEN_GROUPS: MidtbyenGroup[] = [
  { id: "klaer-mote", label: "Klær & mote", icon: "ShoppingBag", color: "#e8618c" },
  { id: "interior-hjem", label: "Interiør & hjem", icon: "Home", color: "#f8ae17" },
  { id: "helse-velvare", label: "Helse & velvære", icon: "Sparkles", color: "#36d16f" },
  { id: "sport-fritid", label: "Sport & fritid", icon: "Dumbbell", color: "#23b1f0" },
  { id: "boker-spill-hobby", label: "Bøker, spill & hobby", icon: "BookOpen", color: "#8b5cf6" },
  { id: "mat-drikke", label: "Mat & drikke", icon: "Coffee", color: "#f35a5a" },
  { id: ANNET_GROUP_ID, label: "Annet", icon: "Building2", color: "#94a3b8" },
];

interface TermAssignment {
  groupId: string;
  /** Høyere vekt = sterkere utsagn om hva butikken er. */
  weight: number;
}

/**
 * Alle 28 filtertermer med gruppe og vekt.
 *
 * Vektene, grovt lest:
 *   10  yrke eller vare som definerer butikken alene (frisør, tannlege, apotek)
 *  8–9  tydelig spesialitet (blomster, jernvare, bøker, sport)
 *  5–7  varegruppe som ofte, men ikke alltid, er hovedsaken (møbler, interiør)
 *  1–4  sortimentstermer nesten hvem som helst kan bære (dame, herre, tilbehør)
 */
const TERM_ASSIGNMENTS: Record<number, TermAssignment> = {
  146: { groupId: "helse-velvare", weight: 10 }, // Frisør
  421: { groupId: "helse-velvare", weight: 10 }, // Tannlege
  115: { groupId: "helse-velvare", weight: 10 }, // Helsekost/Apotek
  107: { groupId: "helse-velvare", weight: 10 }, // Briller/Linser
  113: { groupId: "mat-drikke", weight: 3 }, // Snack/drikkevarer
  142: { groupId: "interior-hjem", weight: 9 }, // Blomster
  143: { groupId: "interior-hjem", weight: 9 }, // Jernvare
  144: { groupId: "interior-hjem", weight: 9 }, // Maling
  101: { groupId: "sport-fritid", weight: 8 }, // Sport & Fritid
  108: { groupId: "boker-spill-hobby", weight: 6 }, // Bøker
  109: { groupId: "boker-spill-hobby", weight: 8 }, // Spill/Underholdning
  105: { groupId: "boker-spill-hobby", weight: 8 }, // Foto/Elektronikk
  16: { groupId: "interior-hjem", weight: 7 }, // Møbler
  112: { groupId: "boker-spill-hobby", weight: 5 }, // Leker/Hobby
  24: { groupId: "klaer-mote", weight: 4 }, // Reiseartikler
  114: { groupId: "interior-hjem", weight: 6 }, // Husholdningsartikler
  106: { groupId: "klaer-mote", weight: 6 }, // Gullsmed/klokker
  103: { groupId: "klaer-mote", weight: 5 }, // Vintage/Second-hand
  15: { groupId: "interior-hjem", weight: 2 }, // Interiør
  34: { groupId: "helse-velvare", weight: 3 }, // Hud, hår og velvære
  104: { groupId: "klaer-mote", weight: 3 }, // Undertøy/Badetøy
  19: { groupId: "klaer-mote", weight: 3 }, // Sko
  33: { groupId: "klaer-mote", weight: 2 }, // Barn/ungdom
  14: { groupId: "klaer-mote", weight: 2 }, // Klær
  20: { groupId: "klaer-mote", weight: 2 }, // Veske
  21: { groupId: "klaer-mote", weight: 1 }, // Tilbehør
  22: { groupId: "klaer-mote", weight: 1 }, // Dame
  23: { groupId: "klaer-mote", weight: 1 }, // Herre
};

/** Eksponert for test: hver av de 28 termene skal ha en tilordning. */
export const ASSIGNED_TERM_IDS = Object.keys(TERM_ASSIGNMENTS).map(Number);

const GROUPS_BY_ID = new Map(MIDTBYEN_GROUPS.map((g) => [g.id, g]));

/**
 * Gruppen en butikk hører til, avgjort av dens tyngste term.
 *
 * Faller alltid tilbake til «Annet» — aldri til undefined. Tre butikker i
 * kilden (7-Eleven, Trondheim parkering, Trondheim trafikkskole) har ingen
 * filterterm i det hele tatt, og en butikk uten gruppe ville forsvunnet fra
 * kartet uten at noen merket det.
 *
 * Ved lik vekt vinner laveste term-ID, slik at tilordningen er deterministisk
 * og ikke avhenger av rekkefølgen kilden skriver `data-terms` i.
 */
export function groupForStore(termIds: number[]): MidtbyenGroup {
  let best: { termId: number; assignment: TermAssignment } | null = null;

  for (const termId of termIds) {
    const assignment = TERM_ASSIGNMENTS[termId];
    if (!assignment) continue;
    if (
      !best ||
      assignment.weight > best.assignment.weight ||
      (assignment.weight === best.assignment.weight && termId < best.termId)
    ) {
      best = { termId, assignment };
    }
  }

  const group = best ? GROUPS_BY_ID.get(best.assignment.groupId) : undefined;
  return group ?? GROUPS_BY_ID.get(ANNET_GROUP_ID)!;
}
