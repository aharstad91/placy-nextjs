import type { BoardData, BoardPOI } from "@/components/variants/report/board/board-data";
import { buildChapter, chapterSummary, NO_PROJECT_INFO, NYHAVNA_CURATED, type ChapterPack, type CuratedProvider, type ProjectInfoProvider } from "@/lib/realtime/nyhavna-chapters";
import { nyhavnaMapTools } from "@/lib/realtime/map-tools";
import { createNyhavnaKnowledge, knowledgeTools, type KnowledgeOptions } from "@/lib/realtime/nyhavna-knowledge";
import { NYHAVNA_LABELS, shortProjectInfoLabel, type ConversationLabels } from "@/lib/realtime/conversation-labels";
import { boardAddressBook, spokenBoardProjection } from "@/lib/realtime/spoken-projection";
import { isLiveTransportTool, liveTransportTools, type LiveTransportExecutor, type LiveTransportToolName } from "@/lib/realtime/live-transport";
import {
  applyTourEvent, defaultTourOrder, initialTourState, nextThemes, themesForInterests, tourNote,
  type HighlightedPlace, type TourState, type TourTheme,
} from "@/lib/realtime/tour-state";
import type { RealtimeTool } from "@/lib/realtime/types";
import type { MapDirective, ToolOutcome } from "@/lib/live/types";
import type { TravelMode } from "@/lib/types";

/**
 * Samtalen som ÉN serverside-enhet per Live-sesjon (2026-09-13).
 *
 * Binder sammen tre ting sideband-et trenger: kunnskapsverktøyene (uendret fra
 * `nyhavna-knowledge.ts`), omvisningens tilstand (`tour-state.ts`) og
 * kapitlene (`nyhavna-chapters.ts`). Responses-backenden foreslår verktøykall;
 * her valideres ID-ene og tilstanden oppdateres deterministisk.
 *
 * To ting er nytt med Live. (1) Kartet styres av SERVEREN: `execute` kan
 * returnere kartdirektiver ved siden av verktøyresultatet, så en temainngang
 * fremhever stedene sine uten å vente på at backenden ber om det. (2) Stemmen
 * og backenden er to modeller: `noteIfChanged` går til backendens instruksjon,
 * `mapContextIfChanged` er den korte karttilstanden stemmen får som stille
 * kontekst, og `onMapSelection` er teksten stemmen skal si når brukeren trykker
 * i kartet i stedet for å snakke.
 *
 * Nettleserens kartsvar observeres fortsatt, så det notatet sier står i kartet
 * er det som faktisk står der – aldri det modellen HADDE tenkt å vise.
 */

const schema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object", properties, required, additionalProperties: false,
});

/**
 * Omvisningens verktøy. En funksjon av navnene fordi `find_project_info`
 * beskriver HVILKET kildemateriale den søker i, og det materialet er
 * datasettets – ikke kodens.
 */
export const tourTools = (labels: ConversationLabels): RealtimeTool[] => [
  {
    type: "function", name: "set_interests",
    description: "Kall når brukeren har sagt hva som er viktig for hen, eller ber om en generell tur (tom liste). Lagrer interessene, lager temarekkefølge og åpner første tema; returnerer plan og kapittel med kart-ID-er. Kall igjen når brukeren endrer mening.",
    parameters: schema({
      interests: { type: "array", items: { type: "string", maxLength: 60 }, maxItems: 6, description: "Brukerens interesser i korte fraser, med hens egne ord." },
      theme_ids: { type: "array", items: { type: "string" }, maxItems: 10, description: "Tema-ID-er i ønsket rekkefølge (fra boardets kategorier). Tom liste = generell tur." },
    }, ["interests"]),
  },
  {
    type: "function", name: "open_theme",
    description: "Gå til et tema (neste i planen, eller ett brukeren ber om). Returnerer kapittelet: intro, spørsmål og svar, steder med kart-ID, omtaler og prosjektinnhold. Forrige tema regnes som gjennomgått.",
    parameters: schema({ theme_id: { type: "string" } }, ["theme_id"]),
  },
  {
    type: "function", name: "note_detour",
    description: "Brukeren spør om noe ved siden av temaet uten å ville bytte tema: lagrer returpunktet.",
    parameters: schema({ about: { type: "string", maxLength: 80 } }, ["about"]),
  },
  {
    type: "function", name: "return_to_tour",
    description: "Avstikkeren er ferdig: tilbake til temaet. Returnerer kort sammendrag og neste tema.",
    parameters: schema({}),
  },
  {
    type: "function", name: "find_project_info",
    description: `Søk i ${labels.projectInfoLabel}: prosjektet, hvem som står bak, visjon, planer, status, hverdagsliv. Returnerer kildebelagte utsagn med status (eksisterende, planlagt, vedtatt plan, visjon, uavklart).`,
    parameters: schema({ query: { type: "string", maxLength: 200 }, theme_id: { type: "string" } }, ["query"]),
  },
];

/** Alle verktøyene backenden får: kunnskap og omvisning (server) + kart (nettleser). */
export const conversationTools = (labels: ConversationLabels, liveTransport = false): RealtimeTool[] =>
  [...knowledgeTools(labels), ...tourTools(labels), ...(liveTransport ? liveTransportTools : []), ...nyhavnaMapTools];

/** Karttilstanden nettleseren melder inn mellom turene. */
export interface BoardState {
  selected_category_id: string | null;
  selected_place_id: string | null;
  travel_mode: string;
  revealed_place_ids?: string[];
}

export interface NyhavnaConversation {
  /** Utfør et server-verktøy: resultatet til backenden, og kartdirektiver serveren selv utløser. */
  execute: {
    (name: LiveTransportToolName, args: Record<string, unknown>): Promise<ToolOutcome>;
    (name: string, args: Record<string, unknown>): ToolOutcome;
  };
  /** Nettleserens kartsvar – speiler kartets faktiske tilstand inn i omvisningen. */
  observeBrowserResult: (name: string, args: Record<string, unknown>, output: unknown) => void;
  /** Notatet hvis tilstanden har endret seg siden sist det ble hentet, ellers null. Legges SIST i backendens instruksjon. */
  noteIfChanged: () => string | null;
  /** Én til to linjer karttilstand til STEMMEN (stille kontekst), bare når den har endret seg. */
  mapContextIfChanged: () => string | null;
  /** Brukerens eget trykk i kartet: hva stemmen skal si, og hva kartet skal gjøre. Ukjent ID → null. */
  onMapSelection: (kind: "theme" | "place", id: string) => { commentary: string; directives: Array<Pick<MapDirective, "name" | "args">> } | null;
  setBoardState: (state: BoardState) => void;
  readonly state: () => TourState;
  readonly themes: TourTheme[];
}

export interface ConversationDeps {
  projectInfo?: ProjectInfoProvider;
  travelMode?: TravelMode;
  /**
   * Kildekontrollert kunnskap og stedssøk. Utelatt = det frosne
   * Nyhavna-snapshotets. Den lokale demoen sender sitt eget JSON-datasett, og
   * et tomt datasett gir en guide uten fakta — som er meningen før innholdet
   * er lagt inn.
   */
  knowledge?: KnowledgeOptions;
  /** Omtalene kapitlene bærer. Utelatt = Nyhavna-snapshotets kobling. */
  curatedFor?: CuratedProvider;
  /**
   * Stedsnavnene verktøytekstene og de tomme svarene bruker. Utelatt =
   * `NYHAVNA_LABELS`, så det frosne snapshotet sier nøyaktig det samme som før.
   */
  labels?: ConversationLabels;
  /** Levende kollektivoppslag. Utelatt for datasett som ikke har serverklient. */
  liveTransport?: LiveTransportExecutor;
}

const strings = (value: unknown, max = 10): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, max) : [];

/** «1 A; 2 B; 3 C» – samme nummerering som notatets «Referanser», så «det andre stedet» peker likt overalt. */
const ordered = (places: readonly HighlightedPlace[]): string =>
  places.map((p, i) => `${i + 1} ${p.name}`).join("; ");

/** Første setninger av en tekst, kuttet på setningsslutt – introen skal være kort nok til å sies. */
const firstSentences = (text: string, max: number): string => {
  const full = text.replace(/\s+/g, " ").trim();
  const sentences = full.match(/[^.!?]+[.!?]+(\s|$)/g);
  return !sentences || sentences.length <= max ? full : sentences.slice(0, max).join("").trim();
};

/** Kapittelets tre første steder – de serveren fremhever selv ved temainngang. */
const autoHighlights = (pack: ChapterPack): HighlightedPlace[] =>
  pack.places.filter((p) => p.id).slice(0, 3).map((p) => ({ id: p.id, name: p.name }));

export function createNyhavnaConversation(board: BoardData, deps: ConversationDeps = {}): NyhavnaConversation {
  const conversationBoard = spokenBoardProjection(board);
  const projectInfo = deps.projectInfo ?? NO_PROJECT_INFO;
  const travelMode = deps.travelMode ?? "walk";
  const labels = deps.labels ?? NYHAVNA_LABELS;
  const knowledge = createNyhavnaKnowledge(conversationBoard, {
    ...deps.knowledge,
    addresses: deps.knowledge?.addresses ?? boardAddressBook(board),
  });
  const pois = new Map<string, BoardPOI>(conversationBoard.categories.flatMap((c) => c.pois).map((p) => [String(p.id), p]));
  const themes: (TourTheme & { sourced: boolean })[] = conversationBoard.categories.map((c) => ({
    id: String(c.id), name: c.label, sourced: Boolean(c.editorial?.source),
  }));
  const themeIds = new Set(themes.map((t) => t.id));
  let state = initialTourState(themes);
  let notedRevision = 0;
  let boardState: BoardState = { selected_category_id: null, selected_place_id: null, travel_mode: travelMode };
  const chapters = new Map<string, ChapterPack>();
  // Prosjektinnhold som alt er lagt ved i samtalen: flere temaer peker på de
  // samme postene fra nyhavna.no, og hver gjentakelse koster ~450 tokens per runde.
  const sentProjectInfo = new Set<string>();
  const chapter = (themeId: string): ChapterPack => {
    let pack = chapters.get(themeId);
    if (!pack) {
      const category = conversationBoard.categories.find((c) => String(c.id) === themeId);
      if (!category) throw new Error(`Ukjent tema: ${themeId}`);
      pack = buildChapter(conversationBoard, category, travelMode, projectInfo, deps.curatedFor ?? NYHAVNA_CURATED);
      chapters.set(themeId, pack);
    }
    const fresh = pack.project_info.filter((p) => !sentProjectInfo.has(p.id));
    for (const p of fresh) sentProjectInfo.add(p.id);
    return fresh.length === pack.project_info.length ? pack : { ...pack, project_info: fresh };
  };
  const named = (ids: readonly string[]) => ids.map((id) => ({ theme_id: id, name: themes.find((t) => t.id === id)?.name ?? id }));
  const plan = () => ({ current: state.currentThemeId ? named([state.currentThemeId])[0] : null, next: named(nextThemes(state)) });

  /**
   * Serveren fremhever kapittelets tre første steder SELV ved temainngang.
   * Backenden slipper en ekstra runde bare for å be om kartet, og brukeren ser
   * stedene i samme øyeblikk som guiden begynner å fortelle. Tilstanden settes
   * optimistisk; nettleserens svar bekrefter (og korrigerer) den etterpå.
   */
  const openMapFor = (pack: ChapterPack): { directives: Array<Pick<MapDirective, "name" | "args">>; instruction: string | null } => {
    const places = autoHighlights(pack);
    if (!places.length) return { directives: [], instruction: null };
    state = applyTourEvent(state, { type: "highlight", places }, themes);
    return {
      directives: [{ name: "highlight_places", args: { poi_ids: places.map((p) => p.id) } }],
      instruction: `Kartet fremhever nå ${ordered(places)} – omtal dem i denne rekkefølgen. Ikke kall highlight_places for disse.`,
    };
  };

  const execute = (name: string, args: Record<string, unknown>): ToolOutcome | Promise<ToolOutcome> => {
    if (isLiveTransportTool(name)) {
      return deps.liveTransport
        ? deps.liveTransport(name, args).then((result) => ({ result }))
        : { result: { error: "Levende kollektivdata er ikke aktivert for dette boardet." } };
    }
    switch (name) {
      case "set_interests": {
        const interests = strings(args.interests, 6);
        const requested = strings(args.theme_ids, 10).filter((id) => themeIds.has(id));
        // Backendens valg og ordboka slås sammen, og Nyhavnas egne temaer (kilde
        // nyhavna.no) går først når de treffer interessen: «kaféer» skal åpne
        // Nyhavnas «Café og restauranter», ikke boardets generelle «Servering».
        const union = [...new Set([...requested, ...themesForInterests(interests, themes)])];
        const inferred = [...union.filter((id) => themes.find((t) => t.id === id)?.sourced), ...union.filter((id) => !themes.find((t) => t.id === id)?.sourced)];
        const order = inferred.length ? inferred : defaultTourOrder(themes);
        state = applyTourEvent(state, { type: "set_interests", interests, themeIds: order }, themes);
        const first = nextThemes(state, 1)[0] ?? state.themeOrder[0];
        // Første tema åpnes med én gang så guiden kan begynne å vise noe i
        // samme åndedrag som den sier hva dere begynner med.
        if (first && state.currentThemeId !== first) state = applyTourEvent(state, { type: "open_theme", themeId: first }, themes);
        const pack = state.currentThemeId ? chapter(state.currentThemeId) : null;
        const map = pack ? openMapFor(pack) : { directives: [], instruction: null };
        return {
          result: {
            ok: true,
            interests: state.interests,
            general_tour: inferred.length === 0,
            plan: plan(),
            chapter: pack,
            instruction: `Si kort hva dere begynner med, og begynn å fortelle. Ikke still et nytt intervjuspørsmål.${map.instruction ? ` ${map.instruction}` : ""}`,
          },
          directives: map.directives,
        };
      }
      case "open_theme": {
        const themeId = typeof args.theme_id === "string" ? args.theme_id : "";
        if (!themeIds.has(themeId)) return { result: { error: "Ukjent tema-ID. Bruk en ID fra boardets kategorier.", themes: named(state.themeOrder) } };
        state = applyTourEvent(state, { type: "open_theme", themeId }, themes);
        const pack = chapter(themeId);
        const map = openMapFor(pack);
        return {
          result: { ok: true, plan: plan(), chapter: pack, ...(map.instruction ? { instruction: map.instruction } : {}) },
          directives: map.directives,
        };
      }
      case "note_detour": {
        if (!state.currentThemeId) return { result: { ok: false, note: "Ingen omvisning å komme tilbake til ennå – svar på spørsmålet direkte." } };
        state = applyTourEvent(state, { type: "note_detour", about: typeof args.about === "string" ? args.about : "" }, themes);
        return { result: { ok: true, return_to: state.detour ? named([state.detour.returnThemeId])[0] : null } };
      }
      case "return_to_tour": {
        if (!state.detour) return { result: { ok: false, note: "Ingen avstikker registrert.", plan: plan() } };
        state = applyTourEvent(state, { type: "return_to_tour" }, themes);
        return { result: { ok: true, plan: plan(), chapter: state.currentThemeId ? chapterSummary(chapter(state.currentThemeId)) : null } };
      }
      case "find_project_info": {
        const query = typeof args.query === "string" ? args.query.slice(0, 200) : "";
        const themeId = typeof args.theme_id === "string" && themeIds.has(args.theme_id) ? args.theme_id : state.currentThemeId;
        // Områdets egen nøkkel står ved siden av kapittelets tema, så et
        // spørsmål om stedet som helhet også treffer. Et datasett uten en slik
        // nøkkel søker bare i kapittelets tema.
        const areaTheme = labels.areaThemeId ? [labels.areaThemeId] : [];
        const results = projectInfo.search(query, themeId ? [themeId, ...areaTheme] : areaTheme, 4);
        if (!results.length) {
          state = applyTourEvent(state, { type: "open_question", question: query }, themes);
          return { result: { matches: 0, results: [], note: `Ingen kildebelagt omtale i ${shortProjectInfoLabel(labels)}. Si kort at du ikke har grunnlag for det, uten å gjette.` } };
        }
        return { result: { matches: results.length, results, note: "Kildebelagte utsagn fra prosjektets datagrunnlag. Bruk kilden ved hvert resultat. Behold status-ordene (planlagt, visjon, vedtatt) når du gjengir dem." } };
      }
      default:
        return { result: knowledge(name, args) };
    }
  };

  const observeBrowserResult = (name: string, args: Record<string, unknown>, output: unknown): void => {
    const payload = output && typeof output === "object" ? (output as Record<string, unknown>) : {};
    if (typeof payload.error === "string") return;
    const answered = strings(args.answered_faq_ids, 4);
    if (answered.length) state = applyTourEvent(state, { type: "faq_answered", faqIds: answered }, themes);
    if (name === "highlight_places" && Array.isArray(payload.highlighted)) {
      const places = payload.highlighted
        .filter((p): p is { id: string; name?: unknown } => Boolean(p) && typeof p === "object" && typeof (p as { id?: unknown }).id === "string")
        .map((p) => ({ id: p.id, name: typeof p.name === "string" ? p.name : p.id }));
      state = applyTourEvent(state, { type: "highlight", places }, themes);
    } else if (name === "clear_highlights" || name === "reset_board") {
      state = applyTourEvent(state, { type: "clear_highlights" }, themes);
    }
  };

  const noteIfChanged = () => {
    if (state.revision === notedRevision) return null;
    notedRevision = state.revision;
    return tourNote(state, themes);
  };

  const mapContext = (): string => {
    const lines: string[] = [
      state.highlighted.length ? `Kartet viser nå: ${ordered(state.highlighted)}.` : "Kartet viser ingen fremheving nå.",
    ];
    const theme = boardState.selected_category_id ? themes.find((t) => t.id === boardState.selected_category_id)?.name : null;
    if (theme) lines.push(`Tema i kartet: ${theme}.`);
    const place = boardState.selected_place_id ? pois.get(boardState.selected_place_id)?.name : null;
    if (place) lines.push(`Åpnet sted: ${place}.`);
    if (boardState.travel_mode !== "walk") lines.push(`Reisemåte i kartet: ${boardState.travel_mode}.`);
    return lines.join(" ");
  };
  // Stemmen skal ikke få den samme karttilstanden om igjen: det er stille
  // kontekst, ikke en beskjed. Utgangspunktet er «ingenting er vist», så første
  // melding kommer først når kartet faktisk viser noe.
  let sentMapContext = mapContext();
  const mapContextIfChanged = () => {
    const text = mapContext();
    if (text === sentMapContext) return null;
    sentMapContext = text;
    return text;
  };

  const onMapSelection: NyhavnaConversation["onMapSelection"] = (kind, id) => {
    if (kind === "theme") {
      if (!themeIds.has(id)) return null;
      state = applyTourEvent(state, { type: "open_theme", themeId: id }, themes);
      const pack = chapter(id);
      const map = openMapFor(pack);
      const shown = map.directives.length ? ` Kartet fremhever nå ${ordered(state.highlighted)}.` : "";
      return {
        commentary: `Brukeren valgte temaet «${pack.name}» i kartet.${shown} Fortell kort om temaet: ${firstSentences(pack.intro, 2)} Ikke still spørsmål tilbake.`,
        directives: map.directives,
      };
    }
    const facts = knowledge("get_place_facts", { poi_id: id }) as Record<string, unknown>;
    if (!facts || typeof facts !== "object" || "error" in facts) return null;
    const name = typeof facts.name === "string" ? facts.name : id;
    const texts = Array.isArray(facts.facts)
      ? facts.facts.filter((f): f is { text: string } => Boolean(f) && typeof (f as { text?: unknown }).text === "string").slice(0, 3).map((f) => f.text)
      : [];
    const caveat = typeof facts.status_note === "string" ? ` ${facts.status_note}` : "";
    // Registerdata er ikke redaksjonelt kontrollert: guiden skal si hva den har,
    // ikke fylle hullene med generell kunnskap.
    const basis = texts.length
      ? `Bekreftede fakta: ${texts.join(" ")}`
      : `Du har bare registerdata om stedet (navn, type og lagret reisetid), ingen kontrollerte fakta. Si kort hva det er, og at du ikke har mer om det.`;
    return {
      commentary: `Brukeren trykket på «${name}» i kartet, og stedet er alt åpnet der. ${basis}${caveat} Fortell kort om stedet ut fra dette. Ikke still spørsmål tilbake.`,
      directives: [],
    };
  };

  const setBoardState = (next: BoardState) => { boardState = next; };

  return { execute: execute as NyhavnaConversation["execute"], observeBrowserResult, noteIfChanged, mapContextIfChanged, onMapSelection, setBoardState, state: () => state, themes };
}
