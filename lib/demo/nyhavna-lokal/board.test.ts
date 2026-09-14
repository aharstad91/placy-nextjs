import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildLocalBoard, buildLocalProject, datasetId } from "@/lib/demo/nyhavna-lokal/board";
import { loadDataset, LOCAL_DATASET_DIR } from "@/lib/demo/nyhavna-lokal/dataset";
import {
  localBoardSchema,
  localFaqsSchema,
  localPlacesSchema,
  localSourcesSchema,
  type LocalDataset,
} from "@/lib/demo/nyhavna-lokal/schema";

/**
 * Adapteren bærer demoens to løfter mot flaten: kategoriene overlever tomhet, og
 * et sted som legges inn havner i riktig tema med riktig markør.
 */

async function realBoard() {
  const board = localBoardSchema.parse(JSON.parse(await readFile(join(LOCAL_DATASET_DIR, "board.json"), "utf8")));
  return { ...board, presentation: [], categories: board.categories.map(c => ({ ...c, lead: "", body: "", sourceId: undefined })) };
}

const emptyDataset = async (): Promise<LocalDataset> => ({
  board: await realBoard(),
  sources: [],
  places: [],
  topics: [],
  faqs: [],
});

describe("tomt datasett", () => {
  it("beholder alle kategoriene, uten et eneste sted", async () => {
    const board = buildLocalBoard(await emptyDataset());
    const dataset = await emptyDataset();
    expect(board.categories.map((c) => String(c.id))).toEqual(dataset.board.categories.map((c) => c.id));
    expect(board.categories.every((c) => c.pois.length === 0)).toBe(true);
    expect(board.poisById.size).toBe(0);
  });

  it("lover ingenting boardet ikke har", async () => {
    const board = buildLocalBoard(await emptyDataset());
    expect(board.audioTourEnabled).toBe(false);
    expect(board.globalFaq).toEqual([]);
    expect(board.summary).toBeUndefined();
    expect(board.brokers).toBeUndefined();
    expect(board.isochrones).toBeUndefined();
    // Kategoriene har ingen kuratert detalj før datasettet bærer tekst.
    expect(board.categories.every((c) => c.editorial === undefined)).toBe(true);
  });

  it("slår på Satelitt og 3D når datasettet ber om det", async () => {
    const dataset = await emptyDataset();
    expect(buildLocalProject(dataset).has3dAddon).toBe(true);
    const flat: LocalDataset = { ...dataset, board: { ...dataset.board, map3d: false } };
    expect(buildLocalProject(flat).has3dAddon).toBe(false);
  });

  it("merker boardet som demo, med datasett og hilsen", async () => {
    const dataset = await emptyDataset();
    const board = buildLocalBoard(dataset);
    expect(board.demoDataset).toBe("nyhavna-lokal");
    expect(board.demoSnapshotId).toBe(datasetId(dataset));
    expect(board.demoGreeting).toBe(dataset.board.greeting);
  });

  it("gir ny innholds-ID når innholdet endres", async () => {
    const before = await emptyDataset();
    const after: LocalDataset = { ...before, topics: [] , places: [] };
    expect(datasetId(after)).toBe(datasetId(before));
    const changed: LocalDataset = { ...before, board: { ...before.board, greeting: "Hei igjen." } };
    expect(datasetId(changed)).not.toBe(datasetId(before));
  });
});

describe("et sted i datasettet", () => {
  const sources = localSourcesSchema.parse([
    { id: "kilde-a", label: "eksempel.no", page: "Side", url: "https://eksempel.no/side/", publisher: "Eksempel", checkedAt: "2026-09-13" },
  ]);
  const places = localPlacesSchema.parse([
    {
      id: "test-sted",
      name: "Test Sted",
      categoryId: "mat-drikke",
      coordinates: { lat: 63.44, lng: 10.42 },
      address: "Testgata 1",
      placeType: "Kafé",
      icon: "Coffee",
      status: "existing",
      summary: "Et sted lagt inn for å kontrollere adapteren.",
      travelTime: { walk: 4, bike: 2, car: 2 },
      sourceIds: ["kilde-a"],
      checkedAt: "2026-09-13",
    },
  ]);

  const withPlace = async (): Promise<LocalDataset> => ({ ...(await emptyDataset()), sources, places });

  it("havner i riktig tema, med koordinat, minutter og kilde", async () => {
    const board = buildLocalBoard(await withPlace());
    const servering = board.categories.find((c) => String(c.id) === "mat-drikke")!;
    expect(servering.pois.map((p) => p.name)).toEqual(["Test Sted"]);
    const poi = servering.pois[0];
    expect(poi.coordinates).toEqual({ lat: 63.44, lng: 10.42 });
    expect(poi.raw.travelTime?.walk).toBe(4);
    expect(poi.raw.editorialSources).toEqual(["https://eksempel.no/side/"]);
    // Ikonet er stedets, fargen temaets — boardets egen regel.
    expect(poi.icon).toBe("Coffee");
    expect(poi.raw.category.name).toBe("Kafé");
    // Alle ANDRE temaer er fortsatt tomme.
    expect(board.categories.filter((c) => c.pois.length > 0)).toHaveLength(1);
  });

  it("lar stedet bli med i prosjektet, så kart og oppslag ser det samme", async () => {
    const dataset = await withPlace();
    const project = buildLocalProject(dataset);
    expect(project.pois.map((p) => p.id)).toEqual(["test-sted"]);
    expect(buildLocalBoard(dataset).poisById.get("test-sted")?.name).toBe("Test Sted");
  });

  it("merker et planlagt sted som planlagt", async () => {
    const planned = localPlacesSchema.parse([{ ...places[0], id: "plan-sted", status: "planned" }]);
    const board = buildLocalBoard({ ...(await withPlace()), places: planned });
    expect(board.categories.flatMap((c) => c.pois)[0].raw.developmentStatus).toBe("planned");
  });
});

describe("spørsmål og svar", () => {
  const faqs = localFaqsSchema.parse([
    {
      id: "hele-omradet",
      question: "Hva slags område er dette?",
      answer: "Et område under utvikling.",
      origin: "imported",
      sourceIds: ["kilde-a"],
    },
    {
      id: "hvor-spise",
      categoryId: "mat-drikke",
      question: "Hvor kan jeg spise?",
      answer: "Se [Servering](category:mat-drikke).",
      origin: "imported",
      sourceIds: ["kilde-a"],
    },
    {
      id: "spise-sent",
      categoryId: "mat-drikke",
      question: "Er noe åpent sent?",
      answer: "Det står ikke i materialet.",
      origin: "local",
    },
  ]);

  const withFaq = async (): Promise<LocalDataset> => ({
    ...(await emptyDataset()),
    sources: localSourcesSchema.parse([
      { id: "kilde-a", label: "eksempel.no", page: "Side", url: "https://eksempel.no/side/", publisher: "Eksempel", checkedAt: "2026-09-13" },
    ]),
    faqs,
  });

  it("legger spørsmål uten tema i den globale seksjonen, resten under sitt tema", async () => {
    const board = buildLocalBoard(await withFaq());
    expect(board.globalFaq?.map((e) => e.id)).toEqual(["hele-omradet"]);
    const servering = board.categories.find((c) => String(c.id) === "mat-drikke")!;
    // Rekkefølgen i fila er rekkefølgen på flaten.
    expect(servering.editorial?.faq?.map((e) => e.id)).toEqual(["hvor-spise", "spise-sent"]);
    expect(servering.editorial?.faq?.[0].question).toBe("Hvor kan jeg spise?");
  });

  it("viser spørsmålene selv om temaet ikke har ett eneste sted", async () => {
    const board = buildLocalBoard(await withFaq());
    const servering = board.categories.find((c) => String(c.id) === "mat-drikke")!;
    expect(servering.pois).toEqual([]);
    expect(servering.editorial?.faq?.length).toBe(2);
  });

  it("lar temaer uten spørsmål stå urørt, uten oppdiktet innhold", async () => {
    const board = buildLocalBoard(await withFaq());
    const transport = board.categories.find((c) => String(c.id) === "transport")!;
    expect(transport.editorial).toBeUndefined();
  });

  it("gir det ekte datasettet spørsmål i sidebaren", async () => {
    const dataset = await loadDataset();
    const board = buildLocalBoard(dataset);
    const shown = (board.globalFaq?.length ?? 0) + board.categories.reduce((n, c) => n + (c.editorial?.faq?.length ?? 0), 0);
    // Alt som ligger i faq.json havner på en flate — ingen stille bortfall.
    expect(shown).toBe(dataset.faqs.length);
  });

  it("viser de kontrollerte oppvekstkildene med dato ved hvert svar", async () => {
    const dataset = await loadDataset();
    const board = buildLocalBoard(dataset);
    const faq = board.categories.find((c) => c.id === "barn-oppvekst")!.editorial!.faq!;
    expect(faq).toHaveLength(dataset.faqs.filter(f => f.categoryId === "barn-oppvekst").length);
    for (const entry of faq) {
      const original = dataset.faqs.find((f) => f.id === entry.id)!;
      expect(entry.knowledgeSources?.map((s) => s.id)).toEqual(original.sourceIds);
      expect(entry.knowledgeSources?.every((s) => s.url.startsWith("https://") && s.verifiedAt === dataset.sources.find(source => source.id === s.id)?.checkedAt)).toBe(true);
    }
  });
});
