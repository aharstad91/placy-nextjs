import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildLocalBoard, buildLocalProject, datasetId } from "@/lib/demo/local-board/board";
import { loadDataset } from "@/lib/demo/local-board/dataset";
import {
  localBoardSchema,
  localFaqsSchema,
  localPlacesSchema,
  localSourcesSchema,
  localTopicsSchema,
  type LocalDataset,
} from "@/lib/demo/local-board/schema";
import { buildProjectInfo } from "@/lib/demo/local-board/voice";

import { getLocalDemo } from "@/lib/demo/local-board/registry";
import { writeTestDemo } from "@/lib/demo/local-board/__fixtures__/test-demo";

const NYHAVNA = getLocalDemo("nyhavna-lokal");

/**
 * Adapteren bærer demoens to løfter mot flaten: kategoriene overlever tomhet, og
 * et sted som legges inn havner i riktig tema med riktig markør.
 */

async function realBoard() {
  const board = localBoardSchema.parse(JSON.parse(await readFile(join(NYHAVNA.directory, "board.json"), "utf8")));
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
    const board = buildLocalBoard(await emptyDataset(), NYHAVNA);
    const dataset = await emptyDataset();
    expect(board.categories.map((c) => String(c.id))).toEqual(dataset.board.categories.map((c) => c.id));
    expect(board.categories.every((c) => c.pois.length === 0)).toBe(true);
    expect(board.poisById.size).toBe(0);
  });

  it("lover ingenting boardet ikke har", async () => {
    const board = buildLocalBoard(await emptyDataset(), NYHAVNA);
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
    expect(buildLocalProject(dataset, NYHAVNA).has3dAddon).toBe(true);
    const flat: LocalDataset = { ...dataset, board: { ...dataset.board, map3d: false } };
    expect(buildLocalProject(flat, NYHAVNA).has3dAddon).toBe(false);
  });

  it("merker boardet som demo, med datasett og hilsen", async () => {
    const dataset = await emptyDataset();
    const board = buildLocalBoard(dataset, NYHAVNA);
    expect(board.demoDataset).toBe("nyhavna-lokal");
    expect(board.demoSnapshotId).toBe(datasetId(dataset, NYHAVNA));
    expect(board.demoGreeting).toBe(dataset.board.greeting);
  });

  it("gir ny innholds-ID når innholdet endres", async () => {
    const before = await emptyDataset();
    const after: LocalDataset = { ...before, topics: [] , places: [] };
    expect(datasetId(after, NYHAVNA)).toBe(datasetId(before, NYHAVNA));
    const changed: LocalDataset = { ...before, board: { ...before.board, greeting: "Hei igjen." } };
    expect(datasetId(changed, NYHAVNA)).not.toBe(datasetId(before, NYHAVNA));
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
    const board = buildLocalBoard(await withPlace(), NYHAVNA);
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
    const project = buildLocalProject(dataset, NYHAVNA);
    expect(project.pois.map((p) => p.id)).toEqual(["test-sted"]);
    expect(buildLocalBoard(dataset, NYHAVNA).poisById.get("test-sted")?.name).toBe("Test Sted");
  });

  it("merker et planlagt sted som planlagt", async () => {
    const planned = localPlacesSchema.parse([{ ...places[0], id: "plan-sted", status: "planned" }]);
    const board = buildLocalBoard({ ...(await withPlace()), places: planned }, NYHAVNA);
    expect(board.categories.flatMap((c) => c.pois)[0].raw.developmentStatus).toBe("planned");
  });

  it("lar manusets reviderte sted beholde highlight foran et nærmere registersted", async () => {
    const dataset = await withPlace();
    const register = localPlacesSchema.parse([
      {
        provenance: { provider: "supabase", recordId: "source-register", importedAt: "2026-09-18" },
        knowledgeLevel: "register",
        id: "register-sted",
        name: "Register Sted",
        categoryId: "mat-drikke",
        coordinates: { lat: 63.441, lng: 10.421 },
        placeType: "Restaurant",
        travelTime: { walk: 1 },
        checkedAt: "2026-09-18",
      },
    ]);
    const boardCategory = dataset.board.categories.find((category) => category.id === "mat-drikke")!;
    dataset.board = {
      ...dataset.board,
      categories: dataset.board.categories.map((category) =>
        category.id === "mat-drikke" ? { ...boardCategory, body: "Revidert tematekst." } : category,
      ),
      presentation: [{
        id: "test-manus",
        categoryId: "mat-drikke",
        text: "Test Sted er det reviderte utvalget.",
        placeIds: ["test-sted"],
        sourceIds: ["kilde-a"],
        checkedAt: "2026-09-13",
      }],
    };
    dataset.places = [...dataset.places, ...register];

    const category = buildLocalBoard(dataset, NYHAVNA).categories.find((item) => item.id === "mat-drikke")!;
    expect(category.pois.map((poi) => poi.id)).toEqual(["register-sted", "test-sted"]);
    expect(category.editorial?.highlights.map((highlight) => highlight.id)).toEqual(["test-sted"]);
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
    const board = buildLocalBoard(await withFaq(), NYHAVNA);
    expect(board.globalFaq?.map((e) => e.id)).toEqual(["hele-omradet"]);
    const servering = board.categories.find((c) => String(c.id) === "mat-drikke")!;
    // Rekkefølgen i fila er rekkefølgen på flaten.
    expect(servering.editorial?.faq?.map((e) => e.id)).toEqual(["hvor-spise", "spise-sent"]);
    expect(servering.editorial?.faq?.[0].question).toBe("Hvor kan jeg spise?");
  });

  it("viser spørsmålene selv om temaet ikke har ett eneste sted", async () => {
    const board = buildLocalBoard(await withFaq(), NYHAVNA);
    const servering = board.categories.find((c) => String(c.id) === "mat-drikke")!;
    expect(servering.pois).toEqual([]);
    expect(servering.editorial?.faq?.length).toBe(2);
  });

  it("lar temaer uten spørsmål stå urørt, uten oppdiktet innhold", async () => {
    const board = buildLocalBoard(await withFaq(), NYHAVNA);
    const transport = board.categories.find((c) => String(c.id) === "transport")!;
    expect(transport.editorial).toBeUndefined();
  });

  it("gir det ekte datasettet spørsmål i sidebaren", async () => {
    const dataset = await loadDataset(NYHAVNA);
    const board = buildLocalBoard(dataset, NYHAVNA);
    const shown = (board.globalFaq?.length ?? 0) + board.categories.reduce((n, c) => n + (c.editorial?.faq?.length ?? 0), 0);
    // Alt som ligger i faq.json havner på en flate — ingen stille bortfall.
    expect(shown).toBe(dataset.faqs.length);
  });

  it("viser de kontrollerte oppvekstkildene med dato ved hvert svar", async () => {
    const dataset = await loadDataset(NYHAVNA);
    const board = buildLocalBoard(dataset, NYHAVNA);
    const faq = board.categories.find((c) => c.id === "barn-oppvekst")!.editorial!.faq!;
    expect(faq).toHaveLength(dataset.faqs.filter(f => f.categoryId === "barn-oppvekst").length);
    for (const entry of faq) {
      const original = dataset.faqs.find((f) => f.id === entry.id)!;
      expect(entry.knowledgeSources?.map((s) => s.id)).toEqual(original.sourceIds);
      expect(entry.knowledgeSources?.every((s) => s.url.startsWith("https://") && s.verifiedAt === dataset.sources.find(source => source.id === s.id)?.checkedAt)).toBe(true);
    }
  });
});

describe("to datasett på samme kjerne", () => {
  it("gir hver demo sin egen identitet, hilsen og innholds-ID", async () => {
    const other = await writeTestDemo();
    const otherDataset = await loadDataset(other);
    const otherBoard = buildLocalBoard(otherDataset, other);
    const nyhavna = buildLocalBoard(await loadDataset(NYHAVNA), NYHAVNA);

    expect(otherBoard.demoDataset).toBe("leangenbukta-test");
    expect(nyhavna.demoDataset).toBe("nyhavna-lokal");
    expect(otherBoard.demoSnapshotId).not.toBe(nyhavna.demoSnapshotId);
    expect(otherBoard.demoSnapshotId?.startsWith("leangenbukta-test-")).toBe(true);
    expect(otherBoard.demoGreeting).toBe(otherDataset.board.greeting);
    expect(otherBoard.demoGreeting).not.toBe(nyhavna.demoGreeting);
    expect(otherBoard.home.name).toBe("Leangenbukta");
    // Ingen arv: det tomme datasettet har verken Nyhavnas steder eller temaer.
    expect(JSON.stringify([...otherBoard.poisById.keys()])).not.toMatch(/nyhavna/i);
    expect(otherBoard.categories.map((c) => String(c.id))).toEqual(["hverdagsliv"]);
  });

  it("bærer demoens funksjonsflagg, og lar dem endre innholds-ID-en", async () => {
    const off = await writeTestDemo();
    const dataset = await loadDataset(off);
    expect(buildLocalBoard(dataset, off).demoFeatures?.faqProgress).toBe(false);

    const on = { ...off, features: { ...off.features, faqProgress: true } };
    expect(buildLocalBoard(dataset, on).demoFeatures?.faqProgress).toBe(true);
    expect(datasetId(dataset, on)).not.toBe(datasetId(dataset, off));
  });

  it("utvider bare radius i kategoriene datasettet peker ut", async () => {
    const dataset = await loadDataset(NYHAVNA);
    const board = buildLocalBoard(dataset, NYHAVNA);
    const categories = new Set(board.demoRadiusPlaces?.map((p) => p.categoryId));
    for (const id of categories) expect(dataset.board.discoveryCategoryIds).toContain(id);

    const narrow = { ...dataset, board: { ...dataset.board, discoveryCategoryIds: [] } };
    expect(buildLocalBoard(narrow, NYHAVNA).demoRadiusPlaces).toEqual([]);
    expect(buildLocalBoard(narrow, NYHAVNA).demoReservePlaceIds).toEqual([]);
  });
});

/**
 * Prosjektkunnskapen på stedsflaten (2026-09-18).
 *
 * Adapterens `developmentStatus` er og blir en KARTKLASSIFISERING: her nå, eller
 * kommer. Den kan ikke bære at et ferdig bygg har et uåpnet treningsrom, og
 * testene under låser at den ikke prøver — det detaljerte grunnlaget ligger ved
 * siden av, med de samme ordene stemmen bruker.
 */
describe("utbyggingsobjekter på stedsflaten", () => {
  const sources = localSourcesSchema.parse([
    { id: "kilde-a", label: "eksempel.no", page: "Prosjektet", url: "https://eksempel.no/prosjektet/", publisher: "Eksempel", checkedAt: "2026-09-18" },
  ]);
  const places = localPlacesSchema.parse([
    {
      id: "bygg-a-sted", name: "Bygg A", categoryId: "mat-drikke",
      coordinates: { lat: 63.44, lng: 10.42 }, summary: "Første byggetrinn.",
      travelTime: { walk: 1 }, sourceIds: ["kilde-a"], checkedAt: "2026-09-18",
    },
    {
      id: "vanlig-sted", name: "Vanlig Sted", categoryId: "mat-drikke",
      coordinates: { lat: 63.45, lng: 10.43 }, travelTime: { walk: 3 }, checkedAt: "2026-09-18",
    },
  ]);
  const withDevelopment = async (development: Record<string, unknown>): Promise<LocalDataset> => ({
    ...(await emptyDataset()),
    sources,
    places,
    topics: localTopicsSchema.parse([
      {
        id: "bygg-a", title: "Bygg A", status: "existing", text: "Bygg A.", checkedAt: "2026-09-18",
        sourceIds: ["kilde-a"],
        development: {
          objectType: "building", buildStatus: "existing", availability: "unknown",
          access: { scope: "unresolved" }, mapAnchor: { placeId: "bygg-a-sted" }, ...development,
        },
      },
    ]),
  });

  it("legger status, åpning og adgang ved siden av kartklassifiseringen", async () => {
    const project = buildLocalProject(await withDevelopment({}), NYHAVNA);
    const poi = project.pois.find((p) => p.id === "bygg-a-sted")!;
    expect(poi.developmentStatus).toBe("existing");
    expect(poi.development!.facts).toContainEqual({ label: "Status", value: "eksisterende" });
    expect(poi.development!.facts).toContainEqual({ label: "Åpning", value: "åpning ikke oppgitt" });
    expect(poi.development!.caveats).toContain(
      "Kildene sier ikke om «Bygg A» er åpen. Ikke slutt at den er åpen.",
    );
  });

  it("lar et sted uten objekt stå uten linjer — ingen falsk negativ", async () => {
    const project = buildLocalProject(await withDevelopment({}), NYHAVNA);
    expect(project.pois.find((p) => p.id === "vanlig-sted")!.development).toBeUndefined();
  });

  it("bruker samme ord som stemmen om samme objekt", async () => {
    const dataset = await withDevelopment({ timing: { text: "Q1 2027", qualifier: "expected" } });
    const poi = buildLocalProject(dataset, NYHAVNA).pois.find((p) => p.id === "bygg-a-sted")!;
    const spoken = buildProjectInfo(dataset).search("Bygg A", [], 1)[0];
    for (const fact of poi.development!.facts) expect(spoken.text).toContain(`${fact.label}: ${fact.value}`);
    for (const caveat of poi.development!.caveats) expect(spoken.text).toContain(caveat);
  });
});

describe("domeneprofilen i innholds-hashen", () => {
  it("gir et nytt datasett-ID når profilen endres", async () => {
    const dataset = await emptyDataset();
    const resale: LocalDataset = { ...dataset, board: { ...dataset.board, profile: "resale" } };
    expect(datasetId(resale, NYHAVNA)).not.toBe(datasetId(dataset, NYHAVNA));
  });

  it("er med i hashen fordi den ligger i datasettet, ikke fordi noen listet den opp", async () => {
    const dataset = await emptyDataset();
    expect(JSON.stringify(dataset.board)).toContain('"profile":"housing-development"');
  });
});
