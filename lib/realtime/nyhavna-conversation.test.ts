import { describe, expect, it } from "vitest";
import { getNyhavnaSnapshot } from "@/lib/demo/nyhavna-leve/snapshot";
import { buildChapter, chapterSummary, spokenFaq, type ProjectInfoProvider } from "@/lib/realtime/nyhavna-chapters";
import { createNyhavnaConversation, nyhavnaTools, spokenAnswers } from "@/lib/realtime/nyhavna-conversation";
import { MAP_TOOLS } from "@/lib/realtime/types";

const fakeProjectInfo: ProjectInfoProvider = {
  forTheme: (themeId, limit) => themeId === "leve-park" ? [{ id: "site-park", title: "Grønt nettverk", status: "planlagt", text: "Nyhavna planlegger et nettverk av parker.", source: { url: "https://nyhavna.no/leve/park-og-promenade/", page: "Park og promenade", checked_at: "2026-09-13" } }].slice(0, limit) : [],
  search: (query) => /visjon|eier/.test(query) ? [{ id: "site-vision", title: "Visjon", status: "visjon", text: "Nyhavna skal bli en bydel ved fjorden.", source: { url: "https://nyhavna.no/", page: "Nyhavna", checked_at: "2026-09-13" } }] : [],
};

describe("Nyhavna-samtalen på serveren", () => {
  it("verktøylista har ett navn per verktøy, og kartverktøyene er nøyaktig MAP_TOOLS", () => {
    const names = nyhavnaTools.map((t) => t.name);
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
    const a = family.execute("set_interests", { interests: ["barn og skole"], theme_ids: ["barn-oppvekst"] }) as { ok: boolean; chapter: { theme_id: string }; plan: { next: Array<{ theme_id: string }> } };
    const b = foodie.execute("set_interests", { interests: ["kafeer og kaffe"] }) as { ok: boolean; chapter: { theme_id: string } };
    expect(a.chapter.theme_id).toBe("barn-oppvekst");
    expect(b.chapter.theme_id).toBe("leve-servering");
    expect(a.plan.next.map((t) => t.theme_id)).not.toContain("barn-oppvekst");
    // Modellen valgte boardets generelle tema: Nyhavnas eget tema for samme interesse går først.
    const c = createNyhavnaConversation(board).execute("set_interests", { interests: ["kaféer og kunst"], theme_ids: ["mat-drikke", "opplevelser"] }) as { chapter: { theme_id: string }; plan: { next: Array<{ theme_id: string }> } };
    expect(c.chapter.theme_id).toBe("leve-servering");
    expect(c.plan.next.map((t) => t.theme_id).slice(0, 3)).toEqual(["leve-kultur", "mat-drikke", "opplevelser"]);
    const general = createNyhavnaConversation(board).execute("set_interests", { interests: [], theme_ids: [] }) as { general_tour: boolean; chapter: { theme_id: string } };
    expect(general.general_tour).toBe(true);
    expect(general.chapter.theme_id).toBe("leve-servering");
  });

  it("noterer bare når tilstanden endres, og speiler kartets faktiske fremheving i rekkefølge", async () => {
    const { board } = await getNyhavnaSnapshot();
    const conversation = createNyhavnaConversation(board);
    expect(conversation.noteIfChanged()).toBeNull();
    conversation.execute("set_interests", { interests: ["kultur"], theme_ids: ["leve-kultur"] });
    const first = conversation.noteIfChanged();
    expect(first).toContain("Tema nå: Kunst og kultur (leve-kultur)");
    expect(conversation.noteIfChanged()).toBeNull();
    // Nettleseren bekrefter fremheving – i sin rekkefølge, ikke modellens ønske.
    conversation.observeBrowserResult("highlight_places", { poi_ids: ["leve-dora2", "leve-fyringsbunkeren"], answered_faq_ids: ["kulturaksen"] }, { ok: true, highlighted: [{ ord: 1, id: "leve-fyringsbunkeren", name: "Fyringsbunkeren" }, { ord: 2, id: "leve-dora2", name: "Dora 2" }] });
    const second = conversation.noteIfChanged();
    expect(second).toContain("1 Fyringsbunkeren (leve-fyringsbunkeren); 2 Dora 2 (leve-dora2)");
    expect(second).toContain("Besvarte spørsmål (ID): kulturaksen");
    // Feil fra kartet endrer ingenting.
    conversation.observeBrowserResult("highlight_places", { poi_ids: ["x"] }, { error: "Ukjent" });
    expect(conversation.noteIfChanged()).toBeNull();
    conversation.observeBrowserResult("reset_board", {}, { ok: true, shown: "Hele nabolaget" });
    expect(conversation.noteIfChanged()).toContain("Fremhevet i kartet: ingen.");
    // Et åpnet sted gir modellen faktaene å fortsette med – ingen egen oppslagsrunde.
    const followUp = conversation.observeBrowserResult("show_place", { poi_id: "leve-dora2" }, { ok: true, shown: "Dora 2", poi_id: "leve-dora2" });
    expect(followUp).toContain("Kartet har åpnet stedet.");
    expect(followUp).toContain('"name":"Dora 2"');
    expect(followUp).toMatch(/"facts":\[\{"text":/);
    expect(conversation.observeBrowserResult("show_place", { poi_id: "x" }, { error: "Ukjent sted." })).toBeUndefined();
    expect(conversation.observeBrowserResult("highlight_places", { poi_ids: ["leve-dora2"] }, { ok: true, highlighted: [{ ord: 1, id: "leve-dora2", name: "Dora 2" }] })).toBeUndefined();
    // Bare en innledning før kartkallet: modellen får ordet igjen med rekkefølgen. Et svar som nevner stedet: ingen ny runde.
    const highlighted = { ok: true, highlighted: [{ ord: 1, id: "leve-dora2", name: "Dora 2" }, { ord: 2, id: "leve-fyringsbunkeren", name: "Fyringsbunkeren" }] };
    expect(conversation.observeBrowserResult("highlight_places", { poi_ids: [] }, highlighted, "Klart, la oss se på hvilken skolekrets som gjelder. Jeg sier frem hovedpunktene.")).toContain("Kartet har fremhevet: 1 Dora 2; 2 Fyringsbunkeren. Det du sa var bare en innledning.");
    expect(conversation.observeBrowserResult("highlight_places", { poi_ids: [] }, highlighted, "Dora 2 er den gamle ubåtbunkeren, ti minutter å gå.")).toBeUndefined();
    expect(conversation.observeBrowserResult("highlight_places", { poi_ids: [] }, highlighted, "")).toBeUndefined();
    expect(spokenAnswers("Vi begynner med kaféene: Dromedar ligger nærmest.", ["Dromedar Kaffebar Solsiden"])).toBe(true);
    expect(spokenAnswers("Flott, la oss sette deg inn i planen for Nyhavna.", ["Lilleby skole"])).toBe(false);
  });

  it("et trykk på tema eller sted i kartet legger ved kapittel eller fakta uten verktøyrunde, og prosjektinnhold sendes én gang", async () => {
    const { board } = await getNyhavnaSnapshot();
    const conversation = createNyhavnaConversation(board, { projectInfo: fakeProjectInfo });
    const attached = conversation.interceptUserMessage("Jeg valgte temaet «Park og promenade» i kartet (tema-ID leve-park). Fortsett omvisningen derfra.");
    expect(attached).toContain("Kapittel (data):");
    expect(attached).toContain('"theme_id":"leve-park"');
    expect(attached).toContain('"id":"site-park"');
    expect(conversation.state().currentThemeId).toBe("leve-park");
    expect(conversation.noteIfChanged()).toContain("Tema nå: Park og promenade (leve-park)");
    // Samme prosjektpost legges ikke ved igjen.
    const again = conversation.execute("open_theme", { theme_id: "leve-park" }) as { chapter: { project_info: unknown[] } };
    expect(again.chapter.project_info).toEqual([]);
    const place = conversation.interceptUserMessage("Jeg trykket på «Dora 2» i kartet (kart-ID leve-dora2). Si én kort setning om stedet hvis du har grunnlag, og fortsett.");
    expect(place).toContain("Fakta om stedet (data):");
    expect(place).toContain('"name":"Dora 2"');
    expect(conversation.interceptUserMessage("Jeg valgte temaet «X» i kartet (tema-ID finnes-ikke).")).toBeNull();
    expect(conversation.interceptUserMessage("Jeg trykket på «Y» i kartet (kart-ID finnes-ikke).")).toBeNull();
    expect(conversation.interceptUserMessage("Hva koster leilighetene?")).toBeNull();
  });

  it("avstikker og retur gir sammendrag, ikke hele kapittelet; ukjent tema avvises", async () => {
    const { board } = await getNyhavnaSnapshot();
    const conversation = createNyhavnaConversation(board);
    expect(conversation.execute("note_detour", { about: "x" })).toMatchObject({ ok: false });
    conversation.execute("set_interests", { interests: ["buss"], theme_ids: ["transport", "hverdagsliv"] });
    expect(conversation.execute("note_detour", { about: "Solsiden" })).toEqual({ ok: true, return_to: { theme_id: "transport", name: "Transport" } });
    const back = conversation.execute("return_to_tour", {}) as { ok: boolean; chapter: { theme_id: string }; plan: { next: Array<{ theme_id: string }> } };
    expect(back.ok).toBe(true);
    expect(back.chapter.theme_id).toBe("transport");
    expect(back.chapter).not.toHaveProperty("curated");
    expect(back.plan.next[0]?.theme_id).toBe("hverdagsliv");
    expect(conversation.execute("return_to_tour", {})).toMatchObject({ ok: false });
    expect(conversation.execute("open_theme", { theme_id: "finnes-ikke" })).toHaveProperty("error");
    const opened = conversation.execute("open_theme", { theme_id: "hverdagsliv" }) as { chapter: { theme_id: string; faq_ids: unknown[] } };
    expect(opened.chapter.theme_id).toBe("hverdagsliv");
    expect(opened.chapter.faq_ids.length).toBeGreaterThan(5);
    expect(conversation.state().coveredThemeIds).toEqual(["transport"]);
  });

  it("prosjektinnhold hentes per spørsmål, og manglende grunnlag registreres uten oppdiktet svar", async () => {
    const { board } = await getNyhavnaSnapshot();
    const conversation = createNyhavnaConversation(board, { projectInfo: fakeProjectInfo });
    expect(conversation.execute("find_project_info", { query: "hva er visjonen" })).toMatchObject({ matches: 1, results: [{ id: "site-vision", status: "visjon" }] });
    const missing = conversation.execute("find_project_info", { query: "når er alt ferdig" }) as { matches: number; note: string };
    expect(missing.matches).toBe(0);
    expect(missing.note).toMatch(/ikke har grunnlag/);
    expect(conversation.noteIfChanged()).toContain("Uten grunnlag i kildene: når er alt ferdig");
    // Kunnskapsverktøyene går fortsatt gjennom.
    expect(conversation.execute("find_places", { query: "Dora Kaffebar" })).toMatchObject({ places: [{ id: "dora-kaffebar" }] });
    expect(conversation.execute("ukjent", {})).toHaveProperty("error");
  });
});
