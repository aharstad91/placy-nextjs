/**
 * Nyhavnas eget «Leve»-innhold, gjort stedfestet.
 *
 * ## Hva denne demoen påstår
 *
 * At innholdet Nyhavna Utvikling allerede har skrevet om bydelen blir lettere å
 * forstå og oppdage når det knyttes til stedene i kartet. Ingenting her er
 * nytt innhold: hver beskrivelse er Nyhavnas egen, gjengitt som sitat eller
 * tett sammendrag, med lenke til siden den står på.
 *
 * ## Tre regler som gjelder hver eneste rad under
 *
 * 1. **Kilden bærer teksten.** Vi omskriver ikke til vår egen stemme. Der vi
 *    forkorter, forkorter vi ved å kutte — ikke ved å formulere om.
 * 2. **Eksisterende og planlagt holdes fra hverandre.** `developmentStatus`
 *    er satt på hvert sted, og begrunnelsen står i kommentaren over det:
 *    presens i kilden = finnes, futurum = kommer. Der kilden sier begge deler
 *    om samme sted (Elvepromenaden), sier demoen begge deler.
 * 3. **Plassering uten belegg merkes.** `locationPrecision: "approximate"` er
 *    ikke en intern note — den rendres som forbehold på flaten.
 *
 * ## Hva som med vilje IKKE er her
 *
 * Nyhetsartikler og arrangementsfeed (utenfor demoens ramme), og de planlagte
 * parkene kilden navngir uten å avgrense — Kullkranparken, Jernbaneparken,
 * Transittparken, Elveparken, allmenningene ved Ladehammerkaia. De står som
 * navn i temateksten for park, der de hører hjemme, og ikke som punkter vi
 * ville måttet gjette plasseringen av.
 *
 * Alle koordinater er hentet fra OpenStreetMap 2026-09-11 med mindre annet er
 * notert. Demoen skriver ingenting til Supabase.
 */

import type { Category, CuratedGeometryFeature, POI } from "@/lib/types";
import {
  CATEGORY_KULTUR_ID,
  CATEGORY_PARK_ID,
  CATEGORY_SERVERING_ID,
  THEME_KULTUR_ID,
  THEME_PARK_ID,
  THEME_SERVERING_ID,
} from "./ids";
import {
  NYHAVNA_KULTUR,
  NYHAVNA_LEVE,
  NYHAVNA_PARK,
  NYHAVNA_SERVERING,
} from "./sources";
import { NYHAVNA_LEVE_GEOMETRY } from "./geometry";

/**
 * Fargene er Placys egne temafarger, ikke nye.
 *
 * Servering, natur og opplevelser finnes allerede på Nyhavna-boardet med
 * nøyaktig disse verdiene. Å låne dem gjør at «Fra nyhavna.no» leser som et lag
 * i det samme kartet, ikke som en fremmed innliming — og det er hele poenget
 * med demoen.
 */
const FARGE_SERVERING = "#f35a5a";
const FARGE_PARK = "#22c68d";
const FARGE_KULTUR = "#a06cf5";

export const LEVE_CATEGORIES: Category[] = [
  {
    id: CATEGORY_SERVERING_ID,
    name: "Café og restauranter",
    icon: "Coffee",
    color: FARGE_SERVERING,
  },
  {
    id: CATEGORY_PARK_ID,
    name: "Park og promenade",
    icon: "TreePine",
    color: FARGE_PARK,
  },
  {
    id: CATEGORY_KULTUR_ID,
    name: "Kunst og kultur",
    icon: "Drama",
    color: FARGE_KULTUR,
  },
];

const CATEGORY_BY_ID = new Map(LEVE_CATEGORIES.map((c) => [c.id, c]));

/** Kortform så radene under ikke drukner i felt som er like for alle. */
function poi(input: {
  id: string;
  name: string;
  lat: number;
  lng: number;
  categoryId: string;
  /** Ikon per sted — underkategoriens jobb, jf. temafarge-regelen. */
  icon: string;
  address?: string;
  /** Nyhavnas egne ord. Første avsnitt vises i lista, hele i drill-in. */
  body: string;
  /** Ekstra avsnitt — typisk hva som er planlagt for stedet. */
  bodyMore?: string;
  status: "existing" | "planned";
  precision?: "sourced" | "approximate";
  /** Vises som forbehold på flaten når `precision` er `approximate`. Holdes
   *  utenfor beskrivelsen: det er en opplysning om kartet, ikke om stedet. */
  precisionNote?: string;
  sourceUrl: string;
  /** Stedets egen kanal, når kilden lenker til den. */
  website?: string;
  image?: string;
}): POI {
  const category = CATEGORY_BY_ID.get(input.categoryId);
  if (!category) throw new Error(`Ukjent demo-kategori: ${input.categoryId}`);
  return {
    id: input.id,
    name: input.name,
    coordinates: { lat: input.lat, lng: input.lng },
    address: input.address,
    category: { ...category, icon: input.icon },
    editorialHook: input.body,
    localInsight: input.bodyMore,
    editorialSources: [input.sourceUrl],
    developmentStatus: input.status,
    locationPrecision: input.precision ?? "sourced",
    locationNote: input.precisionNote,
    googleWebsite: input.website,
    featuredImage: input.image,
    // Demo-POI-ene er kuraterte av kilden selv — de skal aldri demoteres av
    // tier-sorteringen i lista.
    poiTier: 1,
  };
}

// ===========================================================================
// SERVERING — https://nyhavna.no/leve/cafe-og-restauranter/
// ===========================================================================

const DORA_KAFFEBAR = poi({
  id: "leve-dora-kaffebar",
  name: "Dora Kaffebar",
  // OSM node 13367057293. Samsvarer med Kobbes gate 2 (OSM node 4842129929,
  // 30 m unna) — to uavhengige kilder på samme adresse.
  lat: 63.4391121,
  lng: 10.4191519,
  address: "Kobbes gate 2",
  categoryId: CATEGORY_SERVERING_ID,
  icon: "Coffee",
  // EKSISTERENDE: kilden står i presens hele veien — «er en nabolagskafé …
  // som baker … og brygger» — og sidens ingress sier «Allerede i dag finnes
  // det kafeer, restauranter og bryggeri her».
  status: "existing",
  body: "Dora Kaffebar er en nabolagskafé i Kobbes gate 2 som baker brød og søtbakst og brygger håndverkskaffe til deg. En fin plass å stikke innom på ukedagene på dagtid.",
  sourceUrl: NYHAVNA_SERVERING.url,
  website: "https://www.instagram.com/dorakaffe/",
});

const MONKEY_BREW = poi({
  id: "leve-monkey-brew",
  name: "Monkey Brew",
  // OSM node 12481266199 (navngitt). 40 m fra Kobbes gate 10 (node
  // 2958658675), som er adressen kilden oppgir.
  lat: 63.4407471,
  lng: 10.4211947,
  address: "Kobbes gate 10",
  categoryId: CATEGORY_SERVERING_ID,
  icon: "Wine",
  // EKSISTERENDE: presens + konkret åpningstid i kilden («På torsdager og
  // fredag har MonkeyBrew utsalg fra sine lokaler i Kobbes gate 10»).
  status: "existing",
  body: "Mikrobryggeriet MonkeyBrew lager fruktig og surt øl, og har bygget og brygget seg opp til å bli en anerkjent leverandør av håndverksbrygg både til byens utesteder, men også Vinmonopolet.",
  bodyMore:
    "På torsdager og fredag har MonkeyBrew utsalg fra sine lokaler i Kobbes gate 10, der du kan se på bryggeriet og også få kjøpt kult merch.",
  sourceUrl: NYHAVNA_SERVERING.url,
  website: "https://monkeybrew.no/",
});

// ===========================================================================
// PARK OG PROMENADE — https://nyhavna.no/leve/park-og-promenade/
// ===========================================================================

const ELVEPROMENADEN = poi({
  id: "leve-elvepromenaden",
  name: "Elvepromenaden",
  // Midtpunktet på det sourcede forløpet (se geometry.ts). Punktet finnes
  // bare så stedet kan ha en rad i lista og et kamera å fly til — linja er
  // den egentlige representasjonen.
  lat: 63.438308,
  lng: 10.411348,
  categoryId: CATEGORY_PARK_ID,
  icon: "Waves",
  // EKSISTERENDE som ferdselsåre. Kilden er eksplisitt: «Her kan du allerede
  // i dag gå, sykle eller bare nyte utsikten.» Oppgraderingen til park er
  // futurum og står i `bodyMore`, som flaten merker som planlagt.
  status: "existing",
  body: "Elvepromenaden skal bli en grønn oase langs Nidelva, midt i byen! Her kan du allerede i dag gå, sykle eller bare nyte utsikten.",
  bodyMore:
    "Nå skal den bli langt mer enn bare en sti – en levende park med benker, lekeapparater, kunst og små overraskelser underveis. Elvepromenaden vil knytte seg sømløst til Doraparken med sine serveringssteder og aktiviteter og parken ytterst på Transittkaia hvor små og store barn inviteres til utforsking og lek.",
  sourceUrl: NYHAVNA_PARK.url,
  image: "/demo/nyhavna/elvepromenaden.jpg",
});

// ===========================================================================
// KUNST OG KULTUR — https://nyhavna.no/leve/kunst-og-kultur/
// ===========================================================================

const KULTURAKSEN = poi({
  id: "leve-kulturaksen",
  name: "Kulturaksen i Skippergata",
  // Midtpunktet på Skippergata-strekningen mellom Fyringsbunkeren og Dora 2.
  lat: 63.439763,
  lng: 10.417595,
  categoryId: CATEGORY_KULTUR_ID,
  icon: "Drama",
  // EKSISTERENDE som sted — de fire stedene ligger der i dag («Her ligger
  // Fyringsbunkeren, Dora2, Doratorget og Bunkerparken»). Kulturbruken er det
  // som er planlagt, og det står i teksten.
  status: "existing",
  body: "Her ligger Fyringsbunkeren, Dora2, Doratorget og Bunkerparken som er godt egnet for kulturaktiviteter.",
  bodyMore:
    "I tillegg kommer det store uteareal med både Doratorget samt Bunkerparken foran Fyringsbunkeren hvor det også kan tilrettelegges for kulturaktiviteter og kunst i offentlig rom.",
  sourceUrl: NYHAVNA_KULTUR.url,
});

const FYRINGSBUNKEREN = poi({
  id: "leve-fyringsbunkeren",
  name: "Fyringsbunkeren",
  // Arealsentroide av OSM way 80560182 (bygningsomriss, military=bunker).
  lat: 63.43955,
  lng: 10.418695,
  address: "Skippergata 10",
  categoryId: CATEGORY_KULTUR_ID,
  icon: "Landmark",
  // EKSISTERENDE: bygget står, og er ett av de tolv vernede byggene kilden
  // omtaler. At det «i hovedsak skal leies ut til kunst- og kulturaktører» er
  // planen, og den står i `bodyMore`.
  status: "existing",
  body: "Ett av kulturminnene i kulturaksen. Nyhavna har i alt 12 vernede bygg bygd av okkupasjonsmakten under 2. verdenskrig. 11 av disse vil inngå i Nyhavna Utvikling sine planer, mens Dora1 er i privat eie.",
  bodyMore:
    "Kulturminnene er av stor historisk betydning, både nasjonalt og internasjonalt. De skal derfor renoveres, og i hovedsak leies ut til kunst- og kulturaktører.",
  sourceUrl: NYHAVNA_KULTUR.url,
});

const DORA2 = poi({
  id: "leve-dora2",
  name: "Dora 2",
  // Arealsentroide av OSM way 80560165 (bygningsomriss, submarine_pen).
  lat: 63.440482,
  lng: 10.416411,
  address: "Skippergata 16",
  categoryId: CATEGORY_KULTUR_ID,
  icon: "Landmark",
  // EKSISTERENDE: bygget står. Kilden navngir det i presens som del av
  // kulturaksen.
  status: "existing",
  body: "Ubåtbunkeren Dora2 er ett av de fire stedene Nyhavna peker ut i kulturaksen i Skippergata, og er godt egnet for kulturaktiviteter.",
  sourceUrl: NYHAVNA_KULTUR.url,
});

/**
 * DORATORGET ER MED VILJE IKKE ET PUNKT.
 *
 * Kilden navngir det: «Her ligger Fyringsbunkeren, Dora2, Doratorget og
 * Bunkerparken». Men stedet finnes hverken i OpenStreetMap eller i Kartverkets
 * stedsnavnregister, det er ikke bygget, og de to lesningene vi fant av hvor
 * det skal ligge — i kulturaksen ved Skippergata, og som foreslått torg lenger
 * vest mot Transittkaia — spriker med flere hundre meter.
 *
 * Et punkt her ville vært en gjetning som så ut som et faktum. Doratorget står
 * derfor i `ikkePlassert` på kultur-temaet, der navnet er synlig og forbeholdet
 * står ved siden av. Dagen Nyhavna gir oss plasseringen, blir det ett felt.
 */

const BUNKERPARKEN = poi({
  id: "leve-bunkerparken",
  name: "Bunkerparken",
  // OMTRENTLIG, men RETNINGEN er belagt: kilden sier «Bunkerparken foran
  // Fyringsbunkeren». Punktet ligger på Fyringsbunkerens egen breddegrad, ~25 m
  // vest for sentroiden — altså foran bygget, mot Skippergata. Til forskjell
  // fra Doratorget har vi her en entydig kilde på HVOR i forhold til hva, og
  // da er et merket punkt bedre enn ingenting. Avgrensningen er ukjent.
  lat: 63.43955,
  lng: 10.4182,
  categoryId: CATEGORY_KULTUR_ID,
  icon: "TreePine",
  status: "planned",
  precision: "approximate",
  precisionNote:
    "Plassert omtrentlig foran Fyringsbunkeren, slik kilden beskriver den. Avgrensningen er ikke offentlig.",
  body: "Uteareal foran Fyringsbunkeren, pekt ut som del av kulturaksen i Skippergata. Her kan det tilrettelegges for kulturaktiviteter og kunst i offentlig rom.",
  sourceUrl: NYHAVNA_KULTUR.url,
});

export const LEVE_POIS: POI[] = [
  DORA_KAFFEBAR,
  MONKEY_BREW,
  ELVEPROMENADEN,
  KULTURAKSEN,
  FYRINGSBUNKEREN,
  DORA2,
  BUNKERPARKEN,
];

// ===========================================================================
// Temaene — Nyhavnas tre «Leve»-sider som innganger i kartet
// ===========================================================================

export interface LeveTheme {
  id: string;
  name: string;
  icon: string;
  color: string;
  categoryId: string;
  /** Kort ledetekst i temabrikken. */
  leadText: string;
  /** Nyhavnas egen ingress fra siden, som kolonnens brødtekst. */
  body: string;
  source: typeof NYHAVNA_LEVE;
  /** Stedene kilden navngir, men som ikke kan plasseres. Vises som en egen,
   *  ærlig linje under utvalget — ikke som pins. */
  ikkePlassert?: string[];
}

export const LEVE_THEMES: LeveTheme[] = [
  {
    id: THEME_SERVERING_ID,
    // Kildens eget seksjonsnavn, ikke vårt. Boardet har allerede et tema som
    // heter «Servering», og to like brikker i samme rad er en felle — men det
    // er ikke hovedgrunnen. Lene skal kjenne igjen sin egen meny.
    name: "Café og restauranter",
    icon: "Coffee",
    color: FARGE_SERVERING,
    categoryId: CATEGORY_SERVERING_ID,
    leadText: "Kafeer, restauranter og bryggeri på Nyhavna.",
    body: "På Nyhavna kan ganen gå i land og nyte mat og drikke forankret i tradisjoner. Ofte får du det servert med en moderne vri som kan overraske. Allerede i dag finnes det kafeer, restauranter og bryggeri her, der innovasjon over fatene og et vennlig smil over glassene er rettesnor. Og flere vil snart komme!",
    source: NYHAVNA_SERVERING,
  },
  {
    id: THEME_PARK_ID,
    name: "Park og promenade",
    icon: "TreePine",
    color: FARGE_PARK,
    categoryId: CATEGORY_PARK_ID,
    leadText: "Grønne områder og vannet innen rekkevidde.",
    body: "På Nyhavna kommer parker og byrom som inviterer til liv, lek og fellesskap. Her er vannet alltid innen rekkevidde – midt i byen.\n\nFra den frodige Kullkranparken til de åpne allmenningene ved Ladehammerkaia får Nyhavna et grønt nettverk av både velstelte parker og mer naturpregede landskap.",
    source: NYHAVNA_PARK,
    ikkePlassert: [
      "Kullkranparken",
      "Jernbaneparken",
      "Transittparken",
      "Elveparken langs Transittkaia",
      "Allmenningene ved Ladehammerkaia",
    ],
  },
  {
    id: THEME_KULTUR_ID,
    name: "Kunst og kultur",
    icon: "Drama",
    color: FARGE_KULTUR,
    categoryId: CATEGORY_KULTUR_ID,
    leadText: "Kulturminner, verksteder og kunst i offentlig rom.",
    body: "Nyhavna satser tungt på kultur. Vi åpner områder der folk kan møte kunst i det offentlige rom, og vi setter i stand lokaler og øvingsrom der kunstnere og kulturaktører kan bruke sin kreativitet.\n\nKunst og kultur skal prege hele Nyhavna, men tre områder er pekt ut som kulturelle tyngdepunkter. Kulturaksen i Skippergata er ett av dem.",
    source: NYHAVNA_KULTUR,
    ikkePlassert: [
      "Doratorget (navngitt i kulturaksen, men uten bekreftet plassering)",
      "Kullkranpiren",
      "Strandveikaia",
    ],
  },
];

export const LEVE_GEOMETRY: CuratedGeometryFeature[] = NYHAVNA_LEVE_GEOMETRY;

/** Kildefotnoten som står i bunnen av «Fra nyhavna.no»-inngangen. */
export const LEVE_INTRO = {
  title: "Fra nyhavna.no",
  body: "Nyhavna seiler opp som en av de mest spennende områdene å bo, leve og oppleve i Trondheim. Med sin beliggenhet mellom Nidelva i vest, Lademoen i øst, Ladehammeren i nord og Nedre Elvehavn i sør, kan du raskt rusle hit fra Brattøra, eller ta en kort spasertur fra Solsiden og Trondheim sentrum.",
  source: NYHAVNA_LEVE,
};
