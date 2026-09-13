import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertReferences,
  loadConversations,
  loadDataset,
  LOCAL_DATASET_DIR,
  LocalDatasetError,
} from "@/lib/demo/nyhavna-lokal/dataset";
import {
  localBoardSchema,
  localConversationsSchema,
  localPlacesSchema,
  localFaqsSchema,
  localSourcesSchema,
  localTopicsSchema,
  type LocalDataset,
} from "@/lib/demo/nyhavna-lokal/schema";

/**
 * Lasteren er demoens eneste inngang til innhold. Testene her holder tre løfter:
 * datasettet i repoet er GYLDIG og TOMT, brutte referanser stoppes med en
 * forståelig feil, og samtaleeksemplene ligger utenfor faktagrunnlaget.
 */

const JSON_FILES = ["board.json", "sources.json", "places.json", "topics.json", "faq.json", "conversations.json"];

async function fixture(dataset: {
  board?: unknown;
  sources?: unknown;
  places?: unknown;
  topics?: unknown;
  faq?: unknown;
  conversations?: unknown;
}) {
  const dir = await mkdtemp(join(tmpdir(), "placy-lokal-"));
  const real = JSON.parse(await readFile(join(LOCAL_DATASET_DIR, "board.json"), "utf8"));
  await writeFile(join(dir, "board.json"), JSON.stringify(dataset.board ?? real));
  await writeFile(join(dir, "sources.json"), JSON.stringify(dataset.sources ?? []));
  await writeFile(join(dir, "places.json"), JSON.stringify(dataset.places ?? []));
  await writeFile(join(dir, "topics.json"), JSON.stringify(dataset.topics ?? []));
  await writeFile(join(dir, "faq.json"), JSON.stringify(dataset.faq ?? []));
  await writeFile(join(dir, "conversations.json"), JSON.stringify(dataset.conversations ?? []));
  return dir;
}

describe("lokalt Nyhavna-datasett", () => {
  it("leveres uten steder: kategoriene står, stedslista er tom", async () => {
    const dataset = await loadDataset();
    expect(dataset.board.categories.length).toBeGreaterThan(0);
    // Kartet er geografisk bakgrunn i denne demoen — ingen steder, ingen
    // markører. FAQ-en er innholdet som ER lagt inn.
    expect(dataset.places).toEqual([]);
    expect(dataset.topics).toEqual([]);
  });

  it("har importert FAQ, og hvert importerte svar har en kilde", async () => {
    const dataset = await loadDataset();
    expect(dataset.faqs.length).toBeGreaterThan(0);
    const known = new Set(dataset.sources.map((s) => s.id));
    for (const entry of dataset.faqs.filter((f) => f.origin === "imported")) {
      expect(entry.sourceIds.length).toBeGreaterThan(0);
      for (const id of entry.sourceIds) expect(known.has(id)).toBe(true);
    }
    // Spørsmål uten tema hører til området, resten til en kategori som finnes.
    const categoryIds = new Set(dataset.board.categories.map((c) => c.id));
    for (const entry of dataset.faqs) {
      if (entry.categoryId) expect(categoryIds.has(entry.categoryId)).toBe(true);
    }
  });

  it("laster ikke samtaleeksempler som en del av datasettet", async () => {
    const dataset = await loadDataset();
    expect(Object.keys(dataset).sort()).toEqual(["board", "faqs", "places", "sources", "topics"]);
    // Eksemplene finnes, men bare bak sin egen laster.
    await expect(loadConversations()).resolves.toEqual([]);
  });

  it("kaster med filnavn og felt når en fil har ugyldige data", async () => {
    const dir = await fixture({ places: [{ id: "mangler-alt" }] });
    await expect(loadDataset(dir)).rejects.toThrow(/places\.json/);
  });

  it("kaster når en fil mangler", async () => {
    const dir = await mkdtemp(join(tmpdir(), "placy-lokal-tom-"));
    await expect(loadDataset(dir)).rejects.toBeInstanceOf(LocalDatasetError);
  });

  it("kaster på ugyldig JSON", async () => {
    const dir = await fixture({});
    await writeFile(join(dir, "topics.json"), "{ ikke json");
    await expect(loadDataset(dir)).rejects.toThrow(/gyldig JSON/);
  });
});

describe("referansesjekken", () => {
  const board: LocalDataset["board"] = localBoardSchema.parse({
    schemaVersion: 1,
    id: "test",
    name: "Test",
    center: { lat: 63.4, lng: 10.4 },
    greeting: "Hei.",
    projectInfoLabel: "eksempel.no",
    categories: [{ id: "kat-a", name: "Kategori A", icon: "MapPin", color: "#112233" }],
  });
  const base = (overrides: Partial<LocalDataset>): LocalDataset => ({
    board,
    sources: [],
    places: [],
    topics: [],
    faqs: [],
    ...overrides,
  });
  const place = (overrides: Record<string, unknown> = {}) =>
    localPlacesSchema.parse([
      { id: "sted-a", name: "Sted A", categoryId: "kat-a", coordinates: { lat: 63.4, lng: 10.4 }, checkedAt: "2026-09-13", ...overrides },
    ])[0];

  it("fanger ukjent kategori på et sted", () => {
    expect(() => assertReferences(base({ places: [place({ categoryId: "finnes-ikke" })] }))).toThrow(/ukjent categoryId «finnes-ikke»/);
  });

  it("fanger ukjent kilde på et fakta", () => {
    const withFact = place({
      facts: [{ id: "f1", text: "En påstand.", sourceId: "ukjent-kilde", checkedAt: "2026-09-13" }],
    });
    expect(() => assertReferences(base({ places: [withFact] }))).toThrow(/ukjent sourceId «ukjent-kilde»/);
  });

  it("fanger duplikate ID-er", () => {
    expect(() => assertReferences(base({ places: [place(), place()] }))).toThrow(/flere ganger/);
  });

  it("fanger et forbehold om plassering uten at plasseringen er merket omtrentlig", () => {
    const sloppy = place({ locationNote: "Omtrent her." });
    expect(() => assertReferences(base({ places: [sloppy] }))).toThrow(/approximate/);
  });

  it("fanger en temakunnskap som peker på et sted som ikke finnes", () => {
    const topics = localTopicsSchema.parse([
      { id: "tema-a", title: "Tema A", status: "existing", text: "Noe.", relatedPlaceIds: ["borte"], checkedAt: "2026-09-13" },
    ]);
    expect(() => assertReferences(base({ topics }))).toThrow(/ukjent relatedPlaceId «borte»/);
  });

  it("fanger et spørsmål som peker på en kategori som ikke finnes", () => {
    const faqs = localFaqsSchema.parse([
      { id: "sp-a", categoryId: "finnes-ikke", question: "Q?", answer: "A." },
    ]);
    expect(() => assertReferences(base({ faqs }))).toThrow(/faq\.json[\s\S]*finnes-ikke/);
  });

  it("fanger en kategorilenke i et svar som ikke kan klikkes", () => {
    const faqs = localFaqsSchema.parse([
      { id: "sp-b", question: "Q?", answer: "Se [Noe](category:finnes-ikke)." },
    ]);
    expect(() => assertReferences(base({ faqs }))).toThrow(/ukjent kategori/);
  });

  it("krever kilde på et importert svar", () => {
    const faqs = localFaqsSchema.parse([
      { id: "sp-c", question: "Q?", answer: "A.", origin: "imported" },
    ]);
    expect(() => assertReferences(base({ faqs }))).toThrow(/sourceIds er tom/);
  });

  it("godtar et helt datasett som henger sammen", () => {
    const sources = localSourcesSchema.parse([
      { id: "kilde-a", label: "eksempel.no", page: "Side", url: "https://eksempel.no/side/", publisher: "Eksempel", checkedAt: "2026-09-13" },
    ]);
    const places = [place({ sourceIds: ["kilde-a"], facts: [{ id: "f1", text: "En påstand.", sourceId: "kilde-a", checkedAt: "2026-09-13" }] })];
    const topics = localTopicsSchema.parse([
      { id: "tema-a", title: "Tema A", categoryIds: ["kat-a"], status: "planned", text: "Noe.", sourceIds: ["kilde-a"], relatedPlaceIds: ["sted-a"], checkedAt: "2026-09-13" },
    ]);
    expect(() => assertReferences(base({ sources, places, topics }))).not.toThrow();
  });
});

describe("eksempelfila", () => {
  it("validerer mot skjemaene, så dokumentasjonen ikke kan drifte fra koden", async () => {
    const raw = JSON.parse(await readFile(join(LOCAL_DATASET_DIR, "eksempel.json"), "utf8"));
    const sources = localSourcesSchema.parse(raw.sources);
    const places = localPlacesSchema.parse(raw.places);
    const topics = localTopicsSchema.parse(raw.topics);
    const faqs = localFaqsSchema.parse(raw.faq);
    localConversationsSchema.parse(raw.conversations);
    const dataset: LocalDataset = {
      board: localBoardSchema.parse(JSON.parse(await readFile(join(LOCAL_DATASET_DIR, "board.json"), "utf8"))),
      sources,
      places,
      topics,
      faqs,
    };
    expect(() => assertReferences(dataset)).not.toThrow();
  });

  it("lastes ikke av demoen: lasteren leser bare de seks navngitte filene", async () => {
    const dir = await fixture({});
    await writeFile(join(dir, "eksempel.json"), JSON.stringify({ places: "tull" }));
    const dataset = await loadDataset(dir);
    expect(dataset.places).toEqual([]);
    expect(JSON_FILES).toHaveLength(6);
  });
});
