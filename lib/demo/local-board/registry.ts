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
   * Valgfritt fordi et datasett uten navngitt guide ikke skal måtte si nei:
   * utelatt betyr den navnløse Placy-kontrollen, som er det boards uten lokal
   * demo alltid har vist.
   */
  guidedPersona?: boolean;
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

/** Alle funksjonene på: det den første lokale demoen (Nyhavna) etablerte. */
const ALL_FEATURES: LocalDemoFeatures = {
  faqProgress: true,
  revealPlaces: true,
  followHighlightCategory: true,
  unscopedCategoryList: true,
  narrationFocus: true,
  voicePacing: true,
  guidedPersona: true,
};

export const LOCAL_DEMOS: readonly LocalDemoDescriptor[] = [
  {
    id: "nyhavna-lokal",
    directory: "data/demo/nyhavna-lokal",
    readme: "docs/research/nyhavna-lokal-demo/README.md",
    features: ALL_FEATURES,
  },
];

export const LOCAL_DEMO_IDS: readonly string[] = LOCAL_DEMOS.map((demo) => demo.id);

export function isLocalDemoId(value: string): boolean {
  return LOCAL_DEMO_IDS.includes(value);
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
