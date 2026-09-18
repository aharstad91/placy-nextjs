import { LocalDatasetError } from "@/lib/demo/local-board/errors";

/**
 * Registeret over godkjente lokale demoer (2026-09-18).
 *
 * ## Hvorfor et register og ikke en mappe-parameter
 *
 * Den lokale demoen leser JSON fra disk. Hvis mappa kunne komme fra en URL, en
 * spørrestreng eller et boardfelt, ville «hvilket datasett» blitt en filsti
 * brukeren bestemmer. Derfor er dette den ENESTE lista over mapper som kan
 * lastes: flaten sender en ID, registeret svarer med mappa. En ID som ikke står
 * her finnes ikke — den faller aldri tilbake på en annen demo, for en stille
 * tilbakefall til Nyhavna er nettopp feilen demoene finnes for å unngå.
 *
 * ## Hvorfor funksjonsflaggene ligger her
 *
 * Presentasjon, FAQ-fremdrift og utvidelse av steder var tidligere slått på av
 * en sammenligning mot slug-en `nyhavna-lokal`. Da var «hvilken demo er dette»
 * og «hvilke funksjoner har den» samme spørsmål, og et nytt datasett arvet
 * enten alt eller ingenting. Her er de to forskjellige spørsmål: identiteten er
 * `id`, funksjonsstøtten er `features`, og hver demo svarer for seg.
 *
 * Derfor deler ingen demoer en felles flagg-konstant, selv når de er enige i
 * dag: hver deskriptor skriver ut hvert flagg selv. Med en delt konstant ville
 * et framtidig flagg slått seg på hos alle uten at noen hadde vurdert om
 * datasettet bærer innholdet flagget forutsetter.
 */

/**
 * Felles funksjoner en lokal demo kan slå på.
 *
 * Feltene beskriver FLATENS oppførsel, ikke innholdet: innholdet ligger i
 * datasettets egne filer. Alle er eksplisitte — ingen `default: true` — slik at
 * en ny demo må ta stilling til hver enkelt.
 */
export interface LocalDemoFeatures {
  /** Sidebarens FAQ-fremdrift: hvilke spørsmål som er utforsket i samtalen. */
  faqProgress: boolean;
  /** Kartkommandoen `reveal_places` og «vis flere»-utvidelsen av radius. */
  revealPlaces: boolean;
  /** Kategorien følger stedene guiden fremhever. */
  followHighlightCategory: boolean;
  /** Kategorilista viser hele utvalget i stedet for bare det kartutsnittet dekker. */
  unscopedCategoryList: boolean;
  /** Kartet følger stedet fortellerstemmen nevner akkurat nå. */
  narrationFocus: boolean;
  /** Tempoinstruksen legges på hilsenen. */
  voicePacing: boolean;
  /**
   * Samtalen presenteres som den navngitte guiden Anja, ikke som «Placy».
   * `false` gir den navnløse Placy-kontrollen, som er det boards uten lokal
   * demo alltid har vist.
   */
  guidedPersona: boolean;
}

export interface LocalDemoDescriptor {
  /** Datasett-ID-en flaten og Live-ruta bruker. Også prefikset i innholds-hashen. */
  id: string;
  /** Mappa datasettets seks JSON-filer ligger i, relativt til repo-rota. */
  directory: string;
  /** Dokumentet feilmeldingene sender folk til når en fil mangler. */
  readme: string;
  features: LocalDemoFeatures;
}

export const LOCAL_DEMOS = [
  {
    id: "nyhavna-lokal",
    directory: "data/demo/nyhavna-lokal",
    readme: "docs/research/nyhavna-lokal-demo/README.md",
    features: {
      faqProgress: true,
      revealPlaces: true,
      followHighlightCategory: true,
      unscopedCategoryList: true,
      narrationFocus: true,
      voicePacing: true,
      guidedPersona: true,
    },
  },
  {
    id: "leangenbukta-lokal",
    directory: "data/demo/leangenbukta-lokal",
    readme: "docs/research/leangenbukta-lokal-demo/README.md",
    features: {
      faqProgress: true,
      revealPlaces: true,
      followHighlightCategory: true,
      unscopedCategoryList: true,
      narrationFocus: true,
      voicePacing: true,
      guidedPersona: true,
    },
  },
] as const satisfies readonly LocalDemoDescriptor[];

/**
 * ID-ene som finnes, som en type.
 *
 * Avledet av lista og ikke skrevet ned ved siden av den: en union som må
 * vedlikeholdes for hånd er en union som blir uenig med registeret.
 */
export type LocalDemoId = (typeof LOCAL_DEMOS)[number]["id"];

export const LOCAL_DEMO_IDS: readonly LocalDemoId[] = LOCAL_DEMOS.map((demo) => demo.id);

export function isLocalDemoId(value: string): value is LocalDemoId {
  return LOCAL_DEMO_IDS.some((id) => id === value);
}

/**
 * Slår opp én godkjent demo.
 *
 * Kaster på ukjent ID i stedet for å returnere `undefined`: en oppringer som
 * glemmer å sjekke ville ellers fått den første demoen i lista, og det er
 * akkurat det tilbakefallet registeret finnes for å hindre.
 */
export function getLocalDemo(id: string): LocalDemoDescriptor {
  const demo = LOCAL_DEMOS.find((candidate) => candidate.id === id);
  if (!demo) {
    throw new LocalDatasetError(
      `Ukjent lokalt datasett «${id}». Godkjente: ${LOCAL_DEMO_IDS.join(", ")}.`,
    );
  }
  return demo;
}
