import { describe, expect, it, vi } from "vitest";
import { loadLiveDemo } from "@/lib/live/demos";
import { textChatTools } from "@/lib/demo/leangenbukta-chat/text-tools";
import { runLeangenbuktaChat, ChatBackendError } from "@/lib/demo/leangenbukta-chat/backend";
import { leangenbuktaSourceRegistry } from "@/lib/demo/leangenbukta-chat/sources";
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

    const result = await runLeangenbuktaChat({
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
    await runLeangenbuktaChat({
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

  it("teller ikke et verktøykall uten treff som bevis", async () => {
    // AE5/R9: «ingen kildebelagt omtale» fra verktøyet er fravær av bevis, ikke bevis.
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(responsesPayload([functionCall("call_1", "find_project_info", { query: "helikopterlandingsplass på taket" })]))
      .mockResolvedValueOnce(responsesPayload([finalMessage("Ja, det finnes en helikopterlandingsplass.", "fact")]));
    const result = await runLeangenbuktaChat({
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

    const result = await runLeangenbuktaChat({
      apiKey: "test-key", sourceRegistry, model: "gpt-5.6-terra", effort: "low", instructions: "instruks", tools,
      parallelToolCalls: false, conversation, previousTurns: [], userText: "Er treningsrommet åpent?",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    // `runLeangenbuktaChat` selv rapporterer bare bevisgrunnlaget; erstatningen
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
      runLeangenbuktaChat({
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

    const promise = runLeangenbuktaChat({
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
      runLeangenbuktaChat({
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
      runLeangenbuktaChat({
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
    const result = await runLeangenbuktaChat({
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
    const result = await runLeangenbuktaChat({
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
    const result = await runLeangenbuktaChat({
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
