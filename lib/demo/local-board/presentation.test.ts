import { describe, expect, it } from "vitest";
import { loadDataset } from "@/lib/demo/local-board/dataset";
import { buildLocalBoard } from "@/lib/demo/local-board/board";
import { buildVoiceDeps } from "@/lib/demo/local-board/voice";
import { createNyhavnaConversation } from "@/lib/realtime/nyhavna-conversation";
import { createPresentation } from "@/lib/demo/local-board/presentation";

import { getLocalDemo } from "@/lib/demo/local-board/registry";

const NYHAVNA = getLocalDemo("nyhavna-lokal");

async function fixture() {
  const dataset = await loadDataset(NYHAVNA);
  const board = buildLocalBoard(dataset, NYHAVNA);
  return createPresentation(createNyhavnaConversation(board, buildVoiceDeps(dataset)), { segments: dataset.board.presentation ?? [], places: dataset.places, center: dataset.board.center, categories: dataset.board.categories, homeName: dataset.board.name, discoveryCategoryIds: dataset.board.discoveryCategoryIds });
}

describe("guided local presentation", () => {
  it("blir i valgt tema og gir delområder en egen oppfølging", async () => {
    const tour = await fixture();
    const result = tour.execute("present_neighbourhood", { action: "category", category_id: "barn-oppvekst" }).result as { invitation: string };
    expect(result.invitation).not.toContain("natur");
    expect(result.invitation).toContain("dette temaet");
    const area = tour.onMapSelection("place", "transittkaia")!;
    expect(area.commentary).toContain("delområde");
    expect(area.commentary).not.toContain("lignende steder");
    expect(tour.onMapSelection("place", "meny-solsiden")!.commentary).not.toContain("demoens");
  });

  it("starts with everyday life, activates its category and highlights only its narrative places", async () => {
    const tour = await fixture();
    const result = tour.execute("present_neighbourhood", { action: "next" });
    expect(result.result).toMatchObject({ segment: { categoryId: "hverdagsliv" } });
    expect(result.result).toHaveProperty("chapter.project_info");
    expect(result.directives?.[0]).toEqual({ name: "show_category", args: { category_id: "hverdagsliv" } });
    expect(result.directives?.[1]).toMatchObject({ name: "highlight_places", args: { poi_ids: ["solsiden-senter", "kiwi-lilleby"] } });
  });
  it("keeps the return point through a question and resumes without advancing", async () => {
    const tour = await fixture();
    const first = tour.execute("present_neighbourhood", { action: "next" });
    tour.execute("find_project_info", { query: "Lilleby skole" });
    expect(tour.execute("present_neighbourhood", { action: "resume" }).result).toMatchObject({ segment: (first.result as { segment: unknown }).segment });
    expect(tour.execute("present_neighbourhood", { action: "next" }).result).toMatchObject({ segment: { categoryId: "transport" } });
  });
  it("validates actions and category jumps without losing the current position", async () => {
    const tour = await fixture();
    tour.execute("present_neighbourhood", { action: "category", category_id: "mat-drikke" });
    expect(tour.execute("present_neighbourhood", { action: "category", category_id: "missing" }).result).toHaveProperty("error");
    expect(tour.execute("present_neighbourhood", { action: "invalid" }).result).toHaveProperty("error");
    expect(tour.execute("present_neighbourhood", { action: "resume" }).result).toMatchObject({ segment: { categoryId: "mat-drikke" } });
  });
  it("category clicks use the same script and position as voice navigation", async () => {
    const tour = await fixture();
    const clicked = tour.onMapSelection("theme", "transport");
    expect(clicked?.commentary).toContain("Losgata");
    expect(clicked?.directives[0]).toMatchObject({ name: "show_category", args: { category_id: "transport" } });
    expect(tour.execute("present_neighbourhood", { action: "resume" }).result).toMatchObject({ segment: { categoryId: "transport" } });
  });
  it("keeps a clicked restaurant isolated and preserves the presentation return point", async () => {
    const tour = await fixture();
    tour.execute("present_neighbourhood", { action: "category", category_id: "mat-drikke" });
    const clicked = tour.onMapSelection("place", "ladejarlen");
    expect(clicked?.commentary).toContain("Ladejarlen");
    expect(clicked?.commentary).toContain("Vil du høre om lignende steder i nærheten?");
    expect(clicked?.commentary).not.toMatch(/Dora|Snurr|Ikke still spørsmål tilbake/);
    expect(clicked?.directives).toEqual([]);
    expect(tour.onMapSelection("place", "unknown-place")).toBeNull();
    expect(tour.execute("present_neighbourhood", { action: "resume" }).result).toMatchObject({ segment: { categoryId: "mat-drikke" } });
  });
  it("takes Dora directly to Snurr, stays in servering, then stops when alternatives are exhausted", async () => {
    const tour = await fixture();
    tour.execute("present_neighbourhood", { action: "category", category_id: "mat-drikke" });
    const clicked = tour.onMapSelection("place", "dora-kaffebar");
    expect(clicked?.commentary).toContain("Dora Kaffebar");
    expect(clicked?.commentary).not.toMatch(/Bistro|Snurr|Ladejarlen/);
    const found = tour.execute("find_similar_places", {});
    expect(found.result).toMatchObject({ matches: 1, place: { id: "snurr-nyhavna", categoryId: "mat-drikke" } });
    expect(found.directives).toContainEqual({ name: "show_place", args: { poi_id: "snurr-nyhavna" } });
    const bakery = tour.execute("find_similar_places", {});
    expect(bakery.result).toMatchObject({
      matches: 1, place: { id: "godt-brod-solsiden", categoryId: "mat-drikke", map_poi_id: "solsiden-senter" },
    });
    expect(bakery.directives).toContainEqual({ name: "show_place", args: { poi_id: "solsiden-senter" } });
    expect(bakery.directives).toContainEqual({ name: "highlight_places", args: { poi_ids: ["solsiden-senter"] } });
    for (const id of ["cafe-lokka", "dromedar-solsiden"]) {
      expect(tour.execute("find_similar_places", {}).result).toMatchObject({
        matches: 1, place: { id, categoryId: "mat-drikke" },
      });
    }
    const extraNames: string[] = [];
    for (let i = 0; i < 10; i++) {
      const next = tour.execute("find_similar_places", {}).result as { matches: number; place?: { name: string; categoryId: string } };
      if (!next.matches) break;
      expect(next.place?.categoryId).toBe("mat-drikke");
      extraNames.push(next.place!.name);
    }
    expect(new Set(extraNames)).toEqual(new Set(["Rosenborg Bakeri City Lade", "Jordbærpikene Trondheim Torg", "Dromedar Sirkus Shopping"]));
    expect(extraNames).toHaveLength(3);
    expect(tour.execute("find_similar_places", {}).result).toMatchObject({ matches: 0 });
    expect(tour.execute("present_neighbourhood", { action: "resume" }).result).toMatchObject({ segment: { categoryId: "mat-drikke" } });
    expect(tour.execute("find_similar_places", { poi_id: "unknown-place" }).result).toHaveProperty("error");
  });
  it("ends without looping, and a new session starts fresh", async () => {
    const tour = await fixture();
    const dataset = await loadDataset(NYHAVNA);
    for (let i = 0; i < (dataset.board.presentation?.length ?? 0); i++) tour.execute("present_neighbourhood", { action: "next" });
    expect(tour.execute("present_neighbourhood", { action: "next" }).result).toMatchObject({ done: true });
    expect((await fixture()).execute("present_neighbourhood", { action: "next" }).result).toMatchObject({ segment: { categoryId: "hverdagsliv" } });
  });
});
