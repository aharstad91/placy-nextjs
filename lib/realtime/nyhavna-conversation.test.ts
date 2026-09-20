import { describe, expect, it } from "vitest";
import { getNyhavnaSnapshot } from "@/lib/demo/nyhavna-leve/snapshot";
import { buildChapter, chapterSummary, spokenFaq, type ProjectInfoProvider } from "@/lib/realtime/nyhavna-chapters";
import { conversationTools, createNyhavnaConversation } from "@/lib/realtime/nyhavna-conversation";
import { NYHAVNA_LABELS } from "@/lib/realtime/conversation-labels";
import { MAP_TOOLS } from "@/lib/realtime/types";

const fakeProjectInfo: ProjectInfoProvider = {
  forTheme: (themeId, limit) => themeId === "leve-park" ? [{ id: "site-park", title: "Grønt nettverk", status: "planlagt", text: "Nyhavna planlegger et nettverk av parker.", source: { url: "https://nyhavna.no/leve/park-og-promenade/", page: "Park og promenade", checked_at: "2026-09-13" } }].slice(0, limit) : [],
  search: (query) => /visjon|eier/.test(query) ? [{ id: "site-vision", title: "Visjon", status: "visjon", text: "Nyhavna skal bli en bydel ved fjorden.", source: { url: "https://nyhavna.no/", page: "Nyhavna", checked_at: "2026-09-13" } }] : [],
};

describe("Nyhavna-samtalen på serveren", () => {
  it("verktøylista har ett navn per verktøy, og kartverktøyene er nøyaktig MAP_TOOLS", () => {
    const names = conversationTools(NYHAVNA_LABELS).map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.filter((n) => MAP_TOOLS.has(n)).sort()).toEqual([...MAP_TOOLS].sort());
    for (const name of ["set_interests", "open_theme", "note_detour", "return_to_tour", "find_project_info", "find_places", "get_place_facts", "get_board_facts"]) expect(names).toContain(name);
  });

  it("kapittelet er avgrenset, har kart-ID-er og bærer kildens status og ikke-plasserte steder", async () => {
    const { board } = await getNyhavnaSnapshot();
    for (const category of board.categories) {
      const chapter = buildChapter(board, category, "walk", fakeProjectInfo);
      expect(chapter.theme_id).toBe(String(category.id));
      expect(chapter.intro.length).toBeGreaterThan(20);
      expect(chapter.places.length).toBeGreaterThan(0);
      expect(chapter.places.length).toBeLessThanOrEqual(4);
      for (const place of chapter.places) expect(board.categories.some((c) => c.pois.some((p) => String(p.id) === place.id))).toBe(true);
      // Spørsmålsinnholdet står i katalogen (instruksjonen); kapittelet bærer bare ID-ene.
      expect(chapter.faq_ids).toEqual((category.editorial?.faq ?? []).map((f) => f.id));
      expect(chapter).not.toHaveProperty("faq");
      expect(JSON.stringify(chapter).length).toBeLessThan(7000);
    }
    const park = buildChapter(board, board.categories.find((c) => String(c.id) === "leve-park")!, "walk", fakeProjectInfo);
    expect(park.source?.url).toContain("nyhavna.no");
    expect(park.unplaced.length).toBeGreaterThan(3);
    expect(park.curated.some((c) => c.id === "elvepromenaden" && c.map_poi_id === "leve-elvepromenaden")).toBe(true);
    expect(park.curated.some((c) => c.map_poi_id === null && c.status === "planned")).toBe(true);
    expect(park.project_info).toHaveLength(1);
    const summary = chapterSummary(park);
    expect(summary).not.toHaveProperty("curated");
    expect(summary).not.toHaveProperty("project_info");
    const transport = buildChapter(board, board.categories.find((c) => String(c.id) === "transport")!, "walk");
    expect(transport.faq_ids.length).toBeGreaterThan(5);
    expect(transport.project_info).toEqual([]);
    const dora = board.categories.flatMap((c) => c.pois).find((p) => String(p.id) === "entur-NSR-StopPlace-43469")!;
    const spoken = spokenFaq({ id: "x", question: "Q", answer: "Gå til [Dora](poi:entur-NSR-StopPlace-43469) og [byen](category:transport).", source: "deterministic" }, new Map([[String(dora.id).toLowerCase(), dora]]));
    expect(spoken.show).toEqual([{ id: "entur-NSR-StopPlace-43469", name: "Dora" }]);
    expect(spoken.answer).toBe("Gå til Dora og byen.");
    expect(spoken.category_ids).toEqual(["transport"]);
  });

  it("to brukere får ulikt første kapittel; interesser uten tema-ID-er avledes; tom liste gir generell tur", async () => {
    const { board } = await getNyhavnaSnapshot();
    const family = createNyhavnaConversation(board);
    const foodie = createNyhavnaConversation(board);
    const a = family.execute("set_interests", { interests: ["barn og skole"], theme_ids: ["barn-oppvekst"] }).result as { ok: boolean; chapter: { theme_id: string }; plan: { next: Array<{ theme_id: string }> } };
    const b = foodie.execute("set_interests", { interests: ["kafeer og kaffe"] }).result as { chapter: { theme_id: string } };
    expect(a.chapter.theme_id).toBe("barn-oppvekst");
    expect(b.chapter.theme_id).toBe("leve-servering");
    expect(a.plan.next.map((t) => t.theme_id)).not.toContain("barn-oppvekst");
    // Backenden valgte boardets generelle tema: Nyhavnas eget tema for samme interesse går først.
    const c = createNyhavnaConversation(board).execute("set_interests", { interests: ["kaféer og kunst"], theme_ids: ["mat-drikke", "opplevelser"] }).result as { chapter: { theme_id: string }; plan: { next: Array<{ theme_id: string }> } };
    expect(c.chapter.theme_id).toBe("leve-servering");
    expect(c.plan.next.map((t) => t.theme_id).slice(0, 3)).toEqual(["leve-kultur", "mat-drikke", "opplevelser"]);
    const general = createNyhavnaConversation(board).execute("set_interests", { interests: [], theme_ids: [] }).result as { general_tour: boolean; chapter: { theme_id: string } };
    expect(general.general_tour).toBe(true);
    expect(general.chapter.theme_id).toBe("leve-servering");
  });

  it("temainngang fremhever kapittelets tre første steder selv, og forteller backenden rekkefølgen", async () => {
    const { board } = await getNyhavnaSnapshot();
    const conversation = createNyhavnaConversation(board);
    const opened = conversation.execute("set_interests", { interests: ["kultur"], theme_ids: ["leve-kultur"] });
    const chapter = (opened.result as { chapter: { places: Array<{ id: string; name: string }> }; instruction: string }).chapter;
    const expected = chapter.places.slice(0, 3).map((p) => p.id);
    expect(opened.directives).toEqual([{ name: "highlight_places", args: { poi_ids: expected } }]);
    expect((opened.result as { instruction: string }).instruction).toContain("Ikke kall highlight_places for disse");
    expect((opened.result as { instruction: string }).instruction).toContain(`1 ${chapter.places[0].name}`);
    // Tilstanden settes optimistisk, i samme rekkefølge som direktivet.
    expect(conversation.state().highlighted.map((p) => p.id)).toEqual(expected);
    // Nettleserens bekreftelse med identisk rekkefølge er ikke en ny endring.
    conversation.noteIfChanged();
    conversation.observeBrowserResult("highlight_places", { poi_ids: expected }, { ok: true, highlighted: chapter.places.slice(0, 3).map((p, i) => ({ ord: i + 1, id: p.id, name: p.name })) });
    expect(conversation.noteIfChanged()).toBeNull();
    const next = conversation.execute("open_theme", { theme_id: "transport" });
    expect(next.directives?.[0]?.name).toBe("highlight_places");
    expect(conversation.state().highlighted.map((p) => p.id)).not.toEqual(expected);
  });

  it("noterer bare når tilstanden endres, og speiler kartets faktiske fremheving i rekkefølge", async () => {
    const { board } = await getNyhavnaSnapshot();
    const conversation = createNyhavnaConversation(board);
    expect(conversation.noteIfChanged()).toBeNull();
    conversation.execute("set_interests", { interests: ["kultur"], theme_ids: ["leve-kultur"] });
    const first = conversation.noteIfChanged();
    expect(first).toContain("Tema nå: Kunst og kultur (leve-kultur)");
    expect(conversation.noteIfChanged()).toBeNull();
    // Nettleseren bekrefter fremheving – i sin rekkefølge, ikke backendens ønske.
    conversation.observeBrowserResult("highlight_places", { poi_ids: ["leve-dora2", "leve-fyringsbunkeren"], answered_faq_ids: ["kulturaksen"] }, { ok: true, highlighted: [{ ord: 1, id: "leve-fyringsbunkeren", name: "Fyringsbunkeren" }, { ord: 2, id: "leve-dora2", name: "Dora 2" }] });
    const second = conversation.noteIfChanged();
    expect(second).toContain("1 Fyringsbunkeren (leve-fyringsbunkeren); 2 Dora 2 (leve-dora2)");
    expect(second).toContain("Besvarte spørsmål (ID): kulturaksen");
    // Feil fra kartet endrer ingenting.
    conversation.observeBrowserResult("highlight_places", { poi_ids: ["x"] }, { error: "Ukjent" });
    expect(conversation.noteIfChanged()).toBeNull();
    conversation.observeBrowserResult("reset_board", {}, { ok: true, shown: "Hele nabolaget" });
    expect(conversation.noteIfChanged()).toContain("Fremhevet i kartet: ingen.");
    // Et åpnet sted er ren kartstatus: ingen tekst tilbake herfra.
    expect(conversation.observeBrowserResult("show_place", { poi_id: "leve-dora2" }, { ok: true, shown: "Dora 2", poi_id: "leve-dora2" })).toBeUndefined();
  });

  it("karttilstanden sendes til stemmen bare når den har endret seg", async () => {
    const { board } = await getNyhavnaSnapshot();
    const conversation = createNyhavnaConversation(board);
    expect(conversation.mapContextIfChanged()).toBeNull();
    conversation.execute("set_interests", { interests: ["kultur"], theme_ids: ["leve-kultur"] });
    const shown = conversation.mapContextIfChanged();
    expect(shown).toContain("Kartet viser nå: 1 ");
    expect(conversation.mapContextIfChanged()).toBeNull();
    conversation.setBoardState({ selected_category_id: "transport", selected_place_id: "leve-dora2", travel_mode: "bike" });
    const withBoard = conversation.mapContextIfChanged();
    expect(withBoard).toContain("Tema i kartet: Transport.");
    expect(withBoard).toContain("Åpnet sted: Dora 2.");
    expect(withBoard).toContain("Reisemåte i kartet: bike.");
    expect(conversation.mapContextIfChanged()).toBeNull();
  });

  it("et trykk på tema eller sted i kartet gir stemmen en kort replikk, og kartet direktivene", async () => {
    const { board } = await getNyhavnaSnapshot();
    const conversation = createNyhavnaConversation(board, { projectInfo: fakeProjectInfo });
    const theme = conversation.onMapSelection("theme", "leve-park")!;
    expect(theme.commentary).toContain("Brukeren valgte temaet «Park og promenade» i kartet.");
    expect(theme.commentary).toContain("Kartet fremhever nå 1 ");
    expect(theme.commentary).toContain("Ikke still spørsmål tilbake.");
    expect(theme.commentary.split(/\s+/).length).toBeLessThan(130);
    expect(theme.directives[0]?.name).toBe("highlight_places");
    expect(conversation.state().currentThemeId).toBe("leve-park");
    expect(conversation.noteIfChanged()).toContain("Tema nå: Park og promenade (leve-park)");
    // Samme prosjektpost legges ikke ved igjen.
    const again = conversation.execute("open_theme", { theme_id: "leve-park" }).result as { chapter: { project_info: unknown[] } };
    expect(again.chapter.project_info).toEqual([]);
    const place = conversation.onMapSelection("place", "leve-dora2")!;
    expect(place.commentary).toContain("Brukeren trykket på «Dora 2» i kartet");
    expect(place.commentary).toContain("Bekreftede fakta:");
    expect(place.directives).toEqual([]);
    // Registerdata er ikke kontrollerte fakta, og guiden skal si nettopp det.
    const register = conversation.onMapSelection("place", String(board.categories.flatMap((c) => c.pois).find((p) => String(p.id).startsWith("google-"))!.id))!;
    expect(register.commentary).toContain("bare registerdata");
    expect(conversation.onMapSelection("theme", "finnes-ikke")).toBeNull();
    expect(conversation.onMapSelection("place", "finnes-ikke")).toBeNull();
  });

  it("avstikker og retur gir sammendrag, ikke hele kapittelet; ukjent tema avvises", async () => {
    const { board } = await getNyhavnaSnapshot();
    const conversation = createNyhavnaConversation(board);
    expect(conversation.execute("note_detour", { about: "x" }).result).toMatchObject({ ok: false });
    conversation.execute("set_interests", { interests: ["buss"], theme_ids: ["transport", "hverdagsliv"] });
    expect(conversation.execute("note_detour", { about: "Solsiden" }).result).toEqual({ ok: true, return_to: { theme_id: "transport", name: "Transport" } });
    const back = conversation.execute("return_to_tour", {}).result as { ok: boolean; chapter: { theme_id: string }; plan: { next: Array<{ theme_id: string }> } };
    expect(back.ok).toBe(true);
    expect(back.chapter.theme_id).toBe("transport");
    expect(back.chapter).not.toHaveProperty("curated");
    expect(back.plan.next[0]?.theme_id).toBe("hverdagsliv");
    expect(conversation.execute("return_to_tour", {}).result).toMatchObject({ ok: false });
    expect(conversation.execute("open_theme", { theme_id: "finnes-ikke" }).result).toHaveProperty("error");
    const opened = conversation.execute("open_theme", { theme_id: "hverdagsliv" }).result as { chapter: { theme_id: string; faq_ids: unknown[] } };
    expect(opened.chapter.theme_id).toBe("hverdagsliv");
    expect(opened.chapter.faq_ids.length).toBeGreaterThan(5);
    expect(conversation.state().coveredThemeIds).toEqual(["transport"]);
  });

  it("prosjektinnhold hentes per spørsmål, og manglende grunnlag registreres uten oppdiktet svar", async () => {
    const { board } = await getNyhavnaSnapshot();
    const conversation = createNyhavnaConversation(board, { projectInfo: fakeProjectInfo });
    expect(conversation.execute("find_project_info", { query: "hva er visjonen" }).result).toMatchObject({ matches: 1, results: [{ id: "site-vision", status: "visjon" }] });
    const missing = conversation.execute("find_project_info", { query: "når er alt ferdig" }).result as { matches: number; note: string };
    expect(missing.matches).toBe(0);
    expect(missing.note).toMatch(/ikke har grunnlag/);
    expect(conversation.noteIfChanged()).toContain("Uten grunnlag i kildene: når er alt ferdig");
    // Kunnskapsverktøyene går fortsatt gjennom, pakket i result.
    expect(conversation.execute("find_places", { query: "Dora Kaffebar" }).result).toMatchObject({ places: [{ id: "dora-kaffebar" }] });
    expect(conversation.execute("ukjent", {}).result).toHaveProperty("error");
  });
});

/**
 * Verktøytekstene er det modellen leser. Sto stedsnavnet i koden, ville enhver
 * ny demo fått en guide som sa at den leter på Nyhavna mens boardet viste noe
 * annet. Testene holder to løfter samtidig: snapshotet sier ordrett det samme
 * som før, og et annet prosjekt nevner ikke Nyhavna med ett ord.
 */
describe("verktøytekstene følger datasettets navn", () => {
  const description = (labels: Parameters<typeof conversationTools>[0], name: string) =>
    conversationTools(labels).find((tool) => tool.name === name)?.description;

  it("er ordrett uendret for det frosne snapshotet", () => {
    expect(description(NYHAVNA_LABELS, "find_places")).toBe(
      "Finn steder på Nyhavna: først kildekontrollerte omtaler, så boardets register. Opptil 6 treff med ID; ikke-plasserte omtaler kan forklares, ikke vises.",
    );
    expect(description(NYHAVNA_LABELS, "get_board_facts")).toBe(
      "Kort kildekontrollert introduksjon til Nyhavna og temaene.",
    );
    expect(description(NYHAVNA_LABELS, "find_project_info")).toBe(
      "Søk i Nyhavna Utviklings eget innhold (nyhavna.no): prosjektet, hvem som står bak, visjon, planer, status, hverdagsliv. Returnerer kildebelagte utsagn med status (eksisterende, planlagt, vedtatt plan, visjon, uavklart).",
    );
  });

  it("nevner ikke Nyhavna for et annet prosjekt", () => {
    const labels = { areaName: "Leangenbukta", projectInfoLabel: "det kildekontrollerte materialet om Leangenbukta" };
    const texts = conversationTools(labels).map((tool) => `${tool.name} ${tool.description ?? ""}`).join("\n");
    expect(texts).not.toMatch(/Nyhavna/i);
    expect(texts).toContain("Finn steder på Leangenbukta");
    expect(texts).toContain("Søk i det kildekontrollerte materialet om Leangenbukta");
  });

  it("henter det tomme svaret fra datasettets navn, uten å bytte ordlyd for snapshotet", async () => {
    const { board } = await getNyhavnaSnapshot();
    const empty = { forTheme: () => [], search: () => [] };
    const nyhavna = createNyhavnaConversation(board, { projectInfo: empty, labels: NYHAVNA_LABELS });
    expect(nyhavna.execute("find_project_info", { query: "pizza" }).result).toMatchObject({
      matches: 0,
      note: "Ingen kildebelagt omtale i Nyhavnas eget innhold. Si kort at du ikke har grunnlag for det, uten å gjette.",
    });
    const other = createNyhavnaConversation(board, {
      projectInfo: empty,
      labels: { areaName: "Leangenbukta", projectInfoLabel: "det kildekontrollerte materialet om Leangenbukta" },
    });
    const note = String((other.execute("find_project_info", { query: "pizza" }).result as { note: string }).note);
    expect(note).toBe("Ingen kildebelagt omtale i det kildekontrollerte materialet om Leangenbukta. Si kort at du ikke har grunnlag for det, uten å gjette.");
    expect(note).not.toMatch(/Nyhavna/i);
  });

  it("legger bare til områdets egen temanøkkel når datasettet har en", async () => {
    const { board } = await getNyhavnaSnapshot();
    const seen: string[][] = [];
    const spy = { forTheme: () => [], search: (_q: string, themes: readonly string[]) => { seen.push([...themes]); return []; } };
    createNyhavnaConversation(board, { projectInfo: spy, labels: NYHAVNA_LABELS }).execute("find_project_info", { query: "visjon" });
    expect(seen[0]).toEqual(["nyhavna"]);
    createNyhavnaConversation(board, {
      projectInfo: spy,
      labels: { areaName: "Leangenbukta", projectInfoLabel: "materialet" },
    }).execute("find_project_info", { query: "visjon" });
    expect(seen[1]).toEqual([]);
  });
});
