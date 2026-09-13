import { describe, expect, it } from "vitest";
import {
  applyTourEvent, defaultTourOrder, initialTourState, nextThemes, orderThemes, themesForInterests, tourNote,
  type TourEvent, type TourState, type TourTheme,
} from "@/lib/realtime/tour-state";

const themes: (TourTheme & { sourced?: boolean })[] = [
  { id: "leve-servering", name: "Café og restauranter", sourced: true },
  { id: "leve-park", name: "Park og promenade", sourced: true },
  { id: "leve-kultur", name: "Kunst og kultur", sourced: true },
  { id: "hverdagsliv", name: "Hverdag" },
  { id: "barn-oppvekst", name: "Oppvekst" },
  { id: "transport", name: "Transport" },
];

const run = (events: TourEvent[], from = initialTourState(themes)) => events.reduce((state, event) => applyTourEvent(state, event, themes), from);

describe("omvisningens tilstand", () => {
  it("to brukere med ulike interesser får ulikt første tema fra samme grunnlag", () => {
    const family = run([{ type: "set_interests", interests: ["barn og skole"], themeIds: ["barn-oppvekst", "transport"] }]);
    const foodie = run([{ type: "set_interests", interests: ["kaféer"], themeIds: ["leve-servering"] }]);
    expect(nextThemes(family, 1)).toEqual(["barn-oppvekst"]);
    expect(nextThemes(foodie, 1)).toEqual(["leve-servering"]);
    expect(family.themeOrder).toEqual(["barn-oppvekst", "transport", "leve-servering", "leve-park", "leve-kultur", "hverdagsliv"]);
    expect(family.phase).toBe("touring");
  });

  it("generell tur legger Nyhavnas eget innhold først", () => {
    expect(defaultTourOrder(themes)).toEqual(["leve-servering", "leve-park", "leve-kultur", "hverdagsliv", "barn-oppvekst", "transport"]);
    expect(orderThemes(themes, ["finnes-ikke", "transport", "transport"])).toEqual(["transport", "leve-servering", "leve-park", "leve-kultur", "hverdagsliv", "barn-oppvekst"]);
  });

  it("avleder temaer fra interessene når modellen ikke oppgir noen", () => {
    expect(themesForInterests(["Vi har to små barn", "og jeg pendler med buss"], themes)).toEqual(["barn-oppvekst", "transport"]);
    expect(themesForInterests(["kaffe og kultur"], themes)).toEqual(["leve-servering", "leve-kultur"]);
    expect(themesForInterests(["ingenting spesielt"], themes)).toEqual([]);
  });

  it("fordypning → retur beholder hovedtråden, mens ny interesse endrer resten", () => {
    let state = run([
      { type: "set_interests", interests: ["barn"], themeIds: ["barn-oppvekst", "transport"] },
      { type: "open_theme", themeId: "barn-oppvekst" },
      { type: "note_detour", about: "Solsiden" },
    ]);
    expect(state.detour).toEqual({ returnThemeId: "barn-oppvekst", about: "Solsiden" });
    state = applyTourEvent(state, { type: "return_to_tour" }, themes);
    expect(state.detour).toBeNull();
    expect(state.currentThemeId).toBe("barn-oppvekst");
    expect(nextThemes(state, 1)).toEqual(["transport"]);
    // Ny interesse: resten av turen endres, det gjennomgåtte står.
    state = applyTourEvent(state, { type: "open_theme", themeId: "transport" }, themes);
    state = applyTourEvent(state, { type: "set_interests", interests: ["kaféer"], themeIds: ["leve-servering"] }, themes);
    expect(state.coveredThemeIds).toEqual(["barn-oppvekst"]);
    expect(state.currentThemeId).toBe("transport");
    expect(nextThemes(state)).toEqual(["leve-servering", "leve-park", "leve-kultur"]);
  });

  it("et nytt tema er et valg og nullstiller avstikkeren; ukjent tema avvises", () => {
    let state = run([{ type: "open_theme", themeId: "hverdagsliv" }, { type: "note_detour", about: "kino" }]);
    expect(state.detour).not.toBeNull();
    state = applyTourEvent(state, { type: "open_theme", themeId: "transport" }, themes);
    expect(state.detour).toBeNull();
    expect(state.coveredThemeIds).toEqual(["hverdagsliv"]);
    const before = state;
    expect(applyTourEvent(state, { type: "open_theme", themeId: "finnes-ikke" }, themes)).toBe(before);
    expect(applyTourEvent(initialTourState(themes), { type: "note_detour", about: "x" }, themes).detour).toBeNull();
  });

  it("fremhevingen er ordnet, deduplisert og begrenset til seks", () => {
    const state = run([{ type: "highlight", places: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "a", name: "A igjen" }, { id: "c", name: "C" }, { id: "d", name: "D" }, { id: "e", name: "E" }, { id: "f", name: "F" }, { id: "g", name: "G" }] }]);
    expect(state.highlighted.map((p) => p.id)).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(tourNote(state, themes)).toContain("1 A (a); 2 B (b); 3 C (c)");
    expect(tourNote(state, themes)).toContain("Referanser: «det første stedet» = A; «det andre stedet» = B; «det tredje stedet» = C");
    const cleared = applyTourEvent(state, { type: "clear_highlights" }, themes);
    expect(cleared.highlighted).toEqual([]);
    expect(applyTourEvent(cleared, { type: "clear_highlights" }, themes)).toBe(cleared);
  });

  it("notatet bærer interesser, fremdrift og returpunkt uten historikk (simulert forkorting)", () => {
    const state = run([
      { type: "set_interests", interests: ["barn og skole", "kaféer"], themeIds: ["barn-oppvekst", "leve-servering"] },
      { type: "open_theme", themeId: "barn-oppvekst" },
      { type: "faq_answered", faqIds: ["skolekrets"] },
      { type: "highlight", places: [{ id: "school-1", name: "Lilleby skole" }, { id: "kg-2", name: "Nyhavna barnehage" }] },
      { type: "note_detour", about: "Dora Kaffebar" },
      { type: "open_question", question: "åpningstider Dora Kaffebar" },
    ]);
    // «Forkorting»: alt som finnes er tilstanden – ingen meldinger, ingen transkripsjon.
    const note = tourNote(JSON.parse(JSON.stringify(state)) as TourState, themes);
    expect(note).toContain("Interesser: barn og skole; kaféer.");
    expect(note).toContain("Tema nå: Oppvekst (barn-oppvekst).");
    expect(note).toContain("Neste: Café og restauranter (leve-servering)");
    expect(note).toContain("Besvarte spørsmål (ID): skolekrets.");
    expect(note).toContain("1 Lilleby skole (school-1); 2 Nyhavna barnehage (kg-2)");
    expect(note).toContain("Avstikker: Dora Kaffebar – tilbake til Oppvekst (barn-oppvekst)");
    expect(note).toContain("Uten grunnlag i kildene: åpningstider Dora Kaffebar.");
    expect(note.split(/\s+/).length).toBeLessThan(130);
  });

  it("starter tomt og sier det i notatet; reset gir tom profil", () => {
    const fresh = initialTourState(themes);
    expect(tourNote(fresh, themes)).toContain("Interesser: ikke oppgitt ennå");
    expect(tourNote(fresh, themes)).not.toContain("Neste:");
    const used = run([{ type: "set_interests", interests: ["barn"], themeIds: ["barn-oppvekst"] }, { type: "highlight", places: [{ id: "x", name: "X" }] }]);
    const reset = applyTourEvent(used, { type: "reset" }, themes);
    expect(reset).toMatchObject({ interests: [], highlighted: [], currentThemeId: null, phase: "welcome" });
    expect(reset.revision).toBeGreaterThan(used.revision);
  });
});
