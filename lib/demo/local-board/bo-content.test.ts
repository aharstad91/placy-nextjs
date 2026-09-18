import { describe, expect, it } from "vitest";
import type { BoardPOIId } from "@/lib/board/board-types";
import { loadDataset } from "@/lib/demo/local-board/dataset";
import { buildLocalBoard } from "@/lib/demo/local-board/board";
import { buildLocalInstructions, buildVoiceDeps } from "@/lib/demo/local-board/voice";
import { createNyhavnaConversation } from "@/lib/realtime/nyhavna-conversation";
import { createPresentation } from "@/lib/demo/local-board/presentation";

import { getLocalDemo } from "@/lib/demo/local-board/registry";

const NYHAVNA = getLocalDemo("nyhavna-lokal");

const areaIds = ["transittkaia", "kullkranpiren", "strandveikaia", "ladehammerkaia", "bunkerkvartalet"];
describe("bo: framtidig bydel og dagens nærområde", () => {
  it("kobler alle fem kildebelagte delområder til planmarkører uten oppdiktet reisetid", async () => {
    const dataset = await loadDataset(NYHAVNA);
    const board = buildLocalBoard(dataset, NYHAVNA);
    const conversation = createNyhavnaConversation(board, buildVoiceDeps(dataset));
    const guide = createPresentation(conversation, { segments: dataset.board.presentation ?? [], places: dataset.places, categories: dataset.board.categories, homeName: dataset.board.name, discoveryCategoryIds: dataset.board.discoveryCategoryIds });
    for (const id of areaIds) {
      const place = dataset.places.find(p => p.id === id)!;
      expect(place).toMatchObject({ categoryId: "nyhavna-bydel", status: "planned", locationPrecision: "approximate" });
      expect(place.travelTime).toBeUndefined();
      expect(board.poisById.get(id as BoardPOIId)).toMatchObject({ developmentStatus: "planned" });
      const facts = conversation.execute("get_place_facts", { poi_id: id }).result as { facts: unknown[] };
      expect(facts.facts).toHaveLength(place.facts.length);
      const selection = guide.onMapSelection("place", id)!;
      expect(selection.commentary).toContain(place.name);
      expect(selection.commentary.length).toBeLessThan(1800);
      expect(selection.commentary).not.toMatch(/minutter å gå/);
    }
  });
  it("har to innganger og felleskontekst i stemmen, mens dagens steder beholdes", async () => {
    const dataset = await loadDataset(NYHAVNA);
    const board = buildLocalBoard(dataset, NYHAVNA);
    const common = dataset.topics.find(t => t.id === "bo-felleskontekst")!;
    expect(common.categoryIds).toEqual([]);
    expect(buildLocalInstructions(dataset, board)).toContain(common.text);
    const guide = createPresentation(createNyhavnaConversation(board, buildVoiceDeps(dataset)), { segments: dataset.board.presentation ?? [], places: dataset.places, categories: dataset.board.categories, homeName: dataset.board.name, discoveryCategoryIds: dataset.board.discoveryCategoryIds });
    expect(guide.execute("present_neighbourhood", { action: "category", category_id: "nyhavna-bydel" }).directives).toContainEqual({ name: "highlight_places", args: { poi_ids: areaIds } });
    expect(guide.execute("present_neighbourhood", { action: "category", category_id: "hverdagsliv" }).result).toMatchObject({ segment: { placeIds: ["meny-solsiden", "kiwi-lilleby"] } });
  });
});
