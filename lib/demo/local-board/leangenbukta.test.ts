import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadDataset } from "@/lib/demo/local-board/dataset";
import { buildLocalBoard, buildLocalProject } from "@/lib/demo/local-board/board";
import { getLocalDemo, LOCAL_DEMO_IDS } from "@/lib/demo/local-board/registry";
import { buildLocalInstructions, buildVoiceDeps } from "@/lib/demo/local-board/voice";
import { buildLocalVoiceInstructions } from "@/lib/demo/local-board/voice-instructions";
import { createNyhavnaConversation } from "@/lib/realtime/nyhavna-conversation";

/** Leangenbuktas reviderte, lokale demo-datasett (U5/U6). */

const DEMO = "leangenbukta-lokal";

describe("Leangenbukta-datasettet i repoet", () => {
  it("laster hele den reviderte innholdspakken", async () => {
    const dataset = await loadDataset(getLocalDemo(DEMO));
    expect(dataset.sources).toHaveLength(58);
    expect(dataset.places.filter((place) => place.knowledgeLevel === "audited")).toHaveLength(56);
    expect(dataset.places.filter((place) => place.knowledgeLevel === "register")).toHaveLength(503);
    expect(dataset.places).toHaveLength(559);
    expect(dataset.topics).toHaveLength(36);
    expect(dataset.faqs).toHaveLength(34);
    expect(dataset.board.profile).toBe("housing-development");
    expect(dataset.board.presentation).toHaveLength(8);
  });

  it("gir åtte fylte kategorier og Leangenbuktas egen identitet på boardet", async () => {
    const descriptor = getLocalDemo(DEMO);
    const dataset = await loadDataset(descriptor);
    const board = buildLocalBoard(dataset, descriptor);

    expect(board.categories).toHaveLength(8);
    for (const category of board.categories) {
      expect(category.editorial?.body ?? "", category.id).not.toBe("");
    }
    // Prosjektkategorien, og de sju fra Scope Boundaries.
    expect(board.categories.map((category) => category.id)).toEqual([
      "leangenbukta-prosjektet",
      "hverdag",
      "oppvekst",
      "servering",
      "natur",
      "transport",
      "trening",
      "opplevelser",
    ]);

    expect(board.demoDataset).toBe(DEMO);
    expect(board.demoGreeting).toBe(dataset.board.greeting);
    expect(board.demoGreeting).toContain("Leangenbukta");
    expect(board.demoGreeting).not.toContain("Nyhavna");
    expect(board.home.name).toBe("Leangenbukta");
    expect(board.home.pinSubtitle).toBe("");
    expect(board.home.pinImage).toBe("/demo/leangenbukta-lokal/leangenbukta-logo.svg");
    expect(board.poisById.size).toBe(360);
    expect(board.globalFaq ?? []).toEqual([]);
  });

  it("skjuler meglerkortet og lar prosjektet peke på datasettets senter", async () => {
    const descriptor = getLocalDemo(DEMO);
    const dataset = await loadDataset(descriptor);
    const project = buildLocalProject(dataset, descriptor);
    expect(project.reportConfig?.hideBrokerCard).toBe(true);
    expect(project.pois.filter((poi) => dataset.places.find((place) => place.id === poi.id)?.knowledgeLevel === "audited")).toHaveLength(56);
    expect(project.centerCoordinates).toEqual({
      lat: 63.43947521501401,
      lng: 10.466113792494502,
    });
  });

  it("gir instruksene Leangenbuktas navn, steder og prosjektforbehold", async () => {
    const descriptor = getLocalDemo(DEMO);
    const dataset = await loadDataset(descriptor);
    const board = buildLocalBoard(dataset, descriptor);
    const backend = buildLocalInstructions(dataset, board);
    const voice = buildLocalVoiceInstructions(dataset);

    expect(backend).toContain("STEDER OG REISETIDER (data):");
    expect(backend).toContain("Skolekretsen for Haakon VIIs gate 14 er ikke verifisert");
    expect(backend).not.toContain("KART: Det er ingen steder i kartet.");
    expect(backend).toContain("Leangenbukta");
    expect(backend).not.toContain("Nyhavna");
    expect(voice).toContain("Leangenbukta");
    expect(voice).not.toContain("Nyhavna");
  });

  it("gir Anja et avgrenset registeroppslag for alle 503 importerte steder", async () => {
    const descriptor = getLocalDemo(DEMO);
    const dataset = await loadDataset(descriptor);
    const conversation = createNyhavnaConversation(buildLocalBoard(dataset, descriptor), buildVoiceDeps(dataset));
    const registerPlaces = dataset.places.filter((place) => place.knowledgeLevel === "register");

    expect(registerPlaces).toHaveLength(503);
    for (const place of registerPlaces) {
      const result = conversation.execute("get_place_facts", { poi_id: place.id }).result as Record<string, unknown>;
      expect(result, place.id).toMatchObject({
        id: place.id,
        map_poi_id: place.parentPlaceId ?? place.id,
        basis: "register",
      });
      expect(result, place.id).not.toHaveProperty("facts");
      expect(result, place.id).not.toHaveProperty("sources");
    }
  });

  it("viser Fyr, Franske Nytelser og Burger King som egne serveringspunkter", async () => {
    const descriptor = getLocalDemo(DEMO);
    const dataset = await loadDataset(descriptor);
    const board = buildLocalBoard(dataset, descriptor);
    const expected = [
      { id: "register-fyr-pa-lade-4d6a3048bd", basis: "register" },
      { id: "register-franske-nytelser-as-d14607a696", basis: "register" },
      { id: "burger-king-lade-arena", basis: "audited" },
    ] as const;

    for (const { id, basis } of expected) {
      const place = dataset.places.find((candidate) => candidate.id === id);
      expect(place, id).toMatchObject({
        categoryId: "servering",
        knowledgeLevel: basis,
      });
      expect(place, id).not.toHaveProperty("parentPlaceId");
      expect(board.poisById.has(id), id).toBe(true);
    }

    expect(dataset.places.filter((place) => /burger king/i.test(place.name))).toHaveLength(1);
  });

  it("holder demoen utenfor Supabase og POI-poolen", async () => {
    // Samme grense som registeret lover, men målt på ruta: ingen fil under
    // `app/demo/leangenbukta-lokal/` importerer Supabase. Bare import-linjene
    // sjekkes — kommentarene i ruta nevner Supabase nettopp for å si at den
    // ikke brukes.
    const files = await readdir("app/demo/leangenbukta-lokal");
    const modules = files.filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."));
    expect(modules.sort()).toEqual(["layout.tsx", "lokal-board-gate.tsx", "page.tsx"]);
    for (const file of modules) {
      const source = await readFile(join("app/demo/leangenbukta-lokal", file), "utf8");
      const imports = source.split("\n").filter((line) => line.startsWith("import ") || line.startsWith("} from "));
      expect(imports.join("\n"), file).not.toMatch(/supabase/i);
    }
  });
});

describe("registeret etter at Leangenbukta er lagt til", () => {
  it("beholder Nyhavnas deskriptor uendret", () => {
    const nyhavna = getLocalDemo("nyhavna-lokal");
    expect(nyhavna.directory).toBe("data/demo/nyhavna-lokal");
    expect(nyhavna.readme).toBe("docs/research/nyhavna-lokal-demo/README.md");
    expect(nyhavna.features).toEqual({
      faqProgress: true,
      revealPlaces: true,
      followHighlightCategory: true,
      unscopedCategoryList: true,
      narrationFocus: true,
      voicePacing: true,
      guidedPersona: true,
    });
  });

  it("gir de to demoene hver sin mappe og hver sin innholds-ID", async () => {
    expect(LOCAL_DEMO_IDS).toContain(DEMO);
    const leangenbukta = getLocalDemo(DEMO);
    const nyhavna = getLocalDemo("nyhavna-lokal");
    expect(leangenbukta.directory).toBe("data/demo/leangenbukta-lokal");
    expect(leangenbukta.directory).not.toBe(nyhavna.directory);

    const a = buildLocalBoard(await loadDataset(leangenbukta), leangenbukta);
    const b = buildLocalBoard(await loadDataset(nyhavna), nyhavna);
    expect(a.demoDataset).not.toBe(b.demoDataset);
    expect(a.demoSnapshotId).not.toBe(b.demoSnapshotId);
    expect(a.demoSnapshotId).toMatch(/^leangenbukta-lokal-/);
  });
});
