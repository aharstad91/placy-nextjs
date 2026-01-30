/**
 * Hardcoded narrative content for the portrait prototype.
 *
 * This is prototype-specific — production would need an editorial pipeline.
 * The content is structured as chapters that reference POI IDs.
 * Each chapter has narrative paragraphs where POIs are woven naturally into the text.
 */

export interface PortraitContent {
  heroTitle: string;
  heroSubtitle: string;
  intro: string[];
  chapters: ChapterContent[];
  closing: {
    title: string;
    paragraphs: string[];
  };
}

export interface ChapterContent {
  id: string;
  label: string;
  title: string;
  /**
   * Narrative blocks. Each block is either:
   * - A plain string (paragraph of prose)
   * - A POI reference: { poiId: string, mode: "feature" | "woven", narrative?: string }
   *
   * "woven" means the POI is mentioned inline in surrounding prose.
   * "feature" means the POI gets a visual block with image/details.
   */
  blocks: NarrativeBlock[];
}

export type NarrativeBlock =
  | { type: "prose"; text: string }
  | { type: "poi"; poiId: string; mode: "feature" | "woven"; narrative?: string }
  | { type: "map" };

// --- Ferjemannsveien 10, Trondheim ---

export const ferjemannsveien10Content: PortraitContent = {
  heroTitle: "Nabolaget ved elva",
  heroSubtitle: "Et portrett av livet rundt Ferjemannsveien 10, Trondheim",

  intro: [
    "Det finnes steder du bor, og steder du hører til. Ferjemannsveien 10 ligger der Nidelva svinger forbi Bakklandet og møter Solsiden — midt i det som mange kaller Trondheims mest levende bydel. Her handler ikke nabolaget om én gate eller ett landemerke, men om det som skjer i mellomrommene: på kaféhjørnene, i bakgatene, langs elvestien.",
    "Dette er et nabolag med lag. Under overflaten av kjente restauranter og kaféer finnes et nettverk av folk som har valgt å bygge noe her — fra kaffebrennere som startet i en bakgård til bakverk som har formet byens smak i over to tiår. Stedene forteller en historie om håndverk, nærhet til naturen, og en by som stadig finner seg selv på nytt.",
  ],

  chapters: [
    {
      id: "matbyen",
      label: "Kapittel 1",
      title: "Matbyen ved elva",
      blocks: [
        {
          type: "prose",
          text: "Trondheim har blitt en matby. Ikke på den høylytte, michelin-jaktende måten — men stille, med håndverkere som velger kvalitet over synlighet. Rundt Ferjemannsveien finner du et bemerkelsesverdig tett lag av kafeer, bakerier og restauranter som til sammen definerer nabolagets kulinariske identitet.",
        },
        {
          type: "poi",
          poiId: "jacobsen-svart",
          mode: "feature",
        },
        {
          type: "prose",
          text: "Like over elva, i de ikoniske trebygningene på Bakklandet, har en annen slags kafé funnet sin plass. Her handler det ikke bare om kaffen — men om rommet den serveres i.",
        },
        {
          type: "poi",
          poiId: "sellanraa",
          mode: "woven",
          narrative:
            "Sellanraa Bok & Bar holder til i byens gamle brannstasjon med dør rett inn til biblioteket. Baristaene har vunnet NM — men det er kombinasjonen av bøker, kaffe og det høye under taket som gjør dette til mer enn en kafé.",
        },
        {
          type: "prose",
          text: "Bakverkene i nabolaget forteller sin egen historie. Her finnes det bakere som har holdt på i tiår, og nykommere som allerede har satt spor.",
        },
        {
          type: "poi",
          poiId: "godt-brod-thomas",
          mode: "woven",
          narrative:
            "Godt Brød Thomas Angells gate har bakt surdeigsbrød som har satt standarden i byen siden 2003. Kanelsnurrene går tom før lunsj — og det vet de lokale.",
        },
        {
          type: "poi",
          poiId: "nabolaget-bagelri",
          mode: "feature",
        },
        {
          type: "map",
        },
      ],
    },
    {
      id: "smak-og-atmosfaere",
      label: "Kapittel 2",
      title: "Smak og atmosfære",
      blocks: [
        {
          type: "prose",
          text: "Når kvelden kommer, skifter nabolaget karakter. Gatene som var fulle av kaffedrikkere og barnevogner på formiddagen fylles nå av folk på vei ut. Her trenger du ikke planlegge — du bare går ut døra og lar nabolaget bestemme.",
        },
        {
          type: "poi",
          poiId: "blomster-og-vin",
          mode: "feature",
        },
        {
          type: "prose",
          text: "For de som foretrekker et bredere laken, byr nabolaget på alt fra napolitansk pizza til nordisk fusjon. Det handler ikke om én stil, men om mangfoldet av smaker som finnes innenfor noen få kvartaler.",
        },
        {
          type: "poi",
          poiId: "hevd-bakery",
          mode: "woven",
          narrative:
            "Hevd Bakery & Pizzeria ligger rett ved Ferjemannsveien 10 og baker napolitansk pizza med 72 timers hevet deig — i en vedovn importert fra Napoli. Perfekt for en rask lunsj man kan ta med ned til elva.",
        },
        {
          type: "poi",
          poiId: "amber-restaurant",
          mode: "woven",
          narrative:
            "Amber Restaurant kombinerer nordisk finesse med asiatiske teknikker — lokale råvarer i en uventet kontekst. Bestill smaksmenyen for å oppleve hele spekteret.",
        },
        {
          type: "poi",
          poiId: "robata-asian-fusion",
          mode: "woven",
          narrative:
            "Og for de som søker noe helt annet, byr Robata Asian Fusion på japansk-inspirert robata-grill med smaker fra hele Asia. Dele-menyen er et godt sted å starte.",
        },
        {
          type: "map",
        },
      ],
    },
    {
      id: "det-aktive-livet",
      label: "Kapittel 3",
      title: "Det aktive livet",
      blocks: [
        {
          type: "prose",
          text: "Et nabolag er mer enn det du spiser og drikker. Det er også hvordan du starter morgenen, hvor du løper etter jobb, og hva du ser gjennom vinduet. Rundt Ferjemannsveien har naturen en tilstedeværelse som gjør at byen aldri føles helt urban.",
        },
        {
          type: "poi",
          poiId: "nidelva-elvesti",
          mode: "feature",
        },
        {
          type: "prose",
          text: "For de som foretrekker sjøluft fremfor elvesus, finnes det en annen rute som starter der byen slutter og havet begynner.",
        },
        {
          type: "poi",
          poiId: "ladestien",
          mode: "woven",
          narrative:
            "Ladestien er en kyststi fra Lade til Korsvika med spektakulær utsikt over fjorden og Munkholmen. Ta buss ut og gå tilbake — syv kilometer med badeplasser underveis.",
        },
        {
          type: "prose",
          text: "Hverdagsformen er også ivaretatt. To treningssentre i gangavstand dekker ulike behov — fra tidligmorgentrening til sene kvelder.",
        },
        {
          type: "poi",
          poiId: "sats-solsiden",
          mode: "woven",
          narrative:
            "SATS Solsiden er det store senteret med alt fra gruppetimer til styrke, populært blant kontorfolkene i området.",
        },
        {
          type: "poi",
          poiId: "evo-midtbyen",
          mode: "woven",
          narrative:
            "Evo Fitness Midtbyen er det rimelige alternativet — åpent 24/7 uten bindingstid, for de som trener på sine egne premisser.",
        },
        {
          type: "map",
        },
      ],
    },
  ],

  closing: {
    title: "Hvem passer dette nabolaget for?",
    paragraphs: [
      "Ferjemannsveien 10 er for deg som vil ha byen tett på, men ikke oppå deg. For deg som verdsetter håndverk — i kaffen, i brødet, på tallerkenen. For deg som starter dagen med en løpetur langs elva og avslutter den med et glass naturvin på hjørnet.",
      "Det er et nabolag som belønner nysgjerrighet. Som har lag du oppdager over tid. Der du etter noen uker kjenner igjen barnehagebarna som passerer vinduet ditt på formiddagen, og vet at du kan ta en omvei via Bakklandet uten at det koster mer enn fem minutter.",
      "Kort sagt: det er et sted du kan høre til.",
    ],
  },
};
