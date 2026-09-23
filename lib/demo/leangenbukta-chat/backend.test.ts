import { describe, expect, it, vi } from "vitest";
import { loadLiveDemo } from "@/lib/live/demos";
import { textChatTools } from "@/lib/demo/leangenbukta-chat/text-tools";
import { runLeangenbuktaChat, ChatBackendError } from "@/lib/demo/leangenbukta-chat/backend";

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

function finalMessage(reply: string, answerType: string, linkIds: string[] = []) {
  return { type: "message", content: [{ type: "output_text", text: JSON.stringify({ reply, answer_type: answerType, link_ids: linkIds }) }] };
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
    expect(result.evidence).toEqual([{ tool: "find_project_info" }]);
    expect(result.linkIds).toEqual(["board"]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("gir gap uten verktøybevis når modellen påstår fact uten å ha kalt noe verktøy", async () => {
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const conversation = demo.createConversation();
    const tools = textChatTools(demo.tools);
    const fetchImpl = vi.fn().mockResolvedValueOnce(responsesPayload([finalMessage("Ja, det er åpent for alle nå.", "fact")]));

    const result = await runLeangenbuktaChat({
      apiKey: "test-key", model: "gpt-5.6-terra", effort: "low", instructions: "instruks", tools,
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
        apiKey: "test-key", model: "gpt-5.6-terra", effort: "low", instructions: "instruks", tools,
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
      apiKey: "test-key", model: "gpt-5.6-terra", effort: "low", instructions: "instruks", tools,
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
        apiKey: "test-key", model: "gpt-5.6-terra", effort: "low", instructions: "instruks", tools,
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
        apiKey: "test-key", model: "gpt-5.6-terra", effort: "low", instructions: "instruks", tools,
        parallelToolCalls: false, conversation, previousTurns: [], userText: "Hei", maxRounds: 2,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ kind: "invalid_output" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
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
