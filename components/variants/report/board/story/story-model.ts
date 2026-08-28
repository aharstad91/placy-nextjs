import type { TravelMode } from "@/lib/types";
import type { BoardCategory, BoardPOI } from "../board-data";

/**
 * Omvisningens rene modell — meglerens utvalg som guidet rekkefølge.
 *
 * Portert fra prototypen `prototypes/04-fortelling-i-boardet` (dom 2026-08-26).
 * Alt her er rent: ingen React, ingen kart-instans, ingen kontekst. Det er den
 * eneste grunnen til at reglene under kan gås etter i en test.
 *
 * ## Hva omvisningen ER
 *
 * Kartet med flere hundre punkter sier «her er det mye» — det er dekningen
 * megleren betaler for. Men den som ikke selv zoomer og trykker får ingenting
 * ut av den. Omvisningen er en ny REKKEFØLGE på innhold boardet allerede har:
 * ett stopp per kategori, spørsmålet som overskrift, og tre navngitte steder.
 * Ingen ny kurering, ingen nye data.
 */

/**
 * Områdets navn — den første brikken i raden.
 *
 * Bydelen når vi har den: det er ordet kjøperen søkte på og ordet hun sier når
 * hun forteller hvor hun har kjøpt. Ellers byen, og til slutt et nøytralt ord
 * som er sant på enhver adresse — raden skal aldri stå med en tom brikke.
 */
export function areaLabel(home: {
  district?: string;
  city?: string;
}): string {
  return home.district?.trim() || home.city?.trim() || "Nabolaget";
}

/**
 * Brikkens ord i raden — og bevisst IKKE stedsnavnet.
 *
 * «Ranheim» sto i brikken og som overskrift rett under, to centimeter fra
 * hverandre. Brikken skal si hva DENNE inngangen er, og overskriften hvor du er:
 * de fem temaene ved siden av heter ikke stedet sitt heller. Ordet er
 * salgsoppgavens eget, det har samme lengde uansett adresse, og det leser som en
 * startside — der et stedsnavn leser som et sjette tema.
 */
export const AREA_RAIL_LABEL = "Beliggenhet";

/**
 * Områdets undertittel: dekningen i tall, der kategori-stoppene har spørsmålet
 * sitt. Summen over kategoriene, ikke unike steder — samme tall kortet «Hele
 * nabolaget» viste, og samme tall du får ved å legge sammen brikkene i raden.
 */
export function areaSubline(
  categories: readonly { pois: readonly unknown[] }[],
): string {
  const places = categories.reduce((n, c) => n + c.pois.length, 0);
  const themes = categories.length;
  return `${places} steder · ${themes} ${themes === 1 ? "tema" : "temaer"}`;
}

/**
 * Områdestoppets ene setning. Den sier hva kartet VISER nå (alt), og hvor veien
 * videre går — det arbeidet kortet «Hele nabolaget / Vis alle steder på kartet»
 * gjorde i indeksen som dette stoppet erstatter.
 *
 * Ingen retning i teksten («i raden over»): raden er et hode på desktop og et
 * dekk i underkanten på mobil, og setningen er den samme på begge.
 */
export const AREA_LEAD =
  "Kartet viser hele nabolaget. Velg et tema for å gå inn i ett av dem.";

/**
 * Områdestoppets prosa — strøkets egne ord, i avsnitt, slik hvert tema har sin
 * body-tekst over utvalget sitt.
 *
 * Kilden er det kuraterte svaret på «hva kjennetegner området?»
 * (`GLOBAL_INTRO_ID` i faq-generatoren), løftet ut av trekkspillet. Er strøket
 * ikke kuratert, dikter vi ikke opp et avsnitt om det: da står den navigerende
 * setningen alene, og FAQ-en under bærer stoppet.
 */
export function areaProse(intro: string | undefined): string[] {
  const paragraphs = String(intro ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs.length > 0 ? paragraphs : [AREA_LEAD];
}

/** Meglerens utvalg per stopp: de kameraet rammer inn. Tre er nok til å bære
 *  et stopp og få nok til at kameraet kan ramme dem uten å zoome ut til hele
 *  kategorien. */
export const STORY_PICKS_PER_STOP = 3;

/** Fortellingens takt: to setninger av strøksteksten, ikke hele. Seks linjer
 *  prosa ganger seks stopp er en nettside igjen, ikke en omvisning — og det er
 *  stedene med målt tid som er beatet, prosaen bare rammer dem inn. */
export const STORY_SENTENCES_PER_BEAT = 2;

/** Reisetiden i aktiv modus, eller `undefined` når den mangler. Samme siling
 *  som `buildNeighbourhoodList`: en korrupt verdi skal aldri bli et minutt-tall
 *  (R26 — aldri et estimat, aldri en tom «– min»). */
export function storyMinutes(
  poi: BoardPOI,
  travelMode: TravelMode,
): number | undefined {
  const v = poi.raw.travelTime?.[travelMode];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Nærmest først, og navnet avgjør likhet — ellers bytter to steder med samme
 *  minutt plass mellom to renders. Steder uten tid havner sist. */
export function byMinutesThenName(travelMode: TravelMode) {
  return (a: BoardPOI, b: BoardPOI) => {
    const ma = storyMinutes(a, travelMode) ?? Number.POSITIVE_INFINITY;
    const mb = storyMinutes(b, travelMode) ?? Number.POSITIVE_INFINITY;
    if (ma !== mb) return ma - mb;
    return a.name.localeCompare(b.name, "nb");
  };
}

/**
 * Stoppets tre steder: meglerens utvalg («Verdt å merke seg»). Mangler
 * kategorien kuraterte highlights, faller vi tilbake på de tre nærmeste MÅLTE
 * — altså det den deterministiske minimum-garantien klarer alene.
 *
 * Sortert på tid uansett kilde: kurator eier HVILKE tre steder som er verdt å
 * merke seg, fortellingen eier rekkefølgen de nevnes i. Uten det leser stoppet
 * «17 min, 23 min, 4 min», og ingen guide snakker sånn.
 */
export function storyPicks(
  category: BoardCategory,
  travelMode: TravelMode,
): BoardPOI[] {
  const highlights = category.editorial?.highlights ?? [];
  const pool = highlights.length
    ? highlights
        .map((h) =>
          category.pois.find(
            (p) => p.id.toLowerCase() === String(h.id).toLowerCase(),
          ),
        )
        .filter((p): p is BoardPOI => p !== undefined)
    : category.pois.filter((p) => storyMinutes(p, travelMode) !== undefined);
  return pool
    .slice()
    .sort(byMinutesThenName(travelMode))
    .slice(0, STORY_PICKS_PER_STOP);
}

/** Er stoppets utvalg et menneskes? Skillet mellom en åpen og en ferdig
 *  kuratert versjon ligger her — ikke i OM omvisningen finnes. */
export const storyIsCurated = (category: BoardCategory): boolean =>
  (category.editorial?.highlights ?? []).length > 0;

/** Overskriften over utvalget. «Nærmest hjemmefra» når ingen har anbefalt noe:
 *  et løfte om et menneskes utvalg skal ikke stå over maskinens. */
export const storyPickTitle = (category: BoardCategory): string =>
  storyIsCurated(category) ? "Verdt å merke seg" : "Nærmest hjemmefra";

/**
 * Kuttet skjer på setningsslutt, aldri midt i et ord — derfor ingen ellipse.
 *
 * Brukes nå BARE på mobil (`StoryCard variant="sheet"`). Der ligger den fulle
 * teksten én skjerm unna: kategorisiden bak «Avslutt» rendrer hvert avsnitt.
 * Desktop-kolonnen har ingen slik utgang etter at indeksen ble slettet
 * (2026-08-27), og rendrer derfor hele prosaen — se `storyProse` i StoryCard.
 */
export function storyBeat(
  text: string | undefined,
  maxSentences = STORY_SENTENCES_PER_BEAT,
): string {
  const full = String(text ?? "").trim();
  const sentences = full.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!sentences || sentences.length <= maxSentences) return full;
  return sentences.slice(0, maxSentences).join("").trim();
}

/** Stedets egne ord. Ingen tekst = ingen chevron; raden lover ikke noe tom. */
export function storyNarrative(poi: BoardPOI): string {
  const g = poi.raw.grounding;
  return (
    g?.curated?.narrative ??
    g?.generated?.narrative ??
    poi.raw.editorialHook ??
    ""
  );
}

/** Ikon og farge til stedets brikke. Kuratoren har gitt hvert utvalgt sted sin
 *  egen identitet (`poiVisualIdentity` i board-data); er stedet plukket av
 *  maskinen, arver det kategoriens. */
export function storyPickIdentity(
  poi: BoardPOI,
  category: BoardCategory,
): { icon: string; color: string } {
  const h = (category.editorial?.highlights ?? []).find(
    (x) => String(x.id).toLowerCase() === poi.id.toLowerCase(),
  );
  return { icon: h?.icon ?? category.icon, color: h?.color ?? category.color };
}

/**
 * Markørens vekt i omvisningen — tre nivåer, ikke to.
 *
 *   named   = de tre stedene stoppet navngir. De BÆRER scenen.
 *   scene   = kategoriens øvrige punkter. Dekningen synes, uten å ta ordet.
 *   texture = resten av nabolaget, liggende igjen som tekstur.
 *
 * Med bare dempet/ikke-dempet ble alle punktene like viktige som de tre
 * fortellingen faktisk snakker om.
 */
export type StoryEmphasis = "named" | "scene" | "texture";

export function storyEmphasis(
  poiId: string,
  categoryId: string,
  stopCategoryId: string,
  namedIds: ReadonlySet<string>,
): StoryEmphasis {
  if (namedIds.has(poiId)) return "named";
  return categoryId === stopCategoryId ? "scene" : "texture";
}
