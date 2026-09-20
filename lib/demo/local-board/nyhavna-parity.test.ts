import { describe, expect, it } from "vitest";

import { buildLocalBoard } from "@/lib/demo/local-board/board";
import { loadConversations, loadDataset } from "@/lib/demo/local-board/dataset";
import { getLocalDemo } from "@/lib/demo/local-board/registry";
import { buildLocalInstructions, buildVoiceDeps } from "@/lib/demo/local-board/voice";
import { buildProductionAssistantSource } from "@/lib/live/production-board";
import { createNyhavnaConversation } from "@/lib/realtime/nyhavna-conversation";

const DEMO = getLocalDemo("nyhavna-lokal");

describe("Nyhavna: migreringsbaseline for Anja", () => {
  it("har 43 versjonerte scenarioer fordelt på innhold, kart, transport og drift", async () => {
    const conversations = await loadConversations(DEMO);
    const questions = conversations.flatMap((conversation) => conversation.questions);

    expect(conversations).toHaveLength(8);
    expect(questions).toHaveLength(43);
    expect(new Set(questions.map((question) => question.id)).size).toBe(43);
    expect(questions.map((question) => question.id)).toEqual(
      expect.arrayContaining([
        "inngang-hilsen",
        "bydel-transittkaia",
        "oppvekst-skoler",
        "transport-sentrum-live",
        "trening-skjult-poi",
        "kart-flere-steder",
        "samtale-avbrudd",
        "drift-content-version",
        "drift-stemme",
      ]),
    );
  });

  it("dekker alle kuraterte FAQ-spørsmål ordrett i scenariobaseline", async () => {
    const dataset = await loadDataset(DEMO);
    const conversations = await loadConversations(DEMO);
    const scenarioQuestions = new Set(
      conversations.flatMap((conversation) => conversation.questions.map((question) => question.text)),
    );

    for (const faq of dataset.faqs) {
      expect(scenarioQuestions, faq.id).toContain(faq.question);
    }
  });

  it("holder scenarioene utenfor runtime-kunnskapen", async () => {
    const dataset = await loadDataset(DEMO);
    const board = buildLocalBoard(dataset, DEMO);
    const instructions = buildLocalInstructions(dataset, board);

    expect(dataset).not.toHaveProperty("conversations");
    expect(instructions).not.toContain("amerikansk aksentdrift");
    expect(instructions).not.toContain("drift-content-version");
  });

  it("bevarer fem delområder, kartverktøy og avbrudd/retur i dagens orakel", async () => {
    const dataset = await loadDataset(DEMO);
    const board = buildLocalBoard(dataset, DEMO);
    const conversation = createNyhavnaConversation(board, buildVoiceDeps(dataset));
    const chapter = conversation.execute("open_theme", { theme_id: "nyhavna-bydel" });
    const places = JSON.stringify(chapter.result);

    for (const id of [
      "transittkaia",
      "kullkranpiren",
      "strandveikaia",
      "ladehammerkaia",
      "bunkerkvartalet",
    ]) {
      expect(places).toContain(id);
    }

    conversation.execute("open_theme", { theme_id: "barn-oppvekst" });
    const detour = conversation.execute("note_detour", { about: "buss til sentrum" });
    const returned = conversation.execute("return_to_tour", {});
    expect(JSON.stringify(detour.result)).toContain("barn-oppvekst");
    expect(JSON.stringify(returned.result)).toContain("barn-oppvekst");
  });

  it("låser de viktigste Anja-kontraktene i kandidatens standardiserte runtime", async () => {
    const dataset = await loadDataset(DEMO);
    const visualBoard = buildLocalBoard(dataset, DEMO);
    const candidate = {
      ...visualBoard,
      contentVersion: "nyhavna-parity-v1",
      assistant: { enabled: true, name: "Anja", guided: true },
    };
    const source = buildProductionAssistantSource(candidate);
    const toolNames = source.tools.map((tool) => tool.name);

    expect(toolNames).toEqual(expect.arrayContaining([
      "highlight_places",
      "show_place",
      "get_place_address",
      "get_live_departures",
      "plan_live_transit_trip",
    ]));
    expect(source.backendInstructions).toContain("Adresse finnes ikke i normale modelldata");
    expect(source.backendInstructions).toContain("bare ved et uttrykkelig spørsmål om adresse");
    expect(source.backendInstructions).toContain("Avklar uklare mål som «byen»");
    expect(source.backendInstructions).toContain("Oppgi tidspunktet dataene ble hentet");
    expect(source.backendInstructions).toContain("si ærlig fra ved feil");
    expect(source.backendInstructions).toContain("Påstå aldri at noe er vist i kartet");
    expect(source.voiceInstructions).toContain("stopp når brukeren avbryter");

    const conversation = source.createConversation();
    expect(conversation.execute("show_place", { poi_id: "finnes-ikke" }).result)
      .toHaveProperty("error");
    expect(conversation.execute("get_place_address", {
      poi_id: "dora-kaffebar",
      purpose: "curiosity",
    }).result).toHaveProperty("error");
  });
});
