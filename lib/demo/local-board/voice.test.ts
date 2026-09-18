import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildLocalBoard } from "@/lib/demo/local-board/board";
import { loadDataset } from "@/lib/demo/local-board/dataset";
import { buildKnowledgeBase, buildLocalInstructions, buildVoiceDeps, localDemoInstruction } from "@/lib/demo/local-board/voice";
import { buildLocalVoiceInstructions } from "@/lib/demo/local-board/voice-instructions";
import {
  localBoardSchema,
  localPlacesSchema,
  localSourcesSchema,
  localTopicsSchema,
  type LocalDataset,
} from "@/lib/demo/local-board/schema";
import { createNyhavnaConversation } from "@/lib/realtime/nyhavna-conversation";
import { nyhavnaFaqCatalog, nyhavnaInstructions } from "@/lib/realtime/nyhavna-knowledge";

import { getLocalDemo } from "@/lib/demo/local-board/registry";

const NYHAVNA = getLocalDemo("nyhavna-lokal");

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
  return localBoardSchema.parse(JSON.parse(await readFile(join(NYHAVNA.directory, "board.json"), "utf8")));
}

const emptyDataset = async (): Promise<LocalDataset> => ({
  board: { ...(await realBoard()), presentation: [] },
  sources: [],
  places: [],
  topics: [],
  faqs: [],
});

const conversationFor = (dataset: LocalDataset) =>
  createNyhavnaConversation(buildLocalBoard(dataset, NYHAVNA), buildVoiceDeps(dataset));

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
    const board = buildLocalBoard(dataset, NYHAVNA);
    const instructions = `${nyhavnaInstructions(board, { projectInfoLabel: dataset.board.projectInfoLabel })}\n${localDemoInstruction(dataset)}`;
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
    const source = await readFile(join("lib", "demo", "local-board", "voice.ts"), "utf8");
    // Bare importene teller: doc-kommentaren NEVNER fila, med vilje.
    const imports = source.split("\n").filter((line) => line.startsWith("import"));
    expect(imports.join("\n")).not.toMatch(/dataset|loadConversations/);
    // …og de ligger heller ikke i noe stemmen faktisk får.
    const dataset = await emptyDataset();
    const example = JSON.parse(await readFile(join(NYHAVNA.directory, "eksempel.json"), "utf8"));
    const utterance: string = example.conversations[0].transcript[0].text;
    const board = buildLocalBoard(dataset, NYHAVNA);
    const payload = `${nyhavnaInstructions(board)}${localDemoInstruction(dataset)}${JSON.stringify(buildVoiceDeps(dataset).knowledge)}`;
    expect(payload).not.toContain(utterance);
  });
});

describe("spørsmål og svar er felles for sidebar og stemme", () => {
  it("gir backenden kontrollerte FAQ og kilder uten ureviderte svar", async () => {
    const dataset = await loadDataset(NYHAVNA);
    const instructions = buildLocalInstructions(dataset, buildLocalBoard(dataset, NYHAVNA));
    for (const faq of dataset.faqs) {
      if (faq.origin === "local") {
        expect(instructions).toContain(faq.answer.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"));
        for (const id of faq.sourceIds) expect(instructions).toContain(dataset.sources.find((s) => s.id === id)!.url);
      } else {
        expect(instructions).not.toContain(faq.answer);
      }
    }
  });

  it("bruker enkle FAQ og kartsteder, uten arkivets meny- og aldersdetaljer", async () => {
    const dataset = await loadDataset(NYHAVNA);
    const board = buildLocalBoard(dataset, NYHAVNA);
    const instructions = buildLocalInstructions(dataset, board);
    expect(instructions).not.toContain("ingen steder i kartet");
    expect(instructions).toContain("demoens utgangspunkt");
    expect(nyhavnaFaqCatalog(board)).toContain("vis:");
    const knowledge = JSON.stringify(buildVoiceDeps(dataset).knowledge);
    expect(knowledge).not.toMatch(/barnepizza|cheeseburger|155 kroner/i);
    expect(dataset.topics.some(t => t.text.includes("16 minutter"))).toBe(true);
  });

  it("kan fremheve alle steder lenket fra FAQ gjennom ekte kartverktøy", async () => {
    const { executeBoardTool } = await import("@/lib/realtime/board-tools");
    const { initialBoardState } = await import("@/components/variants/report/board/board-state");
    const dataset = await loadDataset(NYHAVNA);
    const board = buildLocalBoard(dataset, NYHAVNA);
    const visibleFaqs = [...(board.globalFaq ?? []), ...board.categories.flatMap(c => c.editorial?.faq ?? [])];
    for (const faq of visibleFaqs) {
      const ids = [...new Set([...faq.answer.matchAll(/\(poi:([^)]+)\)/g)].map(m => m[1]))];
      if (!ids.length) continue;
      const actions: unknown[] = [];
      const result = executeBoardTool("highlight_places", { poi_ids: ids }, {
        data: board, state: initialBoardState, dispatch: action => actions.push(action),
      });
      expect(result).toMatchObject({ ok: true });
      expect(actions).toContainEqual({ type: "HIGHLIGHT_POIS", ids });
    }
  });

  it("gir stemmen nøyaktig de spørsmålene sidebaren viser", async () => {
    const dataset = await loadDataset(NYHAVNA);
    const board = buildLocalBoard(dataset, NYHAVNA);
    const catalog = nyhavnaFaqCatalog(board);
    for (const entry of dataset.faqs) {
      // ID-en er kontrakten mellom flaten og `answered_faq_ids`.
      expect(catalog).toContain(`(${entry.id})`);
      expect(catalog).toContain(entry.question);
    }
  });

});

/**
 * Prosjektkunnskapen i samtalen (2026-09-18).
 *
 * Skjermen og stemmen leser samme projeksjon (`development.ts`), så testene her
 * kontrollerer den ENE oversettelsen som kan gi et løfte demoen ikke har
 * dekning for: fra strukturert evidens til noe guiden kan si høyt.
 */
describe("prosjektkunnskap i stemmens grunnlag", () => {
  const sources = localSourcesSchema.parse([
    { id: "kilde-a", label: "eksempel.no", page: "Prosjektet", url: "https://eksempel.no/prosjektet/", publisher: "Eksempel", checkedAt: "2026-09-18" },
  ]);
  const places = localPlacesSchema.parse([
    {
      id: "bygg-a-sted", name: "Bygg A", categoryId: "mat-drikke",
      coordinates: { lat: 63.44, lng: 10.42 }, summary: "Første byggetrinn.",
      travelTime: { walk: 1 }, sourceIds: ["kilde-a"], checkedAt: "2026-09-18",
    },
  ]);
  const topics = localTopicsSchema.parse([
    {
      id: "bygg-a", title: "Bygg A", categoryIds: ["mat-drikke"], status: "existing",
      text: "Bygg A er ferdigstilt.", checkedAt: "2026-09-18", sourceIds: ["kilde-a"],
      development: {
        objectType: "building", buildStatus: "existing", availability: "open", availabilityClaimId: "c-a",
        access: { scope: "all-residents" }, mapAnchor: { placeId: "bygg-a-sted" },
        claims: [{ id: "c-a", text: "Bygg A er overtatt av beboerne.", sourceId: "kilde-a", checkedAt: "2026-09-18" }],
      },
    },
    {
      id: "treningsrom", title: "Treningsrommet", categoryIds: [], status: "unresolved",
      text: "Treningsrommet ligger i første etasje.", checkedAt: "2026-09-18", sourceIds: ["kilde-a"],
      keywords: ["trene", "trening"],
      development: {
        objectType: "facility", buildStatus: "existing", availability: "unknown",
        access: { scope: "unresolved" },
        timing: { text: "Q1 2027", qualifier: "expected" },
        claims: [
          { id: "c-prospekt", text: "Treningsrom i bygg A.", sourceId: "kilde-a", checkedAt: "2026-01-02" },
          { id: "c-nett", text: "Treningsrom i bygg B.", sourceId: "kilde-a", checkedAt: "2026-09-01" },
        ],
        conflicts: [{ claimIds: ["c-prospekt", "c-nett"], note: "Kildene plasserer det i hvert sitt bygg." }],
      },
    },
  ]);
  const withDevelopment = async (): Promise<LocalDataset> => ({
    ...(await emptyDataset()),
    sources,
    places,
    topics,
  });

  it("AE2: get_place_facts sier ikke at fasiliteten er åpen", async () => {
    const dataset = await withDevelopment();
    const facts = result(dataset, "get_place_facts", { poi_id: "bygg-a-sted" });
    // Bygget er overtatt, og det er belagt.
    expect(facts.status).toBe("existing");
    // Fasiliteten i bygget er et eget objekt, og den er ikke sagt å være åpen.
    const info = result(dataset, "find_project_info", { query: "treningsrom" });
    const results = info.results as Array<{ status: string; text: string }>;
    expect(results[0].status).toBe("eksisterende, åpning ikke oppgitt");
    expect(results[0].text).toContain("Kildene sier ikke om «Treningsrommet» er åpen.");
    // Den ene setningen som ville vært et svar uten dekning finnes ikke:
    // åpningslinja sier at kilden ikke har oppgitt noe.
    expect(results[0].text).toContain("Åpning: åpning ikke oppgitt.");
    expect(results[0].text).not.toContain("Åpning: åpnet");
    expect(results[0].text).not.toMatch(/Ikke slutt at den er åpen\.[\s\S]*Åpning: åpnet/);
  });

  it("AE3: forventet tidspunkt kommer med forbeholdet, aldri som et løfte", async () => {
    const info = result(await withDevelopment(), "find_project_info", { query: "treningsrom" });
    const [first] = info.results as Array<{ text: string }>;
    expect(first.text).toContain("Forventet tidspunkt: Q1 2027");
    expect(first.text).toContain("er en forventning fra kilden, ikke en bekreftet dato");
    expect(first.text).toContain("Ingen kilde bekrefter at «Treningsrommet» er tilgjengelig ved innflytting.");
  });

  it("AE4: begge de motstridende påstandene følger svaret", async () => {
    const info = result(await withDevelopment(), "find_project_info", { query: "treningsrom" });
    const [first] = info.results as Array<{ text: string }>;
    expect(first.text).toContain("Treningsrom i bygg A.");
    expect(first.text).toContain("Treningsrom i bygg B.");
    expect(first.text).toContain("Kildene plasserer det i hvert sitt bygg.");
  });

  it("gjør et objekt uten kartanker søkbart uten å finne på et sted", async () => {
    const dataset = await withDevelopment();
    const info = result(dataset, "find_project_info", { query: "trening" });
    expect((info.results as Array<{ id: string }>).map((r) => r.id)).toContain("treningsrom");
    // Ingen markør er laget for fasiliteten: kartet har bare stedet i places.json.
    const board = buildLocalBoard(dataset, NYHAVNA);
    expect(board.categories.flatMap((c) => c.pois).map((p) => String(p.id))).toEqual(["bygg-a-sted"]);
  });

  it("legger reglene om prosjektstatus i instruksen bare når datasettet har objekter", async () => {
    const dataset = await withDevelopment();
    const instructions = buildLocalInstructions(dataset, buildLocalBoard(dataset, NYHAVNA));
    expect(instructions).toContain("PROSJEKTSTATUS:");
    expect(instructions).toContain("En bekreftelse som gjelder ett navngitt bygg gjelder ikke de andre byggene.");
    expect(instructions).toContain("PROSJEKTOBJEKTER (data):");

    const plain = await emptyDataset();
    expect(buildLocalInstructions(plain, buildLocalBoard(plain, NYHAVNA))).not.toContain("PROSJEKTSTATUS:");
  });
});

/**
 * Kategorinavn og kildekobling i prosjektkunnskapen (2026-09-18).
 *
 * To feil som begge gir guiden noe den ikke har dekning for: en regel om
 * «trening og natur» i et datasett uten de kategoriene, og et bekreftet fakta
 * tilskrevet feil kilde.
 */
describe("radiusutvidelsen navngir datasettets egne kategorier", () => {
  const withDiscovery = async (ids: string[], categories?: Array<{ id: string; name: string; icon: string; color: string }>): Promise<LocalDataset> => {
    const base = await emptyDataset();
    return {
      ...base,
      board: localBoardSchema.parse({
        ...base.board,
        categories: categories ?? base.board.categories,
        discoveryCategoryIds: ids,
      }),
    };
  };

  it("bruker kategorien datasettet faktisk har", async () => {
    const dataset = await withDiscovery(["vannkant"], [
      { id: "vannkant", name: "Vannkant", icon: "Waves", color: "#3b82f6" },
    ]);
    const instructions = buildLocalInstructions(dataset, buildLocalBoard(dataset, NYHAVNA));
    expect(instructions).toContain("EKSTRA STEDER: Vannkant starter med et lite utvalg");
    expect(instructions).not.toContain("Trening og natur");
    expect(buildLocalVoiceInstructions(dataset)).toContain("For vannkant kan backenden utvide radiusen");
  });

  it("utelater hele avsnittet når ingen kategori kan utvides", async () => {
    const dataset = await withDiscovery([]);
    const instructions = buildLocalInstructions(dataset, buildLocalBoard(dataset, NYHAVNA));
    expect(instructions).not.toContain("EKSTRA STEDER:");
    expect(buildLocalVoiceInstructions(dataset)).not.toContain("utvide radiusen");
  });
});

describe("bekreftede prosjektopplysninger i stedets fakta", () => {
  const sources = localSourcesSchema.parse([
    { id: "kilde-a", label: "eksempel.no", page: "Prosjektet", url: "https://eksempel.no/prosjektet/", publisher: "Eksempel", checkedAt: "2026-09-18" },
    { id: "kilde-b", label: "utbygger.no", page: "Fellesarealer", url: "https://utbygger.no/fellesarealer/", publisher: "Utbygger", checkedAt: "2026-09-18" },
  ]);
  const places = localPlacesSchema.parse([
    {
      id: "bygg-a-sted", name: "Bygg A", categoryId: "mat-drikke",
      coordinates: { lat: 63.44, lng: 10.42 }, summary: "Første byggetrinn.",
      sourceIds: ["kilde-a"], checkedAt: "2026-09-18",
    },
  ]);
  const anchoredTopic = (extra: Record<string, unknown>) =>
    localTopicsSchema.parse([
      {
        id: "bygg-a", title: "Bygg A", categoryIds: ["mat-drikke"], status: "existing",
        text: "Bygg A er ferdigstilt.", checkedAt: "2026-09-18", sourceIds: ["kilde-a"],
        development: {
          objectType: "building", buildStatus: "existing",
          access: { scope: "all-residents" }, mapAnchor: { placeId: "bygg-a-sted" },
          ...extra,
        },
      },
    ]);
  const datasetFor = async (extra: Record<string, unknown>): Promise<LocalDataset> => ({
    ...(await emptyDataset()),
    sources,
    places,
    topics: anchoredTopic(extra),
  });

  it("gir stedet opplysningene som bekreftede fakta, med påstandens egen kilde", async () => {
    const dataset = await datasetFor({
      availability: "open",
      availabilityClaimId: "c-apen",
      claims: [{ id: "c-apen", text: "Fellesarealene er åpnet.", sourceId: "kilde-b", checkedAt: "2026-09-10" }],
    });
    const entity = buildKnowledgeBase(dataset).entities.find((e) => e.id === "bygg-a-sted");
    const opening = entity?.facts.find((fact) => fact.text.startsWith("Åpning:"));
    expect(opening).toMatchObject({ text: "Åpning: åpnet", verification: "confirmed", sourceId: "kilde-b" });
  });

  it("lar et uavklart objekt stå med forbehold alene, uten en åpningspåstand", async () => {
    const dataset = await datasetFor({ availability: "unknown", claims: [] });
    const entity = buildKnowledgeBase(dataset).entities.find((e) => e.id === "bygg-a-sted");
    const opening = entity?.facts.find((fact) => fact.text.startsWith("Åpning:"));
    expect(opening?.text).toBe("Åpning: åpning ikke oppgitt");
    expect(entity?.facts.some((fact) => fact.text.includes("åpnet") && fact.verification === "confirmed")).toBe(false);
    expect(entity?.facts.some((fact) => fact.verification === "unresolved" && fact.text.includes("Ikke slutt at den er åpen"))).toBe(true);
  });

  it("siterer påstandens kilde i find_project_info, ikke temaets første", async () => {
    const dataset = await datasetFor({
      availability: "open",
      availabilityClaimId: "c-apen",
      claims: [{ id: "c-apen", text: "Fellesarealene er åpnet.", sourceId: "kilde-b", checkedAt: "2026-09-10" }],
    });
    const info = result(dataset, "find_project_info", { query: "bygg" });
    const [first] = info.results as Array<{ source: { url: string } }>;
    expect(first.source.url).toBe("https://utbygger.no/fellesarealer/");
  });
});
