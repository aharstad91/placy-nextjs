import { describe, expect, it } from "vitest";
import {
  reelsReducer,
  defaultMapOpenForCard,
  type ReelsState,
} from "../reels-state";
import type { ReelsCard } from "../reels-data";

// Minimale kort — kun `kind` brukes av flate-logikken. Cast forbi de øvrige
// felt-kravene (testen handler om surface-derivasjon, ikke kort-innhold).
const card = (kind: ReelsCard["kind"]): ReelsCard =>
  ({ kind }) as unknown as ReelsCard;

const cards: ReelsCard[] = [
  card("intro"),
  card("welcome"),
  card("category"),
  card("outro"),
  card("summary"),
];

function baseState(overrides: Partial<ReelsState> = {}): ReelsState {
  return {
    cards,
    activeIndex: 0,
    currentPhase: "intro",
    mapOpen: false,
    teaserArmed: false,
    audioUnlocked: false,
    mapMounted: false,
    ...overrides,
  };
}

describe("defaultMapOpenForCard", () => {
  it("er true for map-forward beats (welcome/home/outro)", () => {
    expect(defaultMapOpenForCard(card("welcome"))).toBe(true);
    expect(defaultMapOpenForCard(card("home"))).toBe(true);
    expect(defaultMapOpenForCard(card("outro"))).toBe(true);
  });

  it("er false for historie-flate-beats (intro/category/summary/megler)", () => {
    expect(defaultMapOpenForCard(card("intro"))).toBe(false);
    expect(defaultMapOpenForCard(card("category"))).toBe(false);
    expect(defaultMapOpenForCard(card("summary"))).toBe(false);
    expect(defaultMapOpenForCard(card("megler"))).toBe(false);
  });

  it("er false for undefined (ingen kort)", () => {
    expect(defaultMapOpenForCard(undefined)).toBe(false);
  });
});

describe("reelsReducer — flate-tilstand (mapOpen)", () => {
  it("SET_ACTIVE_INDEX nullstiller mapOpen til beat-default (kart-forward → true)", () => {
    const next = reelsReducer(baseState(), {
      type: "SET_ACTIVE_INDEX",
      index: 1, // welcome
    });
    expect(next.mapOpen).toBe(true);
    expect(next.activeIndex).toBe(1);
  });

  it("SET_ACTIVE_INDEX nullstiller mapOpen til false på kategori (ingen henging)", () => {
    // Bruker hadde åpnet kartet manuelt (mapOpen=true), navigerer til kategori.
    const next = reelsReducer(baseState({ mapOpen: true, activeIndex: 1 }), {
      type: "SET_ACTIVE_INDEX",
      index: 2, // category
    });
    expect(next.mapOpen).toBe(false);
  });

  it("lock-bug-vern: map-full-aktig tilstand henger ikke over til summary", () => {
    // Bruker er på outro med kart åpent; auto-advance lander på summary.
    const next = reelsReducer(baseState({ mapOpen: true, activeIndex: 3 }), {
      type: "SET_ACTIVE_INDEX",
      index: 4, // summary
    });
    expect(next.mapOpen).toBe(false); // historie-flate → alltid en vei ut
  });

  it("SET_MAP_OPEN toggler flaten uten å røre activeIndex", () => {
    const opened = reelsReducer(baseState({ activeIndex: 2 }), {
      type: "SET_MAP_OPEN",
      open: true,
    });
    expect(opened.mapOpen).toBe(true);
    expect(opened.activeIndex).toBe(2);

    const closed = reelsReducer(opened, { type: "SET_MAP_OPEN", open: false });
    expect(closed.mapOpen).toBe(false);
  });

  it("SET_MAP_OPEN er en no-op (samme referanse) når verdien er uendret", () => {
    const state = baseState({ mapOpen: true });
    expect(reelsReducer(state, { type: "SET_MAP_OPEN", open: true })).toBe(state);
  });
});

describe("reelsReducer — kart-teaser (teaserArmed)", () => {
  it("SET_TEASER_ARMED armer/avvæpner glimtet", () => {
    const armed = reelsReducer(baseState({ activeIndex: 2 }), {
      type: "SET_TEASER_ARMED",
      armed: true,
    });
    expect(armed.teaserArmed).toBe(true);
  });

  it("SET_MAP_OPEN(true) konsumerer (skjuler) teaseren", () => {
    const next = reelsReducer(
      baseState({ activeIndex: 2, teaserArmed: true }),
      { type: "SET_MAP_OPEN", open: true },
    );
    expect(next.mapOpen).toBe(true);
    expect(next.teaserArmed).toBe(false);
  });

  it("SET_MAP_OPEN(false) lar teaser-flagget stå urørt", () => {
    const next = reelsReducer(
      baseState({ activeIndex: 2, mapOpen: true, teaserArmed: false }),
      { type: "SET_MAP_OPEN", open: false },
    );
    expect(next.mapOpen).toBe(false);
  });

  it("SET_ACTIVE_INDEX nullstiller teaserArmed (forrige kapittels teaser borte)", () => {
    const next = reelsReducer(
      baseState({ activeIndex: 2, teaserArmed: true }),
      { type: "SET_ACTIVE_INDEX", index: 3 },
    );
    expect(next.teaserArmed).toBe(false);
  });
});
