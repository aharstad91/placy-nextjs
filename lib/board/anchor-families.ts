/**
 * Anker-familiene: hvilke slags steder som kan representere andre steder.
 *
 * Ankeret ble bygget for kjøpesenteret (2026-08-27), men mekanismen er ikke
 * kjøpesenter-spesifikk. Den svarer på ett generelt spørsmål: *er dette ett sted
 * eller mange?* Målt på fire Trondheims-board 2026-08-28 gir idrettsanlegg
 * nøyaktig samme feil som Sirkus ga:
 *
 *   Ranheim idrettspark        8 pinner for ett anlegg
 *   Charlottenlund             7
 *   Leangen idrettsanlegg     13
 *   Lade idrettspark          13
 *
 * Ingen annen kategori gjør dette. Dagligvare, bakeri, tannlege og legesenter
 * står 1:1 med virkeligheten på de samme boardene. Det er fordi butikker er
 * virksomheter — én oppføring hver — mens et idrettsanlegg er et OMRÅDE der
 * hver bane, hall og løpebane er registrert som sitt eget objekt hos både
 * Google og OSM.
 *
 * ## Hvorfor familiene trenger ULIKE regler
 *
 * Det var fristende å bare utvide `ANCHOR_CATEGORY` fra `shopping` til
 * `{shopping, idrett}`. Tre målte forskjeller gjør det feil:
 *
 * 1. **Medlemmene deler kategori med ankeret.** Sirkus er `shopping` og
 *    medlemmene er dagligvare, apotek og frisør. «Ranheim Idrettspark» er
 *    `idrett` og medlemmene er `idrett` — hver eneste én. Dagens regel
 *    (`p.categoryId !== ANCHOR_CATEGORY`) ville utelukket ALLE medlemmene.
 *
 * 2. **Anlegget er større enn bygget.** Sirkus' fjerneste medlem ligger ~150 m
 *    fra senterkoordinaten; nærhets-gaten står på 60 m og adressen bærer
 *    resten. Idrettsanlegg har ingen felles adresse å bære med seg — OSM-radene
 *    har ingen adresse i det hele tatt, og på Ranheim står anlegget på
 *    Ranheimsvegen 166, stadion på 172 og kunstgresset på 174. Da må nærheten
 *    gjøre hele jobben, og målte spenn er 197–477 m.
 *
 * 3. **Derfor må medlemskapet være kategori-BEGRENSET.** En 300 m nærhets-gate
 *    som slipper til alt ville slukt REMA 1000 Ranheimsfjæra, Ranheim
 *    tannklinikk og folkebiblioteket — de ligger alle innenfor 300 m av
 *    idrettsparken. Et kjøpesenter er blandet bruk per definisjon og skal sluke
 *    alt; et idrettsanlegg er idrett per definisjon og skal bare sluke idrett.
 *    Denne ene regelen er det som gjør den store radiusen trygg.
 *
 * ## Navne-gaten, og hvorfor den ikke kunne unngås
 *
 * For kjøpesenteret ER kategorien gaten: Google-typen `shopping_mall` peker ut
 * bygget. Idretten har ingen tilsvarende type. Målt mot Places API
 * 2026-08-28:
 *
 *   «Ranheim Idrettspark»    bare sports_activity_location   ← ER anlegget
 *   «Lade idrettspark»       bare sports_activity_location   ← ER anlegget
 *   «Ranheim Extra Arena»    sports_complex                  ← er stadion
 *   «Charlottenlundhallen»   sports_complex                  ← er hallen
 *   «Leangen Curlinghall»    sports_complex                  ← er hallen
 *
 * `sports_complex` bommer altså på begge anleggene og treffer fire enkelthaller.
 * OSM er ikke bedre: `leisure=sports_centre` brukes om enkelthaller
 * (Ranheimshallen r≈66 m, Charlottenlundhallen r≈31 m), mens «Ranheim
 * idrettsanlegg» er tagget `leisure=pitch`. Bare Lade har en ekte
 * anleggs-polygon (r≈339 m); Ranheim, Leangen og Charlottenlund har ingen.
 *
 * Det som står igjen er navnet. «Idrettsanlegg», «idrettspark» og
 * «idrettsplass» ER de norske ordene for anlegget, og de brukes ikke om
 * enkeltbaner. Dette er ikke fuzzy navne-matching (som `dedupe-colocated-pins`
 * med rette avviser) — det er en LUKKET ordliste som klassifiserer, på samme
 * form som `OSM_GATE_RULES` og `EXCLUDED_TYPES_FOR_SPORT`.
 *
 * Gaten er med vilje raus, fordi realitets-gaten rydder etter den: målt over
 * hele poolen (5 889 POI-er) slipper 22 av 240 idrett-POI-er gjennom
 * ordlista, og bare de som faktisk samler fire medlemmer blir ankre. «Jakobsli
 * idrettsplass», «Varden idrettspark» og «Oppdal stadion» bærer ordet uten å
 * samle noe, og faller ut — akkurat som «Tem Im thaimat» faller ut av
 * kjøpesenter-familien.
 */

import type { AnchorOptions } from "@/lib/board/anchor-membership";

/**
 * De norske ordene for et idrettsANLEGG, i motsetning til en enkelt bane eller
 * hall. Lukket liste, og den skal forbli kort.
 *
 * `stadion` er MED, men er det svakeste ordet i lista: «Øya stadion» og
 * «Bislett stadion» er anlegg, mens «Lerkendal stadion» er ett bygg. Det gjør
 * ikke noe — samler stadion fire idretts-POI-er rundt seg, ER det et anlegg.
 *
 * Ord som IKKE står her, og hvorfor: `hall`, `arena`, `bane`, `kunstgress`,
 * `senter`. Alle fem navngir enheten inne i anlegget («Ranheimshallen», «Extra
 * Arena», «Ruta 7'er», «Ranheim Kunstgress»), ikke anlegget. Tar vi dem inn,
 * blir stadion ankeret og anlegget medlem — feil vei.
 */
export const SITE_NOUNS: readonly string[] = Object.freeze([
  "idrettsanlegg",
  "idrettspark",
  "idrettsplass",
  "idrettssenter",
  "sportsanlegg",
  "sportsplass",
  "sportssenter",
  "aktivitetspark",
  "stadion",
]);

/** Samme normalisering som `dedupe-colocated-pins` — bare kasus og skilletegn. */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

/** Bærer navnet et av anleggs-ordene? Ordgrense, så «Idrettsplassen» treffer
 *  ikke via delstreng-tilfeldigheter i andre ord. */
export function hasSiteNoun(name: string): boolean {
  const words = normalize(name).split(" ");
  return words.some((w) => SITE_NOUNS.some((noun) => w === noun || w === `${noun}en` || w === `${noun}et`));
}

export interface AnchorFamily {
  /** Stabil nøkkel — skrives til `poi_metadata.anchor_family` for angre og revisjon. */
  id: "kjopesenter" | "anlegg";
  /** Menneskelesbart, brukes i logg og rapporter. */
  label: string;
  /** Kategoriene en KANDIDAT kan ha. */
  candidateCategoryIds: ReadonlySet<string>;
  /**
   * Ekstra gate på navnet. `null` = kategorien er gaten alene (kjøpesenteret,
   * der Google-typen `shopping_mall` allerede har gjort utvelgelsen).
   */
  nameGate: ((name: string) => boolean) | null;
  /**
   * Reglene som sendes videre til `resolveAnchors` — radier, minstekrav og
   * hvilke kategorier et medlem kan ha. Ligger samlet i ett objekt fordi det ER
   * `AnchorOptions`: familien er en navngitt forhåndsutfylling av den, ikke et
   * eget regelverk ved siden av.
   */
  options: AnchorOptions;
  /**
   * Hva `anchor_summary` skal liste opp.
   *
   * `"categories"` for kjøpesenteret: medlemmene har ULIKE kategorier, og
   * «Butikk, frisør, restaurant, kafé, legesenter og mer» er nettopp det som
   * gjør senteret til en destinasjon.
   *
   * `"names"` for idrettsanlegget, fordi kategori-varianten kollapser til
   * ingenting der: hvert eneste medlem er `idrett`, så setningen blir
   * «Idrettsanlegg» — ett ord som ikke sier hva som ligger der. Navnene gjør:
   * «Ranheimshallen, Extra Arena, Ranheim Friidrettshall og mer».
   */
  summaryFrom: "categories" | "names";
  /**
   * Overskriften over registeret i POI-kortet. «I senteret» er riktig for et
   * kjøpesenter og feil for et idrettsanlegg — et anlegg er et OMRÅDE, ikke et
   * bygg man går inn i.
   */
  registerHeading: string;
}

const KJOPESENTER: AnchorFamily = {
  id: "kjopesenter",
  label: "Kjøpesenter",
  candidateCategoryIds: new Set(["shopping"]),
  nameGate: null,
  summaryFrom: "categories",
  registerHeading: "I senteret",
  // Uendret fra 2026-08-27 — kalibrert mot Sirkus (150 m) og Vikhammer (5–25 m).
  // Tomt objekt = `AnchorOptions`-standardene, og ingen kategori-skranke:
  // kjøpesenteret er blandet bruk per definisjon og skal sluke alt.
  options: {},
};

const ANLEGG: AnchorFamily = {
  id: "anlegg",
  label: "Idrettsanlegg",
  candidateCategoryIds: new Set(["idrett"]),
  nameGate: hasSiteNoun,
  summaryFrom: "names",
  registerHeading: "På anlegget",
  options: {
    minMembers: 4,
    /**
     * `swimming` er med som MEDLEM, ikke som kandidat: Charlottenlund
     * svømmehall ligger inne i anlegget og skal absorberes, men en svømmehall
     * er aldri selv et anlegg som samler andre.
     */
    memberCategoryIds: new Set(["idrett", "swimming"]),
    /**
     * 500 m mot målte anleggs-spenn: Charlottenlund 197 m, Leangen 237 m,
     * Ranheim 312 m, Lade 477 m. Taket må dekke det STØRSTE anlegget, ikke
     * gjennomsnittet — på 300 m falt Lade fra hverandre i to ankre midt i sitt
     * eget område.
     *
     * Taket er trygt her og ikke på kjøpesenteret fordi medlemskapet er
     * kategori-begrenset: 500 m rundt Ranheim Idrettspark inneholder REMA 1000,
     * tannklinikken, biblioteket og en tannklinikk til, og ingen av dem kan bli
     * medlem. Uten `memberCategoryIds` ville dette tallet vært katastrofalt.
     */
    maxMemberDistanceM: 500,
    /**
     * Nærhets-gaten bærer HELE jobben i denne familien. OSM-radene har ingen
     * adresse (målt: 0 av 41 idretts-rader i Trondheim øst), og Googles
     * `containingPlaces` er for tynn — den peker på anlegget for 3 av 10 steder
     * på Leangen, 1 av 12 på Lade og 0 av 8 på Ranheim.
     *
     * 250 m er målt fram, ikke gjettet. Kjørt over hele poolen (5 889 POI-er)
     * med 150/300, 200/400 og 250/500:
     *
     *   150 m  Lade blir TO ankre — «Lade idrettspark» og «Lade idrettsanlegg»
     *          180 m fra hverandre, midt i det samme området.
     *   200 m  Lade er fortsatt to.
     *   250 m  Fire ankre, ett per anlegg: Ranheim, Leangen, Lade og Øya. Ingen
     *          av dem sluker et nabo-anlegg.
     *
     * Radiusen er også kandidat-kollapsens (pass 0) terskel, og det er den som
     * gjør 250 m til riktig tall: «Lade idrettspark» og «Lade idrettsanlegg» er
     * to navn på ett sted og skal kollapse, mens Charlottenlund og Brundalen
     * ligger 520 m fra hverandre og skal ikke.
     */
    tightRadiusM: 250,
    /**
     * Anlegget er registrert flere ganger under nesten samme navn: Ranheim har
     * både «Ranheim Idrettspark» (Google + kuratert seed) og «Ranheim
     * idrettsanlegg» (OSM, 130 m unna), Leangen har «Leangen Idrettsanlegg»
     * (Google, 341 anmeldelser) og «Leangen idrettspark» (OSM-node, 50 m unna).
     * Begge bærer anleggs-ordet, så begge er kandidater. Uten denne regelen
     * deler de medlemmene mellom seg, begge passerer firetallet, og boardet
     * viser to anlegg der det er ett.
     */
    absorbRivalCandidates: true,
  },
};

/**
 * Rekkefølgen er kontrakten: en POI som allerede er medlem i en familie tilbys
 * ikke til den neste. Kjøpesenteret går først fordi det er den etablerte
 * familien, og fordi et treningssenter INNE i et kjøpesenter hører til senteret.
 */
export const ANCHOR_FAMILIES: readonly AnchorFamily[] = Object.freeze([
  KJOPESENTER,
  ANLEGG,
]);

/** Alle kategorier som kan bære et anker, på tvers av familiene. */
export const ALL_ANCHOR_CATEGORY_IDS: ReadonlySet<string> = new Set(
  ANCHOR_FAMILIES.flatMap((f) => [...f.candidateCategoryIds]),
);

/** Er denne POI-en kandidat i denne familien? */
export function isFamilyCandidate(
  family: AnchorFamily,
  poi: { name: string; categoryId: string | null },
): boolean {
  if (!poi.categoryId || !family.candidateCategoryIds.has(poi.categoryId)) return false;
  return family.nameGate === null || family.nameGate(poi.name);
}

/**
 * Overskriften registeret skal ha for en gitt anker-POI.
 *
 * Slås opp på ankerets KATEGORI, ikke på `poi_metadata.anchor_family`. De to gir
 * samme svar (hver familie eier sine kandidat-kategorier), og kategorien er
 * allerede i board-laget — familien ville måttet plumbes gjennom hele veien fra
 * databasen for å si det samme.
 */
export function anchorRegisterHeading(categoryId: string): string {
  const family = ANCHOR_FAMILIES.find((f) => f.candidateCategoryIds.has(categoryId));
  return family?.registerHeading ?? "I senteret";
}
