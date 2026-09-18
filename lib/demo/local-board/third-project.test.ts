import { describe, expect, it } from "vitest";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { writeTestDemo } from "@/lib/demo/local-board/__fixtures__/test-demo";
import { loadDataset } from "@/lib/demo/local-board/dataset";
import { buildLocalBoard, buildLocalProject, datasetId } from "@/lib/demo/local-board/board";
import { buildLocalInstructions, buildVoiceDeps } from "@/lib/demo/local-board/voice";
import { buildLocalVoiceInstructions } from "@/lib/demo/local-board/voice-instructions";
import { createPresentation, presentationTool, similarPlacesTool, morePlacesTool } from "@/lib/demo/local-board/presentation";
import { getLocalDemo, isLocalDemoId, LOCAL_DEMO_IDS } from "@/lib/demo/local-board/registry";
import { LocalDatasetError } from "@/lib/demo/local-board/errors";
import { isLiveDataset, loadLiveDemo, LIVE_DATASETS, type LiveDatasetId } from "@/lib/live/demos";
import { conversationTools, createNyhavnaConversation } from "@/lib/realtime/nyhavna-conversation";
import type { ConversationLabels } from "@/lib/realtime/conversation-labels";
import type { LocalDemoDescriptor, LocalDemoFeatures } from "@/lib/demo/local-board/registry";

/**
 * Et TREDJE, syntetisk prosjekt på den delte kjernen (U8).
 *
 * ## Hva testene her beviser
 *
 * At neste boligprosjekt er DATA og KONFIGURASJON, ikke en kopi av motoren.
 * Datasettet under finnes bare i denne testen: eget navn, egen hilsen, eget
 * senter, egne kategori-ID-er og eget innhold. Ingen linje i `lib/demo/`,
 * `lib/live/` eller `lib/realtime/` er endret for å få det til å virke — hadde
 * noe måttet endres, ville testen ikke kompilert.
 *
 * Tre løfter holdes:
 *
 * 1. Kjeden fra JSON til board, backend-instruks, stemmeinstruks og
 *    samtaleverktøy går gjennom på et datasett ingen har skrevet kode for, og
 *    ingenting fra Nyhavna eller Leangenbukta følger med.
 * 2. En endring i ett datasett flytter ikke et annet datasetts innholds-ID.
 *    Det er hele grunnen til at hashen er per datasett: en fane som står åpen
 *    på Nyhavna skal ikke kastes ut fordi noen skrev en setning i et annet
 *    prosjekt.
 * 3. Det syntetiske datasettet er IKKE nåbart fra registeret eller fra
 *    Live-ruta. Registeret er lukket, og en test som kunne åpne en dør inn til
 *    runtime ville vært en ny måte å publisere ukontrollert innhold på.
 *
 * ## Grensen mot `loadLiveDemo`
 *
 * `lokalDemo()` i `lib/live/demos.ts` er ikke eksportert, og `loadLiveDemo`
 * slår opp i registeret. Et syntetisk datasett kan derfor per konstruksjon ikke
 * gå gjennom `loadLiveDemo` — det ER løfte 3. Testen setter i stedet sammen
 * nøyaktig de samme byggeklossene `lokalDemo()` bruker (`loadDataset`,
 * `buildLocalBoard`, `buildLocalInstructions`, `buildLocalVoiceInstructions`,
 * `buildVoiceDeps`, `conversationTools`, `createPresentation`), og kontrollerer
 * `loadLiveDemo` separat på avvisningssiden. Endres sammensetningen i
 * `lokalDemo()`, fanges det av `lib/live/demos.test.ts`, som kjører den ekte.
 */

const SYNTHETIC_ID = "syntetisk-test";
const SYNTHETIC_NAME = "Kvernhaugen testfelt";
const SYNTHETIC_GREETING = "Hei, jeg er guiden din på Kvernhaugen testfelt. Vil du se området eller selve utbyggingen?";
/** Et senter som ikke er noen av de to ekte demoenes. */
const SYNTHETIC_CENTER = { lat: 63.3612, lng: 10.3489 };

const ALL_ON: LocalDemoFeatures = {
  faqProgress: true,
  revealPlaces: true,
  followHighlightCategory: true,
  unscopedCategoryList: true,
  narrationFocus: true,
  voicePacing: true,
  guidedPersona: true,
};

/** Ord som avslører at et annet prosjekts innhold har lekket inn. */
const FOREIGN = /nyhavna|leangenbukta/i;

/**
 * Skriver det syntetiske prosjektet: ramme fra fixturen, og deretter en kilde,
 * et sted og et spørsmål, slik dataløpet gjør det (AE7). Poenget er at innhold
 * kommer inn gjennom filene, ikke gjennom kode.
 */
async function writeSyntheticProject(overrides: { greeting?: string } = {}): Promise<LocalDemoDescriptor> {
  const descriptor = await writeTestDemo({
    id: SYNTHETIC_ID,
    name: SYNTHETIC_NAME,
    greeting: overrides.greeting ?? SYNTHETIC_GREETING,
    features: ALL_ON,
    board: {
      center: SYNTHETIC_CENTER,
      projectInfoLabel: "testfeltets eget materiale",
      pinSubtitle: "",
      categories: [
        { id: "torgliv", name: "Torgliv", icon: "ShoppingBag", color: "#4b6a4f" },
        { id: "vannkant", name: "Vannkant", icon: "Waves", color: "#2f6f8f" },
      ],
      discoveryCategoryIds: ["vannkant"],
      voice: {
        subject: "hverdagen på Kvernhaugen",
        presents: "Kvernhaugen testfelt og nærområdet",
        phrases: ["fra Kvernhaugen"],
      },
    },
  });

  const write = (file: string, value: unknown) =>
    writeFile(join(descriptor.directory, file), JSON.stringify(value));

  await write("sources.json", [
    {
      id: "testfeltets-side",
      label: "kvernhaugen.example",
      page: "Om testfeltet",
      url: "https://kvernhaugen.example/om",
      publisher: "Kvernhaugen testfelt",
      checkedAt: "2026-09-18",
    },
  ]);
  await write("places.json", [
    {
      id: "torget",
      name: "Kvernhaugtorget",
      categoryId: "torgliv",
      coordinates: { lat: 63.3618, lng: 10.3501 },
      placeType: "Torg",
      summary: "Torget midt i feltet.",
      sourceIds: ["testfeltets-side"],
      checkedAt: "2026-09-18",
    },
  ]);
  await write("faq.json", [
    {
      id: "hvor-er-torget",
      categoryId: "torgliv",
      question: "Hvor ligger torget?",
      answer: "Torget ligger midt i feltet, noen minutter å gå fra boligene.",
      sourceIds: ["testfeltets-side"],
    },
  ]);
  return descriptor;
}

describe("et tredje, syntetisk prosjekt på den delte kjernen", () => {
  it("bygger board, prosjekt, instrukser og verktøy uten en linje kode for seg selv", async () => {
    const descriptor = await writeSyntheticProject();
    const dataset = await loadDataset(descriptor);
    const board = buildLocalBoard(dataset, descriptor);
    const project = buildLocalProject(dataset, descriptor);
    const backend = buildLocalInstructions(dataset, board);
    const voice = buildLocalVoiceInstructions(dataset);
    const labels: ConversationLabels = {
      areaName: dataset.board.name,
      projectInfoLabel: dataset.board.projectInfoLabel,
    };
    const tools = [...conversationTools(labels), presentationTool, similarPlacesTool, morePlacesTool];

    // Identiteten er datasettets egen, hele veien.
    expect(board.demoDataset).toBe(SYNTHETIC_ID);
    expect(board.demoGreeting).toBe(SYNTHETIC_GREETING);
    expect(board.home.name).toBe(SYNTHETIC_NAME);
    expect(project.centerCoordinates).toEqual(SYNTHETIC_CENTER);
    expect(board.categories.map((category) => category.id)).toEqual(["torgliv", "vannkant"]);

    // Innholdet kom inn gjennom filene, ikke gjennom kode (AE7).
    expect(board.poisById.size).toBe(1);
    expect([...board.poisById.values()][0]?.name).toBe("Kvernhaugtorget");
    expect(board.categories[0]?.editorial?.faq?.map((entry) => entry.question)).toEqual(["Hvor ligger torget?"]);

    // Ingen arv fra de to ekte demoene — verken på skjermen eller i tale.
    expect(JSON.stringify(board)).not.toMatch(FOREIGN);
    expect(JSON.stringify(project)).not.toMatch(FOREIGN);
    expect(backend).not.toMatch(FOREIGN);
    expect(voice).not.toMatch(FOREIGN);
    expect(tools.map((tool) => `${tool.name} ${tool.description}`).join("\n")).not.toMatch(FOREIGN);

    // …og navnet står der det skal.
    expect(backend).toContain(SYNTHETIC_NAME);
    expect(voice).toContain("Kvernhaugen testfelt og nærområdet");
    expect(tools.find((tool) => tool.name === "find_places")?.description).toContain(SYNTHETIC_NAME);
  });

  it("svarer i samtalen av sitt eget datasett, med samme sammensetning som Live-demoen bruker", async () => {
    const descriptor = await writeSyntheticProject();
    const dataset = await loadDataset(descriptor);
    const board = buildLocalBoard(dataset, descriptor);
    const labels: ConversationLabels = {
      areaName: dataset.board.name,
      projectInfoLabel: dataset.board.projectInfoLabel,
    };
    const conversation = createPresentation(
      createNyhavnaConversation(board, { ...buildVoiceDeps(dataset), labels }),
      {
        segments: dataset.board.presentation ?? [],
        places: dataset.places,
        center: dataset.board.center,
        categories: dataset.board.categories,
        homeName: dataset.board.name,
        discoveryCategoryIds: dataset.board.discoveryCategoryIds,
      },
    );

    expect(conversation.themes.map((theme) => theme.id)).toEqual(["torgliv", "vannkant"]);

    const opened = conversation.execute("open_theme", { theme_id: "torgliv" });
    expect(JSON.stringify(opened.result)).toContain("Kvernhaugtorget");
    expect(JSON.stringify(opened.result)).not.toMatch(FOREIGN);

    // Et tema som ikke finnes her gir en feil, ikke et annet prosjekts kapittel.
    const ukjent = conversation.execute("open_theme", { theme_id: "nyhavna-bydel" });
    expect(JSON.stringify(ukjent.result)).toContain("Ukjent tema-ID");
  });

  it("lar en endring i ett datasett stå alene: andres innholds-ID rører seg ikke", async () => {
    const nyhavna = getLocalDemo("nyhavna-lokal");
    const nyhavnaFør = datasetId(await loadDataset(nyhavna), nyhavna);

    const a = await writeSyntheticProject();
    const idA = datasetId(await loadDataset(a), a);

    // Samme prosjekt, én setning endret: bare dette datasettets ID flytter seg.
    const b = await writeSyntheticProject({ greeting: "Hei, jeg er guiden din på Kvernhaugen testfelt. Skal vi begynne ved torget?" });
    const idB = datasetId(await loadDataset(b), b);

    expect(idA).not.toBe(idB);
    expect(idA).toMatch(/^syntetisk-test-/);
    expect(idB).toMatch(/^syntetisk-test-/);

    const nyhavnaEtter = datasetId(await loadDataset(nyhavna), nyhavna);
    expect(nyhavnaEtter).toBe(nyhavnaFør);
    expect(nyhavnaEtter).not.toBe(idA);
    expect(nyhavnaEtter).not.toBe(idB);

    // Og den ekte Leangenbukta-demoen står like uberørt.
    const leangenbukta = getLocalDemo("leangenbukta-lokal");
    const leangenbuktaId = datasetId(await loadDataset(leangenbukta), leangenbukta);
    expect(leangenbuktaId).toMatch(/^leangenbukta-lokal-/);
    expect(leangenbuktaId).not.toBe(idA);
  });

  it("er utilgjengelig for runtime: verken registeret eller Live-ruta kjenner det", async () => {
    await writeSyntheticProject();

    // Registeret er lukket. En mappe som finnes på disk er ikke en demo.
    expect(LOCAL_DEMO_IDS).not.toContain(SYNTHETIC_ID);
    expect(isLocalDemoId(SYNTHETIC_ID)).toBe(false);
    expect(() => getLocalDemo(SYNTHETIC_ID)).toThrow(LocalDatasetError);

    // Live-ruta godtar bare snapshotet og de registrerte demoene.
    expect(LIVE_DATASETS).not.toContain(SYNTHETIC_ID);
    expect(isLiveDataset(SYNTHETIC_ID)).toBe(false);
    // Casten er selve poenget: typen kjenner bare de registrerte ID-ene, så en
    // ukjent ID må tvinges inn for å kunne bevise at lasteren avviser den.
    const unknown = SYNTHETIC_ID as LiveDatasetId;
    await expect(loadLiveDemo(unknown)).rejects.toThrow(LocalDatasetError);
    await expect(loadLiveDemo(unknown)).rejects.toThrow(/Ukjent datasett «syntetisk-test»/);
  });
});
