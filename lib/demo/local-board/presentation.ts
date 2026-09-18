import { curatedInitialIds, radiusOptions, radiusPlaces, type RadiusPlace } from "@/lib/demo/local-board/radius";
import type { LocalCategory, LocalPlace, PresentationSegment } from "@/lib/demo/local-board/schema";
import type { NyhavnaConversation } from "@/lib/realtime/nyhavna-conversation";
import type { RealtimeTool } from "@/lib/realtime/types";
import type { ToolOutcome } from "@/lib/live/types";

export const presentationTool: RealtimeTool = {
  type: "function", name: "present_neighbourhood",
  description: "Presenter én kuratert del av nærområdet. next starter eller går videre etter brukerens ja. resume henter gjeldende del etter avbrudd; hopp over det brukeren allerede har hørt. category starter valgt kategori. Aktiverer kategorien og kartstedene samtidig.",
  parameters: {
    type: "object", additionalProperties: false,
    properties: {
      action: { type: "string", enum: ["next", "resume", "category"] },
      category_id: { type: "string" },
    }, required: ["action"],
  },
};

export const similarPlacesTool: RealtimeTool = {
  type: "function", name: "find_similar_places",
  description: "Når brukeren takker ja til lignende steder: hent neste lignende sted i samme kategori og vis det. Ikke spør om bekreftelse igjen. Uten poi_id brukes sist valgte sted.",
  parameters: { type: "object", additionalProperties: false, properties: { poi_id: { type: "string" } }, required: [] },
};

export const morePlacesTool: RealtimeTool = {
  type: "function", name: "reveal_more_places",
  description: "Vis først resten av de nærmeste stedene innen 2 km. Deretter utvid valgt kategori i steg på to kilometer opptil 10 km. Ved et vanlig ønske om flere: utelat radius_km, slik at nærmeste utvalg alltid kommer først. Alle nye steder innen radius vises. radius_km kan utelates for neste radius med nye steder. Ikke et nettsøk.",
  parameters: { type: "object", additionalProperties: false, properties: { category_id: { type: "string" }, radius_km: { type: "number", enum: [2, 4, 6, 8, 10] } }, required: ["category_id"] },
};

/**
 * Alt presentasjonen trenger å vite om DETTE datasettet.
 *
 * Kategoriene er med fordi invitasjonene og ordvalget hører til innholdet:
 * «flere lignende treningssteder» og «hvilket delområde vil du høre mer om»
 * er setninger om Nyhavna, ikke om motoren.
 */
export interface PresentationOptions {
  segments: readonly PresentationSegment[];
  places?: readonly LocalPlace[];
  /** Utelatt = ingen avstandsberegning, og dermed ingen utvidelse av radius. */
  center?: { lat: number; lng: number };
  categories?: readonly LocalCategory[];
  /** Stedet reisetider måles fra, slik guiden sier det: «å gå fra Nyhavna». */
  homeName?: string;
  discoveryCategoryIds?: readonly string[];
}

/** Eget returpunkt for manuset: et faktaspørsmål skal ikke flytte det. */
export function createPresentation(base: NyhavnaConversation, options: PresentationOptions): NyhavnaConversation {
  const { segments, places = [], center, categories = [], homeName = "", discoveryCategoryIds = [] } = options;
  const categoryById = new Map(categories.map(c => [c.id, c]));
  let position = -1;
  let lastNote = "";
  let focusedPlaceId: string | null = null;
  const mapIdByPlace = new Map(places.map(p => [p.id, p.parentPlaceId ?? p.id]));
  const mapIds = (ids: readonly string[]) => [...new Set(ids.map(id => mapIdByPlace.get(id) ?? id))];
  const visited = new Set<string>();
  const revealed = new Set<string>();
  const distances: RadiusPlace[] = center ? radiusPlaces(places, center, discoveryCategoryIds, curatedInitialIds(segments)) : [];
  const optionsFor = (categoryId: string) => radiusOptions(distances, categoryId, revealed);
  const moreInvitation = (categoryId: string, farther = false) => {
    const noun = categoryById.get(categoryId)?.moreNoun ?? "steder";
    return `Vil du se ${farther ? "enda " : ""}flere lignende ${noun} ${farther ? "litt lenger unna" : "i nærheten"}?`;
  };
  const invitationFor = (categoryId: string) => {
    const next = optionsFor(categoryId).options[0];
    return next ? moreInvitation(categoryId) : "Er det noe innen dette temaet du vil vite mer om, eller vil du velge et annet tema?";
  };
  /**
   * Hva notatet sier før manuset er startet.
   *
   * Et datasett uten manus har ingen første del å love: sier notatet likevel at
   * `next` begynner et sted, blir modellen fortalt om et kapittel som ikke
   * finnes, og `next` svarer `done: true`. Med manus navngis kategorien første
   * del faktisk hører til, ikke en kategori fra ett bestemt datasett.
   */
  const startNote = () => {
    const first = segments[0];
    if (!first) return "Ingen manus i dette datasettet; present_neighbourhood har ingenting å lese.";
    return `Ikke startet; next begynner med ${(categoryById.get(first.categoryId)?.name ?? first.categoryId).toLowerCase()}.`;
  };
  const more = (args: Record<string, unknown>): ToolOutcome => {
    const categoryId = String(args.category_id);
    const options = optionsFor(categoryId).options;
    const option = args.radius_km === undefined ? options[0] : options.find(o => o.radiusKm === args.radius_km);
    if (!option) return { result: { matches: 0, instruction: "Ingen nye steder innen denne radiusen i utvalget. Ikke tilby samme søk igjen.", available_radii: options.map(o => o.radiusKm) } };
    const selected = option.ids.flatMap(id => places.find(p => p.id === id) ?? []);
    return {
      result: { matches: selected.length, radius_km: option.radiusKm, places: selected,
        invitation: option.radiusKm < 10 && options.some(o => o.radiusKm > option.radiusKm) ? moreInvitation(categoryId, true) : "Vil du se nærmere på et av stedene?",
        instruction: "Nevn ALLE de nye stedene i places, i oppgitt rekkefølge fra nærmest til lengst unna. Gi hvert sted én kort beskrivelse, med en tydelig pause mellom. Ikke hopp over steder eller si «et par» når flere legges til. Ikke les opp antall, søkeavstand eller radius med mindre brukeren spør. Si gjerne «Her er noen flere alternativer i nærheten». Kartet fremhever alle de nye stedene i samme rekkefølge. Si først at de vises når kartet har bekreftet det. Ikke påstå nettsøk eller dikt reisetider. Avslutt med invitasjonen etter at alle stedene er omtalt. Vent på et tydelig ja eller en ny forespørsel før du henter flere; en kommentar om hvordan du bør snakke er ikke et ja til flere steder." },
      directives: [{ name: "reveal_places", args: { poi_ids: option.ids, category_id: categoryId, radius_km: option.radiusKm } }],
    };
  };
  const family = (place: LocalPlace) => /kaf[eé]|kaffe|baker/i.test(place.placeType ?? "") ? "kaffe" : place.placeType;
  const nextSimilar = (place: LocalPlace) => places.find(p => !distances.some(d => d.id === p.id && !d.initiallyVisible && !revealed.has(p.id)) && p.id !== place.id && !visited.has(p.id) && p.categoryId === place.categoryId && family(p) === family(place));
  const placeText = (place: LocalPlace) => `${place.name}. ${place.summary}${place.status !== "existing" ? ` ${place.facts.filter(f => f.verification === "confirmed").slice(0, 3).map(f => f.text).join(" ")}` : ""}${place.travelTime?.walk !== undefined ? ` Omtrent ${place.travelTime.walk} minutter å gå${homeName ? ` fra ${homeName}` : ""}.` : ""}`;
  const similar = (args: Record<string, unknown>): ToolOutcome => {
    const id = typeof args.poi_id === "string" ? args.poi_id : focusedPlaceId;
    const source = places.find(p => p.id === id);
    if (!source) return { result: { error: "Velg et sted først." } };
    visited.add(source.id);
    const target = nextSimilar(source);
    if (!target) return { result: { matches: 0, instruction: "Si: Jeg har ikke flere lignende steder å vise i dette utvalget. Ikke tilby å lete igjen; spør hvilket annet tema brukeren vil høre om." } };
    focusedPlaceId = target.id;
    
    visited.add(target.id);
    return {
      result: { matches: 1, place: { ...target, map_poi_id: mapIdByPlace.get(target.id) ?? target.id }, text: placeText(target), instruction: "Fortell om dette stedet nå, uten ny bekreftelse eller omtale av andre steder. Tilby bare mer om stedet hvis faktaene inneholder noe nytt å fortelle. Ellers spør hvilket annet tema brukeren vil høre om. Vent på svaret. Ikke gå til neste kategori." },
      directives: [{ name: "highlight_places", args: { poi_ids: mapIds([target.id]) } }, { name: "show_place", args: { poi_id: mapIdByPlace.get(target.id) ?? target.id } }],
    };
  };
  const present = (args: Record<string, unknown>): ToolOutcome => {
    const action = args.action;
    if (!["next", "resume", "category"].includes(String(action))) return { result: { error: "Velg next, resume eller category." } };
    const next = action === "category" ? segments.findIndex(s => s.categoryId === args.category_id)
      : action === "resume" ? Math.max(0, position) : position + 1;
    if (next < 0) return { result: { error: "Kategorien har ikke manus. Bruk kategoriens FAQ og fakta." } };
    const segment = segments[next];
    if (!segment) return { result: { done: true, instruction: "Presentasjonen er ferdig. Tilby å utforske et tema eller svare på spørsmål. Ikke start på nytt uten at brukeren ber om det." } };
    position = next;
    // Basen eier tematilstanden. Dens generelle automatiske markørutvalg
    // erstattes av de stedene det kuraterte avsnittet faktisk omtaler.
    const opened = base.execute("open_theme", { theme_id: segment.categoryId });
    const nextSegment = segments[position + 1];

    return {
      result: {
        chapter: (opened.result as { chapter?: unknown }).chapter,
        segment, nearby_places: distances.filter(p => p.categoryId === segment.categoryId && (p.initiallyVisible || revealed.has(p.id))).flatMap(d => places.find(p => p.id === d.id) ?? []), next_category: nextSegment?.categoryId ?? null,
        invitation: categoryById.get(segment.categoryId)?.invitation ?? invitationFor(segment.categoryId),
        instruction: `${action === "resume" ? "Fortsett fra der brukeren avbrøt, ut fra transkriptet; ikke les starten på nytt. " : ""}Formidle denne manusdelen rolig med korte setninger og tydelige pauser. Behold fakta. Nevn ett sted om gangen i oppgitt rekkefølge. Avslutt med invitasjonen og vent. Ingen flere present_neighbourhood-kall før brukeren ber om det. Kartkommandoer følger denne manusdelen; ikke gjenta dem. Kartkonteksten viser om de lyktes. Ikke påstå at kategori eller steder er vist uten bekreftelse.`,
      },
      directives: [
        { name: "show_category", args: { category_id: segment.categoryId } },
        ...(segment.placeIds.length ? [{ name: "highlight_places", args: { poi_ids: mapIds(segment.placeIds) } }] : [{ name: "clear_highlights", args: {} }]),
      ],
    };
  };
  return {
    ...base,
    observeBrowserResult: (name, args, output) => {
      if (name === "reveal_places" && output && typeof output === "object" && "ok" in output && output.ok === true && Array.isArray(args.poi_ids)) {
        for (const id of args.poi_ids) if (typeof id === "string" && distances.some(p => p.id === id)) revealed.add(id);
      }
      return base.observeBrowserResult(name === "reveal_places" ? "highlight_places" : name, args, output);
    },
    setBoardState: state => {
      for (const id of state.revealed_place_ids ?? []) {
        if (distances.some(p => p.id === id && !p.initiallyVisible)) { revealed.add(id); visited.add(id); }
      }
      base.setBoardState(state);
    },
    execute: (name, args) => name === "open_theme" && segments.some(s => s.categoryId === args.theme_id) ? present({ action: "category", category_id: args.theme_id }) : name === "reveal_more_places" ? more(args) : name === "present_neighbourhood" ? present(args) : name === "find_similar_places" ? similar(args) : base.execute(name, args),
    noteIfChanged: () => {
      const baseNote = base.noteIfChanged();
      const note = `EKSTRAUTVALG ALLEREDE VIST: ${[...revealed].join(", ") || "ingen"}. Flere steder i en kategori: reveal_more_places. RADIER: ${JSON.stringify(discoveryCategoryIds.map(id => ({ category: id, current: optionsFor(id).current, available: optionsFor(id).options.map(o => o.radiusKm) })))}.
VALGT STED: ${focusedPlaceId ?? "ingen"}. Ja til lignende steder betyr find_similar_places, ikke present_neighbourhood.
MANUSPOSISJON: ${position < 0 ? startNote() : `${segments[position].id}. resume fortsetter denne delen; next går til neste del.`}`;
      if (!baseNote && note === lastNote) return null;
      lastNote = note;
      return [baseNote, note].filter(Boolean).join("\n");
    },
    onMapSelection: (kind, id) => {
      if (kind === "place" && places.length) {
        const place = places.find(p => p.id === id);
        if (!place) return null;
        focusedPlaceId = id;
        visited.add(id);
        const invitation = nextSimilar(place) ? (categoryById.get(place.categoryId)?.placeInvitation ?? "Vil du høre om lignende steder i nærheten?") : "Vil du utforske et annet tema, for eksempel transport eller oppvekst?";
        return { commentary: `${placeText(place)} ${invitation}`, directives: [] };
      }
      if (kind !== "theme" || !segments.some(s => s.categoryId === id)) return base.onMapSelection(kind, id);
      const outcome = present({ action: "category", category_id: id });
      const result = outcome.result as { segment: PresentationSegment; invitation: string };
      return { commentary: `Brukeren valgte denne kategorien. Fortell naturlig: ${result.segment.text} ${result.invitation} Vent så på brukeren.`, directives: outcome.directives ?? [] };
    },
  };
}
