import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertReferences,
  loadConversations,
  loadDataset,
  LocalDatasetError,
} from "@/lib/demo/local-board/dataset";
import {
  localBoardSchema,
  localConversationsSchema,
  localPlacesSchema,
  localFaqsSchema,
  localSourcesSchema,
  localTopicsSchema,
  type LocalDataset,
} from "@/lib/demo/local-board/schema";

import { getLocalDemo } from "@/lib/demo/local-board/registry";
import { writeTestDemo } from "@/lib/demo/local-board/__fixtures__/test-demo";

const NYHAVNA = getLocalDemo("nyhavna-lokal");

/**
 * Lasteren er demoens eneste inngang til innhold. Testene her holder tre løfter:
 * datasettet i repoet er gyldig, brutte referanser stoppes med en
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
  const real = JSON.parse(await readFile(join(NYHAVNA.directory, "board.json"), "utf8"));
  delete real.presentation;
  for (const category of real.categories) delete category.sourceId;
  await writeFile(join(dir, "board.json"), JSON.stringify(dataset.board ?? real));
  await writeFile(join(dir, "sources.json"), JSON.stringify(dataset.sources ?? []));
  await writeFile(join(dir, "places.json"), JSON.stringify(dataset.places ?? []));
  await writeFile(join(dir, "topics.json"), JSON.stringify(dataset.topics ?? []));
  await writeFile(join(dir, "faq.json"), JSON.stringify(dataset.faq ?? []));
  await writeFile(join(dir, "conversations.json"), JSON.stringify(dataset.conversations ?? []));
  return dir;
}

describe("lokalt Nyhavna-datasett", () => {
  it("har et kuratert stedsutvalg med beregnede reisetider", async () => {
    const dataset = await loadDataset(NYHAVNA);
    expect(dataset.board.categories.length).toBeGreaterThan(0);
    expect(dataset.places.length).toBeGreaterThan(5);
    expect(dataset.places.filter(p => p.status === "existing" && !p.provenance && !["crossfit-trondheim", "lilleby-treningssenter"].includes(p.id)).every(p => p.travelTime?.walk !== undefined)).toBe(true);
    expect(dataset.topics.length).toBeGreaterThan(0);
  });

  it("har lokale FAQ med kilder og gyldige kartlenker", async () => {
    const dataset = await loadDataset(NYHAVNA);
    expect(dataset.faqs.length).toBeGreaterThan(0);
    const known = new Set(dataset.sources.map((s) => s.id));
    for (const entry of dataset.faqs) {
      expect(entry.origin).toBe("local");
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
    const dataset = await loadDataset(NYHAVNA);
    expect(Object.keys(dataset).sort()).toEqual(["board", "faqs", "places", "sources", "topics"]);
    // Eksemplene finnes, men bare bak sin egen laster.
    await expect(loadConversations(NYHAVNA)).resolves.toEqual([]);
  });

  it("kaster med filnavn og felt når en fil har ugyldige data", async () => {
    const dir = await fixture({ places: [{ id: "mangler-alt" }] });
    await expect(loadDataset({ ...NYHAVNA, directory: dir })).rejects.toThrow(/places\.json/);
  });

  it("kaster når en fil mangler", async () => {
    const dir = await mkdtemp(join(tmpdir(), "placy-lokal-tom-"));
    await expect(loadDataset({ ...NYHAVNA, directory: dir })).rejects.toBeInstanceOf(LocalDatasetError);
  });

  it("kaster på ugyldig JSON", async () => {
    const dir = await fixture({});
    await writeFile(join(dir, "topics.json"), "{ ikke json");
    await expect(loadDataset({ ...NYHAVNA, directory: dir })).rejects.toThrow(/gyldig JSON/);
  });
});

describe("referansesjekken", () => {
  const board: LocalDataset["board"] = localBoardSchema.parse({
    schemaVersion: 1,
    profile: "housing-development",
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
    expect(() => assertReferences(base({ places: [place({ categoryId: "finnes-ikke" })] }), NYHAVNA)).toThrow(/ukjent categoryId «finnes-ikke»/);
  });

  it("fanger ukjent kilde på et fakta", () => {
    const withFact = place({
      facts: [{ id: "f1", text: "En påstand.", sourceId: "ukjent-kilde", checkedAt: "2026-09-13" }],
    });
    expect(() => assertReferences(base({ places: [withFact] }), NYHAVNA)).toThrow(/ukjent sourceId «ukjent-kilde»/);
  });

  it("fanger duplikate ID-er", () => {
    expect(() => assertReferences(base({ places: [place(), place()] }), NYHAVNA)).toThrow(/flere ganger/);
  });

  it("fanger et forbehold om plassering uten at plasseringen er merket omtrentlig", () => {
    const sloppy = place({ locationNote: "Omtrent her." });
    expect(() => assertReferences(base({ places: [sloppy] }), NYHAVNA)).toThrow(/approximate/);
  });

  it("fanger en temakunnskap som peker på et sted som ikke finnes", () => {
    const topics = localTopicsSchema.parse([
      { id: "tema-a", title: "Tema A", status: "existing", text: "Noe.", relatedPlaceIds: ["borte"], checkedAt: "2026-09-13" },
    ]);
    expect(() => assertReferences(base({ topics }), NYHAVNA)).toThrow(/ukjent relatedPlaceId «borte»/);
  });

  it("fanger et spørsmål som peker på en kategori som ikke finnes", () => {
    const faqs = localFaqsSchema.parse([
      { id: "sp-a", categoryId: "finnes-ikke", question: "Q?", answer: "A." },
    ]);
    expect(() => assertReferences(base({ faqs }), NYHAVNA)).toThrow(/faq\.json[\s\S]*finnes-ikke/);
  });

  it("fanger en kategorilenke i et svar som ikke kan klikkes", () => {
    const faqs = localFaqsSchema.parse([
      { id: "sp-b", question: "Q?", answer: "Se [Noe](category:finnes-ikke)." },
    ]);
    expect(() => assertReferences(base({ faqs }), NYHAVNA)).toThrow(/ukjent kategori/);
  });

  it("stopper FAQ-lenker til kartsteder som mangler", () => {
    const faqs = localFaqsSchema.parse([
      { id: "sp-sted", question: "Q?", answer: "Se [Skolen](poi: mangler )." },
    ]);
    expect(() => assertReferences(base({ faqs }), NYHAVNA)).toThrow(/ukjent kartsted/);
  });

  it("krever kilde på et importert svar", () => {
    const faqs = localFaqsSchema.parse([
      { id: "sp-c", question: "Q?", answer: "A.", origin: "imported" },
    ]);
    expect(() => assertReferences(base({ faqs }), NYHAVNA)).toThrow(/sourceIds er tom/);
  });

  it("godtar et helt datasett som henger sammen", () => {
    const sources = localSourcesSchema.parse([
      { id: "kilde-a", label: "eksempel.no", page: "Side", url: "https://eksempel.no/side/", publisher: "Eksempel", checkedAt: "2026-09-13" },
    ]);
    const places = [place({ sourceIds: ["kilde-a"], facts: [{ id: "f1", text: "En påstand.", sourceId: "kilde-a", checkedAt: "2026-09-13" }] })];
    const topics = localTopicsSchema.parse([
      { id: "tema-a", title: "Tema A", categoryIds: ["kat-a"], status: "planned", text: "Noe.", sourceIds: ["kilde-a"], relatedPlaceIds: ["sted-a"], checkedAt: "2026-09-13" },
    ]);
    expect(() => assertReferences(base({ sources, places, topics }), NYHAVNA)).not.toThrow();
  });
});

describe("eksempelfila", () => {
  it("validerer mot skjemaene, så dokumentasjonen ikke kan drifte fra koden", async () => {
    const raw = JSON.parse(await readFile(join(NYHAVNA.directory, "eksempel.json"), "utf8"));
    const sources = localSourcesSchema.parse(raw.sources);
    const places = localPlacesSchema.parse(raw.places);
    const topics = localTopicsSchema.parse(raw.topics);
    const faqs = localFaqsSchema.parse(raw.faq);
    localConversationsSchema.parse(raw.conversations);
    const dataset: LocalDataset = {
      board: { ...localBoardSchema.parse(JSON.parse(await readFile(join(NYHAVNA.directory, "board.json"), "utf8"))), presentation: [] },
      sources,
      places,
      topics,
      faqs,
    };
    dataset.board.categories = dataset.board.categories.map(c => ({ ...c, sourceId: undefined }));
    expect(() => assertReferences(dataset, NYHAVNA)).not.toThrow();
  });

  it("lastes ikke av demoen: lasteren leser bare de seks navngitte filene", async () => {
    const dir = await fixture({});
    await writeFile(join(dir, "eksempel.json"), JSON.stringify({ places: "tull" }));
    const dataset = await loadDataset({ ...NYHAVNA, directory: dir });
    expect(dataset.places).toEqual([]);
    expect(JSON_FILES).toHaveLength(6);
  });
});


it("avviser manussteder fra feil kategori og brutte referanser", async () => {
  const dataset = await loadDataset(NYHAVNA);
  const segment = dataset.board.presentation![0];
  const other = dataset.places.find(p => p.categoryId !== segment.categoryId)!;
  segment.placeIds = [other.id];
  expect(() => assertReferences(dataset, NYHAVNA)).toThrow(/tilhører kategorien/);
  segment.placeIds = ["missing-place"];
  expect(() => assertReferences(dataset, NYHAVNA)).toThrow(/ukjent placeId/);
  segment.placeIds = [];
  segment.categoryId = "missing-category";
  expect(() => assertReferences(dataset, NYHAVNA)).toThrow(/ukjent categoryId/);
});

describe("et annet lokalt datasett", () => {
  it("laster tomt, med sin egen identitet og ingenting fra Nyhavna", async () => {
    const other = await writeTestDemo();
    const dataset = await loadDataset(other);
    expect(dataset.board.id).toBe("leangenbukta-test");
    expect(dataset.places).toEqual([]);
    expect(dataset.topics).toEqual([]);
    expect(dataset.faqs).toEqual([]);
    expect(dataset.sources).toEqual([]);
    expect(dataset.board.categories.map((c) => c.id)).toEqual(["hverdagsliv"]);
    expect(JSON.stringify(dataset)).not.toMatch(/Nyhavna/i);
    expect(dataset.board.discoveryCategoryIds).toEqual([]);
    expect(dataset.board.voice).toBeUndefined();
  });

  it("peker på sin egen mappe og sitt eget dokument når en fil mangler", async () => {
    const other = await writeTestDemo();
    await rm(join(other.directory, "places.json"));
    const error = await loadDataset(other).then(() => null, (e: Error) => e);
    expect(error).toBeInstanceOf(LocalDatasetError);
    expect(error!.message).toContain(other.readme);
    expect(error!.message).toContain(other.directory);
    // Ingen tilbakefall: Nyhavnas mappe nevnes ikke i feilen.
    expect(error!.message).not.toMatch(/nyhavna/i);
  });

  it("stopper en discoveryCategoryIds som peker på en kategori som ikke finnes", async () => {
    const other = await writeTestDemo({ board: { discoveryCategoryIds: ["finnes-ikke"] } });
    await expect(loadDataset(other)).rejects.toThrow(/discoveryCategoryIds: ukjent categoryId «finnes-ikke»/);
  });

  it("leser samtaleeksemplene fra demoens egen mappe", async () => {
    const other = await writeTestDemo();
    await expect(loadConversations(other)).resolves.toEqual([]);
  });
});

/**
 * Profilen og den strukturerte prosjektkunnskapen (2026-09-18).
 *
 * Profilen sier hva slags KUNNSKAP datasettet bærer. Å la en udokumentert eller
 * uimplementert profil laste ville gitt en demo som later som den har begreper
 * ingen har bygd — derfor stopper lasteren, med en feil som sier hvorfor.
 */
describe("domeneprofilen", () => {
  it("laster boligprosjektprofilen, som er den implementerte", async () => {
    const dataset = await loadDataset(NYHAVNA);
    expect(dataset.board.profile).toBe("housing-development");
  });

  it("avviser en dokumentert, men uimplementert profil", async () => {
    const other = await writeTestDemo({ board: { profile: "resale" } });
    const error = await loadDataset(other).then(() => null, (e: Error) => e);
    expect(error).toBeInstanceOf(LocalDatasetError);
    expect(error!.message).toContain("«resale»");
    expect(error!.message).toContain("dokumentert men ikke implementert");
    expect(error!.message).toContain("housing-development");
  });

  it("avviser en profil som ikke finnes i katalogen", async () => {
    const other = await writeTestDemo({ board: { profile: "hyttefelt" } });
    await expect(loadDataset(other)).rejects.toThrow(/board\.json/);
  });

  it("krever at profilen er oppgitt", async () => {
    const other = await writeTestDemo();
    const raw = JSON.parse(await readFile(join(other.directory, "board.json"), "utf8"));
    delete raw.profile;
    await writeFile(join(other.directory, "board.json"), JSON.stringify(raw));
    await expect(loadDataset(other)).rejects.toThrow(/profile/);
  });
});

describe("referansesjekken for prosjektkunnskap", () => {
  const board: LocalDataset["board"] = localBoardSchema.parse({
    schemaVersion: 1,
    profile: "housing-development",
    id: "test",
    name: "Test",
    center: { lat: 63.4, lng: 10.4 },
    greeting: "Hei.",
    projectInfoLabel: "eksempel.no",
    categories: [{ id: "kat-a", name: "Kategori A", icon: "MapPin", color: "#112233" }],
  });
  const sources = localSourcesSchema.parse([
    { id: "kilde-a", label: "eksempel.no", page: "Side", url: "https://eksempel.no/side/", publisher: "Eksempel", checkedAt: "2026-09-18" },
  ]);
  const claim = { id: "c1", text: "En påstand.", sourceId: "kilde-a", checkedAt: "2026-09-18" };
  const dataset = (development: Record<string, unknown>, extra: Record<string, unknown>[] = []): LocalDataset => ({
    board,
    sources,
    places: [],
    topics: localTopicsSchema.parse([
      ...extra,
      {
        id: "treningsrom", title: "Treningsrommet", status: "existing", text: "Noe.", checkedAt: "2026-09-18",
        development: { objectType: "facility", buildStatus: "existing", availability: "unknown", access: { scope: "unresolved" }, ...development },
      },
    ]),
    faqs: [],
  });
  const building = {
    id: "bygg-a", title: "Bygg A", status: "existing", text: "A.", checkedAt: "2026-09-18",
    development: { objectType: "building", buildStatus: "existing", availability: "unknown", access: { scope: "unresolved" } },
  };

  it("krever en påstand med kilde før noe kan være åpent", () => {
    expect(() => assertReferences(dataset({ availability: "open" }), NYHAVNA)).toThrow(/availabilityClaimId/);
    expect(() =>
      assertReferences(dataset({ availability: "open", availabilityClaimId: "c1", claims: [claim] }), NYHAVNA),
    ).not.toThrow();
  });

  it("krever at innflyttingskoblingen peker på et bygg", () => {
    expect(() =>
      assertReferences(dataset({ moveInLinks: [{ buildingId: "bygg-a", confirmedBy: "kilde-a" }] }), NYHAVNA),
    ).toThrow(/ikke et tema med objectType «building»/);
    expect(() =>
      assertReferences(dataset({ moveInLinks: [{ buildingId: "bygg-a", confirmedBy: "kilde-a" }] }, [building]), NYHAVNA),
    ).not.toThrow();
  });

  it("krever kilde på innflyttingskoblingen", () => {
    expect(() =>
      assertReferences(dataset({ moveInLinks: [{ buildingId: "bygg-a", confirmedBy: "ukjent" }] }, [building]), NYHAVNA),
    ).toThrow(/ukjent confirmedBy «ukjent»/);
  });

  it("fanger en claimId som ikke finnes blant objektets egne påstander", () => {
    expect(() => assertReferences(dataset({ buildStatusClaimId: "borte" }), NYHAVNA)).toThrow(/ukjent claimId «borte»/);
    expect(() =>
      assertReferences(dataset({ conflicts: [{ claimIds: ["c1", "borte"], note: "Spriker." }], claims: [claim] }), NYHAVNA),
    ).toThrow(/ukjent claimId «borte»/);
  });

  it("fanger et kartanker som peker på et sted som ikke finnes", () => {
    expect(() => assertReferences(dataset({ mapAnchor: { placeId: "borte" } }), NYHAVNA)).toThrow(/ukjent placeId «borte»/);
  });

  it("holder navngitte bygg og adgangsomfang i samsvar", () => {
    expect(() => assertReferences(dataset({ access: { scope: "named-buildings" } }), NYHAVNA)).toThrow(/krever minst én buildingId/);
    expect(() =>
      assertReferences(dataset({ access: { scope: "all-residents", buildingIds: ["bygg-a"] } }, [building]), NYHAVNA),
    ).toThrow(/gjelder bare scope «named-buildings»/);
  });

  it("godtar et objekt uten kartanker", () => {
    expect(() => assertReferences(dataset({}), NYHAVNA)).not.toThrow();
  });
});
