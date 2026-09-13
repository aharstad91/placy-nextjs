/**
 * Omvisningens samtaletilstand – deterministisk, på serveren (2026-09-13).
 *
 * Modellen får IKKE eie fremdriften. Realtime-historikken er lyd og tekst som
 * kan kuttes, glemmes eller misforstås; brukerens interesser, hvor vi er i
 * turen, hva som er fremhevet i kartet og hvor vi skal tilbake etter en
 * avstikker må derfor ligge som strukturerte data ved siden av. Modellen
 * FORESLÅR endringer gjennom verktøy, koden validerer ID-er og overganger, og
 * et kompakt notat (`tourNote`) sendes tilbake til modellen hver gang
 * tilstanden endres. Notatet er alltid det ferskeste systeminnslaget, så det
 * overlever en eventuell forkorting av eldre historikk.
 *
 * Alt her er rent: ingen React, ingen socket, ingen Realtime-event. Det er det
 * som gjør overgangene testbare uten en betalt samtale.
 */

export interface TourTheme {
  id: string;
  name: string;
}

export interface HighlightedPlace {
  id: string;
  name: string;
}

export interface TourState {
  /** Brukerens uttalte interesser, i egne ord (korte fraser). */
  interests: string[];
  /** Personlig temarekkefølge: alle boardets temaer, brukerens først. */
  themeOrder: string[];
  currentThemeId: string | null;
  /** Temaer vi har vært gjennom (åpnet og forlatt). */
  coveredThemeIds: string[];
  /** Spørsmål fra katalogen som er besvart. */
  coveredFaqIds: string[];
  /** Stedene som står fremhevet i kartet, i uttalt rekkefølge («det andre»). */
  highlighted: HighlightedPlace[];
  /** Avstikker fra hovedtråden og hvor vi skal tilbake til. */
  detour: { returnThemeId: string; about: string } | null;
  /** Ting brukeren spurte om som vi ikke hadde grunnlag for. */
  openQuestions: string[];
  phase: "welcome" | "touring";
  revision: number;
}

export type TourEvent =
  | { type: "set_interests"; interests: string[]; themeIds: string[] }
  | { type: "open_theme"; themeId: string }
  | { type: "faq_answered"; faqIds: string[] }
  | { type: "highlight"; places: HighlightedPlace[] }
  | { type: "clear_highlights" }
  | { type: "note_detour"; about: string }
  | { type: "return_to_tour" }
  | { type: "open_question"; question: string }
  | { type: "reset" };

const MAX_LIST = 12;
const MAX_TEXT = 80;
const ORDINALS = ["det første", "det andre", "det tredje", "det fjerde", "det femte", "det sjette"];

const clean = (value: unknown, max = MAX_TEXT): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

const unique = <T,>(items: readonly T[]): T[] => [...new Set(items)];

export function initialTourState(themes: readonly TourTheme[]): TourState {
  return {
    interests: [],
    themeOrder: themes.map((t) => t.id),
    currentThemeId: null,
    coveredThemeIds: [],
    coveredFaqIds: [],
    highlighted: [],
    detour: null,
    openQuestions: [],
    phase: "welcome",
    revision: 0,
  };
}

/**
 * Personlig rekkefølge: brukerens temaer først (i oppgitt rekkefølge), så
 * resten i boardets egen rekkefølge. Gjennomgåtte temaer beholdes i lista, men
 * `nextThemes` hopper over dem.
 */
export function orderThemes(
  themes: readonly TourTheme[],
  preferred: readonly string[],
): string[] {
  const known = new Set(themes.map((t) => t.id));
  const head = unique(preferred.filter((id) => known.has(id)));
  const tail = themes.map((t) => t.id).filter((id) => !head.includes(id));
  return [...head, ...tail];
}

export function nextThemes(state: TourState, limit = 3): string[] {
  const done = new Set([...state.coveredThemeIds, state.currentThemeId ?? ""]);
  return state.themeOrder.filter((id) => !done.has(id)).slice(0, limit);
}

export function applyTourEvent(
  state: TourState,
  event: TourEvent,
  themes: readonly TourTheme[],
): TourState {
  const bump = (next: Omit<TourState, "revision">): TourState => ({
    ...next,
    revision: state.revision + 1,
  });
  switch (event.type) {
    case "set_interests": {
      const interests = unique(
        event.interests.map((i) => clean(i, 60)).filter(Boolean),
      ).slice(0, 6);
      const themeOrder = orderThemes(themes, event.themeIds);
      return bump({
        ...state,
        interests,
        themeOrder,
        // Ny interesse endrer resten av turen, ikke det vi alt har sett.
        detour: null,
        phase: "touring",
      });
    }
    case "open_theme": {
      if (!themes.some((t) => t.id === event.themeId)) return state;
      if (state.currentThemeId === event.themeId && state.detour === null) return state;
      const covered =
        state.currentThemeId && state.currentThemeId !== event.themeId
          ? unique([...state.coveredThemeIds, state.currentThemeId])
          : state.coveredThemeIds;
      return bump({
        ...state,
        currentThemeId: event.themeId,
        coveredThemeIds: covered.slice(-MAX_LIST),
        // Et nytt tema er et valg, ikke en avstikker: returpunktet er ikke
        // lenger meningsfullt.
        detour: null,
        phase: "touring",
      });
    }
    case "faq_answered": {
      const ids = unique([...state.coveredFaqIds, ...event.faqIds.map((id) => clean(id, 60)).filter(Boolean)]);
      if (ids.length === state.coveredFaqIds.length) return state;
      return bump({ ...state, coveredFaqIds: ids.slice(-MAX_LIST * 3) });
    }
    case "highlight": {
      const seen = new Set<string>();
      const places = event.places
        .filter((p) => p && typeof p.id === "string" && p.id && !seen.has(p.id) && seen.add(p.id))
        .map((p) => ({ id: p.id, name: clean(p.name, 60) || p.id }))
        .slice(0, 6);
      // Serveren fremhever optimistisk og nettleseren bekrefter samme
      // rekkefølge like etter. Identisk fremheving er ikke en endring: bumpet
      // ville sendt et likelydende notat til backenden én gang til.
      const same = places.length === state.highlighted.length
        && places.every((p, i) => p.id === state.highlighted[i].id && p.name === state.highlighted[i].name);
      if (same) return state;
      return bump({ ...state, highlighted: places });
    }
    case "clear_highlights":
      if (state.highlighted.length === 0) return state;
      return bump({ ...state, highlighted: [] });
    case "note_detour": {
      // Uten et tema å komme tilbake til finnes ingen avstikker – bare samtale.
      if (!state.currentThemeId) return state;
      return bump({
        ...state,
        detour: {
          returnThemeId: state.detour?.returnThemeId ?? state.currentThemeId,
          about: clean(event.about) || "et sidespor",
        },
      });
    }
    case "return_to_tour": {
      if (!state.detour) return state;
      return bump({ ...state, currentThemeId: state.detour.returnThemeId, detour: null });
    }
    case "open_question": {
      const question = clean(event.question);
      if (!question || state.openQuestions.includes(question)) return state;
      return bump({ ...state, openQuestions: [...state.openQuestions, question].slice(-6) });
    }
    case "reset":
      return { ...initialTourState(themes), revision: state.revision + 1 };
    default:
      return state;
  }
}

/**
 * Det kompakte notatet modellen får når tilstanden endres. Norsk, korte
 * linjer, ID-er i parentes der modellen trenger dem til verktøy. Målet er
 * under ~120 ord uansett hvor lang samtalen har blitt.
 */
export function tourNote(state: TourState, themes: readonly TourTheme[]): string {
  const name = (id: string | null) => (id ? themes.find((t) => t.id === id)?.name ?? id : null);
  const withId = (id: string) => `${name(id)} (${id})`;
  const lines: string[] = ["Samtalenotat (data; erstatter tidligere notat):"];
  lines.push(
    state.interests.length
      ? `Interesser: ${state.interests.join("; ")}.`
      : "Interesser: ikke oppgitt ennå – still ett åpent spørsmål, eller tilby en generell tur.",
  );
  if (state.currentThemeId) lines.push(`Tema nå: ${withId(state.currentThemeId)}.`);
  const next = nextThemes(state);
  if (state.phase === "touring") {
    lines.push(next.length ? `Neste: ${next.map(withId).join(", ")}.` : "Neste: ingen temaer igjen – tilby oppsummering eller fri utforsking.");
  }
  if (state.coveredThemeIds.length) lines.push(`Gjennomgått: ${state.coveredThemeIds.map((id) => name(id)).join(", ")}.`);
  if (state.coveredFaqIds.length) lines.push(`Besvarte spørsmål (ID): ${state.coveredFaqIds.slice(-8).join(", ")}.`);
  lines.push(
    state.highlighted.length
      ? `Fremhevet i kartet (rekkefølge): ${state.highlighted.map((p, i) => `${i + 1} ${p.name} (${p.id})`).join("; ")}.`
      : "Fremhevet i kartet: ingen.",
  );
  // «Det andre stedet» er tvetydig på norsk (nummer to / det andre). Ordboka
  // gjør tolkningen deterministisk for modellen: rekkefølgen i kartet vinner.
  if (state.highlighted.length >= 2) {
    lines.push(`Referanser: ${state.highlighted.slice(0, ORDINALS.length).map((p, i) => `«${ORDINALS[i]} stedet» = ${p.name}`).join("; ")}.`);
  }
  if (state.detour) lines.push(`Avstikker: ${state.detour.about} – tilbake til ${withId(state.detour.returnThemeId)} når brukeren er ferdig.`);
  if (state.openQuestions.length) lines.push(`Uten grunnlag i kildene: ${state.openQuestions.join("; ")}.`);
  return lines.join("\n");
}

/**
 * Enkel ordbok fra brukerens egne ord til boardets temaer, som reserve når
 * modellen ikke oppgir tema-ID-er selv. Bevisst liten: det er modellen som
 * skal tolke, dette er sikkerhetsnettet.
 */
const INTEREST_WORDS: Array<[RegExp, string[]]> = [
  [/barn|skole|barnehage|oppvekst|unge|familie/, ["barn-oppvekst"]],
  [/kaf[eé]|kaffe|restaurant|spise|mat|middag|bryggeri|øl|bar\b|pub/, ["leve-servering", "mat-drikke"]],
  [/kunst|kultur|galleri|scene|musikk|konsert|atelier/, ["leve-kultur", "opplevelser"]],
  [/park|promenade|grønt|natur|\btur\b|\bturer\b|fjord|bade|sjø|\belv/, ["leve-park", "natur-friluftsliv"]],
  [/buss|tog|kollektiv|sykkel|bil\b|parkering|pendle|jobb|sentrum|byen|reise/, ["transport"]],
  [/tren|gym|løp|idrett|aktivitet|padel|klatr|yoga/, ["trening-aktivitet"]],
  [/butikk|dagligvare|handle|apotek|lege|hverdag|ærend/, ["hverdagsliv"]],
  [/kino|bibliotek|museum|opplev|kirke/, ["opplevelser"]],
];

export function themesForInterests(
  interests: readonly string[],
  themes: readonly TourTheme[],
): string[] {
  const known = new Set(themes.map((t) => t.id));
  const text = interests.join(" ").toLocaleLowerCase("nb");
  const hits: string[] = [];
  for (const [pattern, ids] of INTEREST_WORDS) {
    if (pattern.test(text)) hits.push(...ids.filter((id) => known.has(id)));
  }
  return unique(hits);
}

/**
 * Standardrekkefølgen for en generell tur: Nyhavnas eget innhold først (de
 * temaene som bærer en kilde), så boardets egne. Brukes når brukeren ikke
 * oppgir interesser og ber om «bare vis meg rundt».
 */
export function defaultTourOrder(themes: readonly (TourTheme & { sourced?: boolean })[]): string[] {
  return [...themes.filter((t) => t.sourced), ...themes.filter((t) => !t.sourced)].map((t) => t.id);
}
