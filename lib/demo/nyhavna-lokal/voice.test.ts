import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildLocalBoard } from "@/lib/demo/nyhavna-lokal/board";
import { LOCAL_DATASET_DIR } from "@/lib/demo/nyhavna-lokal/dataset";
import { buildVoiceDeps, LOCAL_DEMO_INSTRUCTION } from "@/lib/demo/nyhavna-lokal/voice";
import {
  localBoardSchema,
  localPlacesSchema,
  localSourcesSchema,
  localTopicsSchema,
  type LocalDataset,
} from "@/lib/demo/nyhavna-lokal/schema";
import { createNyhavnaConversation } from "@/lib/realtime/nyhavna-conversation";
import { nyhavnaInstructions } from "@/lib/realtime/nyhavna-knowledge";

/**
 * Stemmens grunnlag skal være DATASETTET, og ingenting annet.
 *
 * Den dyre feilen er ikke at guiden mangler et svar — det er at den har et svar
 * den har arvet fra den andre demoen, eller funnet på. Testene under holder
 * begge dørene lukket: ingen navn fra `lib/demo/nyhavna-leve/` slipper gjennom,
 * og et tomt datasett gir tomme verktøysvar med en beskjed om å si fra.
 */

/** Navn og ID-er som BARE finnes i den andre demoens kuraterte innhold. */
const LEVE_ONLY = [
  "Dora Kaffebar",
  "Monkey Brew",
  "Elvepromenaden",
  "Kulturaksen",
  "Fyringsbunkeren",
  "Bunkerparken",
  "leve-dora-kaffebar",
  "leve-monkey-brew",
  "leve-elvepromenaden",
];

async function realBoard() {
  return localBoardSchema.parse(JSON.parse(await readFile(join(LOCAL_DATASET_DIR, "board.json"), "utf8")));
}

const emptyDataset = async (): Promise<LocalDataset> => ({
  board: await realBoard(),
  sources: [],
  places: [],
  topics: [],
});

const conversationFor = (dataset: LocalDataset) =>
  createNyhavnaConversation(buildLocalBoard(dataset), buildVoiceDeps(dataset));

const result = (dataset: LocalDataset, name: string, args: Record<string, unknown> = {}) =>
  conversationFor(dataset).execute(name, args).result as Record<string, unknown>;

describe("tomt datagrunnlag", () => {
  it("finner ingen steder, uansett hva det spørres om", async () => {
    const dataset = await emptyDataset();
    for (const query of ["kaffe", "park", "kultur", "barn", "Dora"]) {
      expect(result(dataset, "find_places", { query })).toMatchObject({ matches: 0, places: [] });
    }
  });

  it("avviser et oppslag på den andre demoens kart-ID-er", async () => {
    const dataset = await emptyDataset();
    for (const id of ["leve-dora-kaffebar", "google-ChIJkSttw-sxbUYRAanGtarSMo0"]) {
      expect(result(dataset, "get_place_facts", { poi_id: id })).toHaveProperty("error");
    }
  });

  it("har ingen fakta og ingen kilder om området", async () => {
    const facts = result(await emptyDataset(), "get_board_facts");
    expect(facts.facts).toEqual([]);
    expect(facts.sources).toEqual([]);
    // Temaene er der: rammen finnes, innholdet ikke.
    expect((facts.categories as unknown[]).length).toBeGreaterThan(0);
  });

  it("åpner et tema uten steder, uten omtaler og uten kartdirektiv", async () => {
    const dataset = await emptyDataset();
    const outcome = conversationFor(dataset).execute("open_theme", { theme_id: "mat-drikke" });
    const chapter = (outcome.result as { chapter: Record<string, unknown> }).chapter;
    expect(chapter.places).toEqual([]);
    expect(chapter.curated).toEqual([]);
    expect(chapter.project_info).toEqual([]);
    expect(chapter.place_count).toBe(0);
    expect(outcome.directives ?? []).toEqual([]);
  });

  it("ber guiden si fra i stedet for å gjette når temakunnskapen mangler", async () => {
    const info = result(await emptyDataset(), "find_project_info", { query: "kaffe og spisesteder" });
    expect(info.matches).toBe(0);
    expect(String(info.note)).toMatch(/ikke .*grunnlag|uten å gjette/i);
  });

  it("gir en instruksjon uten ett eneste navn fra den andre demoen", async () => {
    const dataset = await emptyDataset();
    const board = buildLocalBoard(dataset);
    const instructions = `${nyhavnaInstructions(board, { projectInfoLabel: dataset.board.projectInfoLabel })}\n${LOCAL_DEMO_INSTRUCTION}`;
    for (const name of LEVE_ONLY) expect(instructions).not.toContain(name);
    // Ingen arvet spørsmålskatalog: seksjonen er der, men tom.
    expect(instructions).toMatch(/SPØRSMÅL OG SVAR \(data, per tema\):\n\n/);
    // …men regelen om å si fra i stedet for å gjette står der.
    expect(instructions).toContain("Ikke fyll hullet med generell kunnskap");
  });
});

describe("innhold som er lagt inn", () => {
  const sources = localSourcesSchema.parse([
    { id: "kilde-a", label: "eksempel.no", page: "Side", url: "https://eksempel.no/side/", publisher: "Eksempel", checkedAt: "2026-09-13" },
  ]);
  const places = localPlacesSchema.parse([
    {
      id: "test-sted",
      name: "Test Sted",
      categoryId: "mat-drikke",
      coordinates: { lat: 63.44, lng: 10.42 },
      aliases: ["Testen"],
      summary: "Et sted lagt inn for å kontrollere stemmen.",
      travelTime: { walk: 4 },
      facts: [
        { id: "f1", text: "Test Sted serverer kaffe.", sourceId: "kilde-a", checkedAt: "2026-09-13" },
        { id: "f2", text: "Åpningstider er ikke oppgitt i kilden.", sourceId: "kilde-a", checkedAt: "2026-09-13", verification: "unresolved" },
      ],
      sourceIds: ["kilde-a"],
      checkedAt: "2026-09-13",
      caveats: ["Prisnivå er ikke kontrollert."],
    },
  ]);
  const topics = localTopicsSchema.parse([
    {
      id: "tema-servering",
      title: "Servering i området",
      categoryIds: ["mat-drikke"],
      status: "planned",
      text: "Flere spisesteder er planlagt.",
      keywords: ["servering", "spisested"],
      sourceIds: ["kilde-a"],
      checkedAt: "2026-09-13",
    },
  ]);

  const filled = async (): Promise<LocalDataset> => ({ ...(await emptyDataset()), sources, places, topics });

  it("finner stedet på navn, alias og tema", async () => {
    const dataset = await filled();
    for (const query of ["Test Sted", "Testen", "servering"]) {
      const found = result(dataset, "find_places", { query }) as { places: Array<{ name: string; map_poi_id: string }> };
      expect(found.places.map((p) => p.name)).toContain("Test Sted");
      expect(found.places[0].map_poi_id).toBe("test-sted");
    }
  });

  it("skiller bekreftede fakta fra forbehold", async () => {
    const facts = result(await filled(), "get_place_facts", { poi_id: "test-sted" }) as {
      facts: Array<{ text: string }>;
      uncertainties: string[];
      sources: Array<{ url: string }>;
    };
    expect(facts.facts.map((f) => f.text)).toEqual(["Test Sted serverer kaffe."]);
    expect(facts.uncertainties).toEqual(["Åpningstider er ikke oppgitt i kilden.", "Prisnivå er ikke kontrollert."]);
    expect(facts.sources[0].url).toBe("https://eksempel.no/side/");
  });

  it("fremhever stedet i kartet når temaet åpnes", async () => {
    const outcome = conversationFor(await filled()).execute("open_theme", { theme_id: "mat-drikke" });
    expect(outcome.directives).toEqual([{ name: "highlight_places", args: { poi_ids: ["test-sted"] } }]);
  });

  it("gjengir temakunnskapen med status og kilde", async () => {
    const info = result(await filled(), "find_project_info", { query: "spisested" }) as {
      matches: number;
      results: Array<{ status: string; source: { url: string } }>;
    };
    expect(info.matches).toBe(1);
    expect(info.results[0].status).toBe("planlagt");
    expect(info.results[0].source.url).toBe("https://eksempel.no/side/");
  });
});

describe("samtaleeksemplene", () => {
  it("kan ikke nå modellen: stemmemodulen leser dem ikke", async () => {
    const source = await readFile(join("lib", "demo", "nyhavna-lokal", "voice.ts"), "utf8");
    // Bare importene teller: doc-kommentaren NEVNER fila, med vilje.
    const imports = source.split("\n").filter((line) => line.startsWith("import"));
    expect(imports.join("\n")).not.toMatch(/dataset|loadConversations/);
    // …og de ligger heller ikke i noe stemmen faktisk får.
    const dataset = await emptyDataset();
    const example = JSON.parse(await readFile(join(LOCAL_DATASET_DIR, "eksempel.json"), "utf8"));
    const utterance: string = example.conversations[0].transcript[0].text;
    const board = buildLocalBoard(dataset);
    const payload = `${nyhavnaInstructions(board)}${LOCAL_DEMO_INSTRUCTION}${JSON.stringify(buildVoiceDeps(dataset).knowledge)}`;
    expect(payload).not.toContain(utterance);
  });
});
