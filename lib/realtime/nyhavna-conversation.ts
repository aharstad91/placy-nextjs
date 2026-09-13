import type { BoardData } from "@/components/variants/report/board/board-data";
import { buildChapter, chapterSummary, NO_PROJECT_INFO, type ChapterPack, type ProjectInfoProvider } from "@/lib/realtime/nyhavna-chapters";
import { nyhavnaMapTools } from "@/lib/realtime/map-tools";
import { createNyhavnaKnowledge, nyhavnaKnowledgeTools } from "@/lib/realtime/nyhavna-knowledge";
import {
  applyTourEvent, defaultTourOrder, initialTourState, nextThemes, themesForInterests, tourNote,
  type TourState, type TourTheme,
} from "@/lib/realtime/tour-state";
import type { RealtimeTool } from "@/lib/realtime/types";
import type { TravelMode } from "@/lib/types";

/**
 * Samtalen som ÉN serverside-enhet per Realtime-kall (2026-09-13).
 *
 * Binder sammen tre ting sideband-et trenger: kunnskapsverktøyene (uendret fra
 * `nyhavna-knowledge.ts`), omvisningens tilstand (`tour-state.ts`) og
 * kapitlene (`nyhavna-chapters.ts`). Modellen kaller verktøy; her valideres
 * ID-ene og tilstanden oppdateres deterministisk. Nettleserens kartsvar
 * (fremheving, åpnet sted) observeres også, så det som faktisk står i kartet
 * er det notatet sier står der – aldri det modellen HADDE tenkt å vise.
 */

const schema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object", properties, required, additionalProperties: false,
});

export const nyhavnaTourTools: RealtimeTool[] = [
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
    description: "Søk i Nyhavna Utviklings eget innhold (nyhavna.no): prosjektet, hvem som står bak, visjon, planer, status, hverdagsliv. Returnerer kildebelagte utsagn med status (eksisterende, planlagt, vedtatt plan, visjon, uavklart).",
    parameters: schema({ query: { type: "string", maxLength: 200 }, theme_id: { type: "string" } }, ["query"]),
  },
];

/** Alle verktøyene modellen får: kunnskap og omvisning (server) + kart (nettleser). */
export const nyhavnaTools: RealtimeTool[] = [...nyhavnaKnowledgeTools, ...nyhavnaTourTools, ...nyhavnaMapTools];

export interface NyhavnaConversation {
  execute: (name: string, args: Record<string, unknown>) => unknown;
  /** Nettleserens kartsvar – kalles av sideband-et når et function_call_output for et kartverktøy kommer inn, med det modellen sa i samme svar. En returnert tekst er data modellen skal fortsette med. */
  observeBrowserResult: (name: string, args: Record<string, unknown>, output: unknown, spoken?: string) => string | void;
  /** Notatet hvis tilstanden har endret seg siden sist det ble hentet, ellers null. */
  noteIfChanged: () => string | null;
  /**
   * Brukerens egne trykk i kartet kommer som tekstmeldinger med ID (fra
   * `board-voice.tsx`). Tema: kapittelet åpnes her og legges ved, så modellen
   * slipper å kalle open_theme. Sted: faktaene legges ved. Annet: null.
   */
  interceptUserMessage: (text: string) => string | null;
  readonly state: () => TourState;
  readonly themes: TourTheme[];
}

export interface ConversationDeps {
  projectInfo?: ProjectInfoProvider;
  travelMode?: TravelMode;
}

const strings = (value: unknown, max = 10): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, max) : [];

const fold = (s: string) => s.toLocaleLowerCase("nb").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
/**
 * Var det modellen sa i samme svar som kartkallet et svar, eller bare en
 * innledning («Klart, la oss se på …»)? Mini-modellen innleder ofte før
 * verktøyet og sier så ingenting mer hvis den ikke får ordet igjen (målt
 * 2026-09-13). Et svar nevner minst ett av stedene den fremhevet, eller er
 * langt nok til å ha sagt noe.
 */
export function spokenAnswers(spoken: string, placeNames: readonly string[]): boolean {
  const text = fold(spoken);
  if (text.length >= 160) return true;
  return placeNames.some((name) => {
    const head = fold(name).split(/[^a-z0-9æøå]+/).filter((w) => w.length > 2)[0];
    return Boolean(head) && text.includes(head);
  });
}

export function createNyhavnaConversation(board: BoardData, deps: ConversationDeps = {}): NyhavnaConversation {
  const projectInfo = deps.projectInfo ?? NO_PROJECT_INFO;
  const travelMode = deps.travelMode ?? "walk";
  const knowledge = createNyhavnaKnowledge(board);
  const themes: (TourTheme & { sourced: boolean })[] = board.categories.map((c) => ({
    id: String(c.id), name: c.label, sourced: Boolean(c.editorial?.source),
  }));
  const themeIds = new Set(themes.map((t) => t.id));
  let state = initialTourState(themes);
  let notedRevision = 0;
  const chapters = new Map<string, ChapterPack>();
  // Prosjektinnhold som alt er lagt ved i samtalen: flere temaer peker på de
  // samme postene fra nyhavna.no, og hver gjentakelse koster ~450 tokens per runde.
  const sentProjectInfo = new Set<string>();
  const chapter = (themeId: string): ChapterPack => {
    let pack = chapters.get(themeId);
    if (!pack) {
      const category = board.categories.find((c) => String(c.id) === themeId);
      if (!category) throw new Error(`Ukjent tema: ${themeId}`);
      pack = buildChapter(board, category, travelMode, projectInfo);
      chapters.set(themeId, pack);
    }
    const fresh = pack.project_info.filter((p) => !sentProjectInfo.has(p.id));
    for (const p of fresh) sentProjectInfo.add(p.id);
    return fresh.length === pack.project_info.length ? pack : { ...pack, project_info: fresh };
  };
  const named = (ids: readonly string[]) => ids.map((id) => ({ theme_id: id, name: themes.find((t) => t.id === id)?.name ?? id }));
  const plan = () => ({ current: state.currentThemeId ? named([state.currentThemeId])[0] : null, next: named(nextThemes(state)) });

  const execute = (name: string, args: Record<string, unknown>): unknown => {
    switch (name) {
      case "set_interests": {
        const interests = strings(args.interests, 6);
        const requested = strings(args.theme_ids, 10).filter((id) => themeIds.has(id));
        // Modellens valg og ordboka slås sammen, og Nyhavnas egne temaer (kilde
        // nyhavna.no) går først når de treffer interessen: «kaféer» skal åpne
        // Nyhavnas «Café og restauranter», ikke boardets generelle «Servering»
        // (mini valgte det generelle temaet i to av to målte samtaler 2026-09-13).
        const union = [...new Set([...requested, ...themesForInterests(interests, themes)])];
        const inferred = [...union.filter((id) => themes.find((t) => t.id === id)?.sourced), ...union.filter((id) => !themes.find((t) => t.id === id)?.sourced)];
        const order = inferred.length ? inferred : defaultTourOrder(themes);
        state = applyTourEvent(state, { type: "set_interests", interests, themeIds: order }, themes);
        const first = nextThemes(state, 1)[0] ?? state.themeOrder[0];
        // Første tema åpnes med én gang så modellen kan begynne å vise noe i
        // samme åndedrag som den sier hva dere begynner med.
        if (first && state.currentThemeId !== first) state = applyTourEvent(state, { type: "open_theme", themeId: first }, themes);
        return {
          ok: true,
          interests: state.interests,
          general_tour: inferred.length === 0,
          plan: plan(),
          chapter: state.currentThemeId ? chapter(state.currentThemeId) : null,
          instruction: "Si kort hva dere begynner med, fremhev 2–3 av kapittelets steder med highlight_places i samme svar, og begynn å fortelle. Ikke still et nytt intervjuspørsmål.",
        };
      }
      case "open_theme": {
        const themeId = typeof args.theme_id === "string" ? args.theme_id : "";
        if (!themeIds.has(themeId)) return { error: "Ukjent tema-ID. Bruk en ID fra boardets kategorier.", themes: named(state.themeOrder) };
        state = applyTourEvent(state, { type: "open_theme", themeId }, themes);
        return { ok: true, plan: plan(), chapter: chapter(themeId) };
      }
      case "note_detour": {
        if (!state.currentThemeId) return { ok: false, note: "Ingen omvisning å komme tilbake til ennå – svar på spørsmålet direkte." };
        state = applyTourEvent(state, { type: "note_detour", about: typeof args.about === "string" ? args.about : "" }, themes);
        return { ok: true, return_to: state.detour ? named([state.detour.returnThemeId])[0] : null };
      }
      case "return_to_tour": {
        if (!state.detour) return { ok: false, note: "Ingen avstikker registrert.", plan: plan() };
        state = applyTourEvent(state, { type: "return_to_tour" }, themes);
        return { ok: true, plan: plan(), chapter: state.currentThemeId ? chapterSummary(chapter(state.currentThemeId)) : null };
      }
      case "find_project_info": {
        const query = typeof args.query === "string" ? args.query.slice(0, 200) : "";
        const themeId = typeof args.theme_id === "string" && themeIds.has(args.theme_id) ? args.theme_id : state.currentThemeId;
        const results = projectInfo.search(query, themeId ? [themeId, "nyhavna"] : ["nyhavna"], 4);
        if (!results.length) {
          state = applyTourEvent(state, { type: "open_question", question: query }, themes);
          return { matches: 0, results: [], note: "Ingen kildebelagt omtale i Nyhavnas eget innhold. Si kort at du ikke har grunnlag for det, uten å gjette." };
        }
        return { matches: results.length, results, note: "Kildebelagte utsagn fra nyhavna.no. Behold status-ordene (planlagt, visjon, vedtatt) når du gjengir dem." };
      }
      default:
        return knowledge(name, args);
    }
  };

  const observeBrowserResult = (name: string, args: Record<string, unknown>, output: unknown, spoken = ""): string | void => {
    const payload = output && typeof output === "object" ? (output as Record<string, unknown>) : {};
    if (typeof payload.error === "string") return;
    const answered = strings(args.answered_faq_ids, 4);
    if (answered.length) state = applyTourEvent(state, { type: "faq_answered", faqIds: answered }, themes);
    if (name === "show_place" && typeof payload.poi_id === "string") {
      // Brukeren ville vite mer om ETT sted: faktaene følger med kartsvaret, så
      // modellen slipper en egen oppslagsrunde – og aldri står igjen med bare
      // «la oss se nærmere på det» (målt 2026-09-13: stedet ble åpnet, ingenting sagt).
      const facts = knowledge("get_place_facts", { poi_id: payload.poi_id });
      return `Kartet har åpnet stedet. Fakta om stedet (data): ${JSON.stringify(facts)}\nFortell om stedet ut fra dette i én til tre setninger, uten å gjenta det du alt har sagt. Mangler grunnlag, si det kort.`;
    }
    if (name === "highlight_places" && Array.isArray(payload.highlighted)) {
      const places = payload.highlighted
        .filter((p): p is { id: string; name: string } => Boolean(p) && typeof p === "object" && typeof (p as { id?: unknown }).id === "string")
        .map((p) => ({ id: p.id, name: typeof p.name === "string" ? p.name : p.id }));
      state = applyTourEvent(state, { type: "highlight", places }, themes);
      // Sa modellen bare en innledning før kartkallet, får den ordet igjen med
      // rekkefølgen den skal svare i – ellers ble brukeren stående uten svar.
      if (spoken.trim() && places.length && !spokenAnswers(spoken, places.map((p) => p.name))) {
        return `Kartet har fremhevet: ${places.map((p, i) => `${i + 1} ${p.name}`).join("; ")}. Det du sa var bare en innledning. Gi nå selve svaret om disse stedene i én til tre setninger, i denne rekkefølgen, uten ny innledning.`;
      }
    } else if (name === "clear_highlights" || name === "reset_board") {
      state = applyTourEvent(state, { type: "clear_highlights" }, themes);
    }
  };

  const noteIfChanged = () => {
    if (state.revision === notedRevision) return null;
    notedRevision = state.revision;
    return tourNote(state, themes);
  };

  const interceptUserMessage = (text: string): string | null => {
    const theme = /\(tema-ID ([^)\s]+)\)/.exec(text)?.[1];
    if (theme && themeIds.has(theme)) {
      state = applyTourEvent(state, { type: "open_theme", themeId: theme }, themes);
      return `Brukeren valgte temaet i kartet; det er åpnet. Kapittel (data): ${JSON.stringify({ plan: plan(), chapter: chapter(theme) })}\nFortell kort om temaet og fremhev 2–3 av stedene med highlight_places i samme svar. Ikke kall open_theme for dette.`;
    }
    const poiId = /\(kart-ID ([^)\s]+)\)/.exec(text)?.[1];
    if (poiId) {
      const facts = knowledge("get_place_facts", { poi_id: poiId });
      if (facts && typeof facts === "object" && !("error" in facts)) {
        return `Brukeren trykket på stedet i kartet; det er alt åpnet der. Fakta om stedet (data): ${JSON.stringify(facts)}\nSi én kort setning om stedet ut fra dette, og fortsett omvisningen. Ikke kall show_place for dette.`;
      }
    }
    return null;
  };

  return { execute, observeBrowserResult, noteIfChanged, interceptUserMessage, state: () => state, themes };
}
