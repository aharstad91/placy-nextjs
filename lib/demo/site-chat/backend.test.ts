import { describe, expect, it, vi } from "vitest";
import { loadLiveDemo } from "@/lib/live/demos";
import { textChatTools } from "@/lib/demo/site-chat/text-tools";
import { boardChatTools, createBoardMapPort } from "@/lib/demo/site-chat/board-map";
import { runSiteChat, ChatBackendError } from "@/lib/demo/site-chat/backend";
import { leangenbuktaSourceRegistry } from "@/lib/demo/leangenbukta-chat/sources";
import { nyhavnaSourceRegistry } from "@/lib/demo/nyhavna-chat/sources";
import registryFile from "@/data/demo/leangenbukta-lokal/sources.json";

const sourceRegistry = leangenbuktaSourceRegistry();
const knownSourceIds = new Set(registryFile.map((source) => source.id));

/**
 * Verifiserer at tekstchattens Responses-løkke faktisk kjører gjennom det
 * ekte Leangenbukta-datasettet (`loadLiveDemo`) — ikke en syntetisk fixture —
 * slik at et regresjon i toolset eller instruksjoner fanges her også.
 */

function responsesPayload(output: unknown, usage = { input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 0 } }) {
  return { ok: true, json: async () => ({ status: "completed", output, usage }) };
}

function functionCall(callId: string, name: string, args: Record<string, unknown>) {
  return { type: "function_call", call_id: callId, name, arguments: JSON.stringify(args) };
}

function finalMessage(reply: string, answerType: string, linkIds: string[] = [], sourceIds: string[] = []) {
  return { type: "message", content: [{ type: "output_text", text: JSON.stringify({ reply, answer_type: answerType, link_ids: linkIds, source_ids: sourceIds }) }] };
}

describe("leangenbukta-chat/backend — mot det ekte leangenbukta-lokal-datasettet", () => {
  it("kjører verktøyløkken via find_project_info og leverer et faktasvar med bevis", async () => {
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const conversation = demo.createConversation();
    const tools = textChatTools(demo.tools);

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        responsesPayload([functionCall("call_1", "find_project_info", { query: "treningsrom Knutepunktet", theme_id: "leangenbukta-prosjektet" })]),
      )
      .mockResolvedValueOnce(responsesPayload([finalMessage("Treningsrommet i Knutepunktet er planlagt, men ikke bekreftet ferdig.", "fact", ["board"])]));

    const result = await runSiteChat({
      apiKey: "test-key",
      sourceRegistry,
      model: "gpt-5.6-terra",
      effort: "low",
      instructions: "instruks",
      tools,
      parallelToolCalls: false,
      conversation,
      previousTurns: [],
      userText: "Er treningsrommet i Knutepunktet ferdig?",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.answerType).toBe("fact");
    expect(result.evidence.map((e) => e.tool)).toEqual(["find_project_info"]);
    expect(result.linkIds).toEqual(["board"]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("kjører aldri et verktøy som ikke er i tekstchattens verktøyliste", async () => {
    // Modellen kan finne på et navn fra instruksen (f.eks. kartverktøyet
    // `show_category`); bare verktøy tekstchatten faktisk tilbyr får kjøre.
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const conversation = demo.createConversation();
    const execute = vi.spyOn(conversation, "execute");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(responsesPayload([functionCall("call_1", "show_category", { category_id: "hverdag" })]))
      .mockResolvedValueOnce(responsesPayload([finalMessage("Her er hverdagstilbudet.", "smalltalk")]));
    await runSiteChat({
      apiKey: "test-key",
      sourceRegistry,
      model: "gpt-5.6-terra",
      effort: "low",
      instructions: "instruks",
      tools: textChatTools(demo.tools),
      parallelToolCalls: false,
      conversation,
      previousTurns: [],
      userText: "Vis hverdag",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(execute).not.toHaveBeenCalled();
    const second = JSON.parse(fetchImpl.mock.calls[1][1].body as string);
    const output = second.input.find((item: { type: string }) => item.type === "function_call_output");
    expect(JSON.parse(output.output)).toEqual({ error: expect.stringContaining("show_category") });
  });

  it("sender reasoning-effort og ber om kryptert resonnement for gpt-6-modeller, og sender resonnementet tilbake", async () => {
    // `PLACY_LB_CHAT_MODEL=gpt-6-sol` skal ikke miste resonnementet mellom
    // verktøyrundene: med `store: false` finnes det bare i forespørselen.
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const reasoningItem = { type: "reasoning", id: "rs_1", encrypted_content: "kryptert", summary: [] };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(responsesPayload([reasoningItem, functionCall("call_1", "get_board_facts", {})]))
      .mockResolvedValueOnce(responsesPayload([finalMessage("Leangenbukta er et boligprosjekt.", "fact")]));
    const result = await runSiteChat({
      apiKey: "test-key",
      sourceRegistry,
      model: "gpt-6-sol",
      effort: "none",
      instructions: "instruks",
      tools: textChatTools(demo.tools),
      parallelToolCalls: false,
      conversation: demo.createConversation(),
      previousTurns: [],
      userText: "Hva er Leangenbukta?",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const [first, second] = fetchImpl.mock.calls.map((call) => JSON.parse(call[1].body as string));
    expect(first).toMatchObject({ model: "gpt-6-sol", store: false, reasoning: { effort: "none" }, include: ["reasoning.encrypted_content"] });
    expect(second.input).toContainEqual(reasoningItem);
    expect(result.roundMs).toHaveLength(2);
  });

  it("teller ikke et verktøykall uten treff som bevis", async () => {
    // AE5/R9: «ingen kildebelagt omtale» fra verktøyet er fravær av bevis, ikke bevis.
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(responsesPayload([functionCall("call_1", "find_project_info", { query: "helikopterlandingsplass på taket" })]))
      .mockResolvedValueOnce(responsesPayload([finalMessage("Ja, det finnes en helikopterlandingsplass.", "fact")]));
    const result = await runSiteChat({
      apiKey: "test-key",
      sourceRegistry,
      model: "gpt-5.6-terra",
      effort: "low",
      instructions: "instruks",
      tools: textChatTools(demo.tools),
      parallelToolCalls: false,
      conversation: demo.createConversation(),
      previousTurns: [],
      userText: "Er det helikopterlandingsplass på taket?",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.evidence).toEqual([]);
  });

  it("gir gap uten verktøybevis når modellen påstår fact uten å ha kalt noe verktøy", async () => {
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const conversation = demo.createConversation();
    const tools = textChatTools(demo.tools);
    const fetchImpl = vi.fn().mockResolvedValueOnce(responsesPayload([finalMessage("Ja, det er åpent for alle nå.", "fact")]));

    const result = await runSiteChat({
      apiKey: "test-key", sourceRegistry, model: "gpt-5.6-terra", effort: "low", instructions: "instruks", tools,
      parallelToolCalls: false, conversation, previousTurns: [], userText: "Er treningsrommet åpent?",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    // `runSiteChat` selv rapporterer bare bevisgrunnlaget; erstatningen
    // med det faste kunnskapshull-svaret skjer i ruta (AE5), ikke her.
    expect(result.answerType).toBe("fact");
    expect(result.evidence).toEqual([]);
  });

  it("kaster ChatBackendError ved leverandørfeil (502-grunnlag)", async () => {
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const conversation = demo.createConversation();
    const tools = textChatTools(demo.tools);
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: { message: "boom" } }) });

    await expect(
      runSiteChat({
        apiKey: "test-key", sourceRegistry, model: "gpt-5.6-terra", effort: "low", instructions: "instruks", tools,
        parallelToolCalls: false, conversation, previousTurns: [], userText: "Hei", fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(ChatBackendError);
  });

  it("kaster ved tidsavbrudd uten å lekke leverandørens feiltekst", async () => {
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const conversation = demo.createConversation();
    const tools = textChatTools(demo.tools);
    const fetchImpl = vi.fn().mockImplementation((_url: string, init: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const promise = runSiteChat({
      apiKey: "test-key", sourceRegistry, model: "gpt-5.6-terra", effort: "low", instructions: "instruks", tools,
      parallelToolCalls: false, conversation, previousTurns: [], userText: "Hei",
      fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 5,
    });
    await expect(promise).rejects.toMatchObject({ kind: "timeout" });
  });

  it("kaster invalid_output ved uventet modellsvar (ikke JSON etter skjema)", async () => {
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const conversation = demo.createConversation();
    const tools = textChatTools(demo.tools);
    const fetchImpl = vi.fn().mockResolvedValueOnce(responsesPayload([{ type: "message", content: [{ type: "output_text", text: "ikke json" }] }]));

    await expect(
      runSiteChat({
        apiKey: "test-key", sourceRegistry, model: "gpt-5.6-terra", effort: "low", instructions: "instruks", tools,
        parallelToolCalls: false, conversation, previousTurns: [], userText: "Hei", fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ kind: "invalid_output" });
  });

  it("gir opp med invalid_output når rundetaket nås uten sluttsvar", async () => {
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const conversation = demo.createConversation();
    const tools = textChatTools(demo.tools);
    const fetchImpl = vi.fn().mockResolvedValue(responsesPayload([functionCall("call_x", "get_board_facts", {})]));

    await expect(
      runSiteChat({
        apiKey: "test-key", sourceRegistry, model: "gpt-5.6-terra", effort: "low", instructions: "instruks", tools,
        parallelToolCalls: false, conversation, previousTurns: [], userText: "Hei", maxRounds: 2,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ kind: "invalid_output" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("leangenbukta-chat/backend — kildebevis fra verktøysvarene i denne meldingen", () => {
  async function knutepunktetTurn(final: ReturnType<typeof finalMessage>) {
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(responsesPayload([functionCall("call_1", "find_project_info", { query: "innflytting Knutepunktet", theme_id: "leangenbukta-prosjektet" })]))
      .mockResolvedValueOnce(responsesPayload([final]));
    const result = await runSiteChat({
      apiKey: "test-key", sourceRegistry, model: "gpt-5.6-terra", effort: "low", instructions: "instruks",
      tools: textChatTools(demo.tools), parallelToolCalls: false, conversation: demo.createConversation(),
      previousTurns: [], userText: "Når kan man flytte inn i Knutepunktet?", fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    return { result, fetchImpl };
  }

  it("utleder kilde-ID-er fra verktøysvaret og bare ID-er som finnes i kilderegisteret", async () => {
    const { result } = await knutepunktetTurn(finalMessage("Knutepunktet har forventet innflytting siste kvartal 2026.", "fact"));
    const ids = result.evidence.flatMap((e) => e.ids);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(knownSourceIds.has(id)).toBe(true);
  });

  it("gir modellen kilde-ID-en ved siden av kilde-URL-en i find_project_info, så den kan sitere den", async () => {
    const { fetchImpl, result } = await knutepunktetTurn(finalMessage("Ok.", "fact"));
    const second = JSON.parse(fetchImpl.mock.calls[1][1].body as string);
    const output = JSON.parse(second.input.find((item: { type: string }) => item.type === "function_call_output").output);
    const cited = output.results.map((r: { source: { source_id?: string } }) => r.source.source_id).filter(Boolean);
    expect(cited.length).toBeGreaterThan(0);
    expect(cited.every((id: string) => result.evidence.some((e) => e.ids.includes(id)))).toBe(true);
  });

  it("slipper bare siterte ID-er som faktisk kom fra verktøyene — oppdiktede og ikke-hentede registerkilder faller bort", async () => {
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const probe = await demo.createConversation().execute("find_project_info", { query: "innflytting Knutepunktet", theme_id: "leangenbukta-prosjektet" });
    const url = (probe.result as { results: Array<{ source: { url: string } }> }).results[0].source.url;
    const returned = registryFile.find((source) => source.url === url)!.id;
    const notReturned = "citylade-6434272b";
    const { result } = await knutepunktetTurn(
      finalMessage("Forventet siste kvartal 2026.", "fact", [], [returned, "kotengjenssen-godkjent-2026", notReturned]),
    );
    expect(result.sources.map((source) => source.id)).toEqual([returned]);
    expect(result.sources[0].label).toBe(registryFile.find((source) => source.id === returned)!.label);
  });

  it("markerer et årstall i svaret som verken verktøyene eller kildene bekrefter (2008-premisset)", async () => {
    const { result } = await knutepunktetTurn(finalMessage("Ja, innflyttingen var i 2008, og neste etappe kommer i 2026.", "fact"));
    expect(result.unsupportedYears).toEqual(["2008"]);
  });

  it("lar ikke et ekko av brukerens årstall i set_interests bli årstallsbevis", async () => {
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(responsesPayload([functionCall("call_1", "set_interests", { interests: ["innflytting i 2008"] })]))
      .mockResolvedValueOnce(responsesPayload([finalMessage("Innflyttingen var i 2008.", "fact")]));
    const result = await runSiteChat({
      apiKey: "test-key", sourceRegistry, model: "gpt-5.6-terra", effort: "low", instructions: "instruks",
      tools: textChatTools(demo.tools), parallelToolCalls: false, conversation: demo.createConversation(),
      previousTurns: [], userText: "Var innflyttingen i 2008?", fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.evidence.map((item) => item.tool)).toContain("set_interests");
    expect(result.unsupportedYears).toEqual(["2008"]);
  });

  it("teller ikke kildens kontrolldato som støtte for et årstall om stedet", async () => {
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(responsesPayload([functionCall("call_1", "get_place_facts", { poi_id: "ladetorget" })]))
      .mockResolvedValueOnce(responsesPayload([finalMessage("LadeTorget åpnet i 2026.", "fact", [], ["ladetorget-15d604f6"])]));
    const result = await runSiteChat({
      apiKey: "test-key", sourceRegistry, model: "gpt-5.6-terra", effort: "low", instructions: "instruks",
      tools: textChatTools(demo.tools), parallelToolCalls: false, conversation: demo.createConversation(),
      previousTurns: [], userText: "Når åpnet LadeTorget?", fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    // Kilden er likevel gyldig bevis for selve stedet (fra `sources`-lista i get_place_facts).
    expect(result.sources.map((source) => source.id)).toEqual(["ladetorget-15d604f6"]);
    expect(result.unsupportedYears).toEqual(["2026"]);
  });

  it("markerer usikkert prosjektgrunnlag når verktøyet selv sier uavklart/forventet", async () => {
    const { result } = await knutepunktetTurn(finalMessage("Forventet siste kvartal 2026.", "fact"));
    expect(result.provisional).toBe(true);
  });
});

describe("Boardets agentmodus «Spør Anja» — boardMap-porten i backend-løkka (U4, 2026-09-25)", () => {
  it("validerer et direkte kartverktøykall mot Boardets EGNE data: gyldige ID-er blir et direktiv, ukjente blir en feilmelding til modellen uten direktiv", async () => {
    const demo = await loadLiveDemo("nyhavna-lokal");
    const conversation = demo.createConversation();
    const boardMap = createBoardMapPort(demo.board);
    const realPoiId = demo.board.categories[0].pois[0].id;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        responsesPayload([functionCall("call_1", "highlight_places", { poi_ids: [realPoiId, "finnes-ikke"] })]),
      )
      .mockResolvedValueOnce(responsesPayload([finalMessage("Her er stedet.", "smalltalk")]));

    const result = await runSiteChat({
      apiKey: "test-key", sourceRegistry: nyhavnaSourceRegistry(), model: "gpt-5.6-terra", effort: "low",
      instructions: "instruks", tools: boardChatTools(demo.tools), parallelToolCalls: false, conversation,
      previousTurns: [], userText: "Vis meg stedet", boardMap, fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.directives).toEqual([{ name: "highlight_places", args: { poi_ids: [realPoiId] } }]);
    // Verktøysvaret til MODELLEN viser den ukjente ID-en som avvist, ikke som utført.
    const second = JSON.parse(fetchImpl.mock.calls[1][1].body as string);
    const output = JSON.parse(second.input.find((item: { type: string }) => item.type === "function_call_output").output);
    expect(output.rejected).toEqual(["finnes-ikke"]);
    // Verktøykallet gikk til PORTEN, ikke til samtalen (som ikke har noe kart å style).
    expect(result.evidence).toEqual([]);
  });

  it("avviser hele kallet, uten direktiv, når INGEN av ID-ene finnes", async () => {
    const demo = await loadLiveDemo("nyhavna-lokal");
    const boardMap = createBoardMapPort(demo.board);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(responsesPayload([functionCall("call_1", "highlight_places", { poi_ids: ["finnes-ikke-1", "finnes-ikke-2"] })]))
      .mockResolvedValueOnce(responsesPayload([finalMessage("Beklager, fant ikke stedet.", "gap")]));
    const result = await runSiteChat({
      apiKey: "test-key", sourceRegistry: nyhavnaSourceRegistry(), model: "gpt-5.6-terra", effort: "low",
      instructions: "instruks", tools: boardChatTools(demo.tools), parallelToolCalls: false, conversation: demo.createConversation(),
      previousTurns: [], userText: "Vis meg noe som ikke finnes", boardMap, fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.directives).toEqual([]);
  });

  it("samler direktiver fra samtalens EGNE kartkommandoer (f.eks. open_theme) gjennom samme validering", async () => {
    const demo = await loadLiveDemo("nyhavna-lokal");
    const conversation = demo.createConversation();
    const boardMap = createBoardMapPort(demo.board);
    // Prober det ekte direktivet open_theme selv produserer, slik andre tester i
    // denne fila prober ekte fakta-ID-er — ingen syntetisk fixture.
    const probe = await demo.createConversation().execute("open_theme", { theme_id: "barn-oppvekst" });
    const expectedDirectives = probe.directives ?? [];
    expect(expectedDirectives.length).toBeGreaterThan(0);

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(responsesPayload([functionCall("call_1", "open_theme", { theme_id: "barn-oppvekst" })]))
      .mockResolvedValueOnce(responsesPayload([finalMessage("Her er oppvekst-temaet.", "smalltalk")]));

    const result = await runSiteChat({
      apiKey: "test-key", sourceRegistry: nyhavnaSourceRegistry(), model: "gpt-5.6-terra", effort: "low",
      instructions: "instruks", tools: boardChatTools(demo.tools), parallelToolCalls: false, conversation,
      previousTurns: [], userText: "Fortell om oppvekst", boardMap, fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.directives).toEqual(expectedDirectives);
  });

  it("avduplisert og klippet til BOARD_DIRECTIVE_MAX, i den rekkefølgen verktøyene ble kalt", async () => {
    const demo = await loadLiveDemo("nyhavna-lokal");
    const boardMap = createBoardMapPort(demo.board);
    const poiA = demo.board.categories[0].pois[0].id;
    const poiB = demo.board.categories[1].pois[0].id;
    const poiX = demo.board.categories[2].pois[0].id;
    const categoryY = String(demo.board.categories[3].id);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        responsesPayload([
          functionCall("call_1", "highlight_places", { poi_ids: [poiA] }),
          functionCall("call_2", "highlight_places", { poi_ids: [poiB] }),
          functionCall("call_3", "show_place", { poi_id: poiX }),
          functionCall("call_4", "show_category", { category_id: categoryY }),
          functionCall("call_5", "clear_highlights", {}),
          functionCall("call_6", "highlight_places", { poi_ids: [poiA] }), // duplikat av call_1
        ]),
      )
      .mockResolvedValueOnce(responsesPayload([finalMessage("Ok.", "smalltalk")]));

    const result = await runSiteChat({
      apiKey: "test-key", sourceRegistry: nyhavnaSourceRegistry(), model: "gpt-5.6-terra", effort: "low",
      instructions: "instruks", tools: boardChatTools(demo.tools), parallelToolCalls: true, conversation: demo.createConversation(),
      previousTurns: [], userText: "Vis meg flere steder", boardMap, fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    // Høyst 4 (BOARD_DIRECTIVE_MAX), i kallrekkefølgen: clear_highlights (call_5)
    // klippes bort som femte, og duplikatet (call_6) telles ikke uansett.
    expect(result.directives).toEqual([
      { name: "highlight_places", args: { poi_ids: [poiA] } },
      { name: "highlight_places", args: { poi_ids: [poiB] } },
      { name: "show_place", args: { poi_id: poiX } },
      { name: "show_category", args: { category_id: categoryY } },
    ]);
  });

  it("uten boardMap-porten: nøyaktig dagens atferd — directives alltid tom, selv om et kartverktøy-NAVN skulle dukke opp", async () => {
    const demo = await loadLiveDemo("nyhavna-lokal");
    const conversation = demo.createConversation();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(responsesPayload([functionCall("call_1", "get_board_facts", {})]))
      .mockResolvedValueOnce(responsesPayload([finalMessage("Nyhavna er en bydel under utvikling.", "fact")]));
    const result = await runSiteChat({
      apiKey: "test-key", sourceRegistry: nyhavnaSourceRegistry(), model: "gpt-5.6-terra", effort: "low",
      instructions: "instruks", tools: textChatTools(demo.tools), parallelToolCalls: false, conversation,
      previousTurns: [], userText: "Fortell om Nyhavna", fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.directives).toEqual([]);
  });
});

describe("leangenbukta-chat — paritet mellom tekst og tale (samme verktøyimplementasjon)", () => {
  it("Knutepunktets treningsrom: samme fakta-ID og status uansett hvilken samtaleinstans som spør", async () => {
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const voiceConversation = demo.createConversation();
    const textConversation = demo.createConversation();
    const args = { query: "treningsrom Knutepunktet", theme_id: "leangenbukta-prosjektet" };

    const voiceOutcome = await voiceConversation.execute("find_project_info", args);
    const textOutcome = await textConversation.execute("find_project_info", args);

    const voiceResults = (voiceOutcome.result as { results: Array<{ id: string; status: string }> }).results;
    const textResults = (textOutcome.result as { results: Array<{ id: string; status: string }> }).results;
    expect(voiceResults.map((r) => r.id)).toEqual(textResults.map((r) => r.id));
    expect(voiceResults.map((r) => r.status)).toEqual(textResults.map((r) => r.status));
    expect(voiceResults.some((r) => r.id === "project-leangenbukta-lounge" && r.status === "planlagt, åpning ikke oppgitt")).toBe(true);
  });

  it("Parktunet 1: samme fakta-ID og status uansett hvilken samtaleinstans som spør", async () => {
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const voiceConversation = demo.createConversation();
    const textConversation = demo.createConversation();
    const args = { query: "Parktunet 1 ferdigstillelse", theme_id: "leangenbukta-prosjektet" };

    const voiceOutcome = await voiceConversation.execute("find_project_info", args);
    const textOutcome = await textConversation.execute("find_project_info", args);

    const voiceResults = (voiceOutcome.result as { results: Array<{ id: string; status: string }> }).results;
    const textResults = (textOutcome.result as { results: Array<{ id: string; status: string }> }).results;
    expect(voiceResults.map((r) => r.id)).toEqual(textResults.map((r) => r.id));
    expect(voiceResults.some((r) => r.id === "project-leangenbukta-parktunet-1-d" && r.status === "planlagt, åpning forventet")).toBe(true);
  });
});
