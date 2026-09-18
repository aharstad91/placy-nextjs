import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadDataset } from "@/lib/demo/local-board/dataset";
import { buildLocalBoard, buildLocalProject } from "@/lib/demo/local-board/board";
import { getLocalDemo, LOCAL_DEMO_IDS } from "@/lib/demo/local-board/registry";
import { buildLocalInstructions } from "@/lib/demo/local-board/voice";
import { buildLocalVoiceInstructions } from "@/lib/demo/local-board/voice-instructions";

/**
 * Den tomme Leangenbukta-demoen (U4, AE1).
 *
 * Testene her holder ett løfte: rammen står, og ingenting er fylt inn av seg
 * selv. En demo som starter med et annet steds fakta er nettopp feilen de
 * lokale demoene finnes for å unngå, og den er usynlig på skjermen — Anja
 * ville bare hørtes velinformert ut.
 */

const DEMO = "leangenbukta-lokal";

describe("Leangenbukta-datasettet i repoet", () => {
  it("laster, og er tomt bortsett fra kilderegisterets ene oppføring", async () => {
    const dataset = await loadDataset(getLocalDemo(DEMO));
    expect(dataset.places).toEqual([]);
    expect(dataset.topics).toEqual([]);
    expect(dataset.faqs).toEqual([]);
    // Kilden demoens utgangspunkt er hentet fra: det provisjonerte boardet.
    expect(dataset.sources.map((source) => source.id)).toEqual(["placy-board-leangenbukta"]);
    expect(dataset.board.profile).toBe("housing-development");
    expect(dataset.board.presentation).toBeUndefined();
  });

  it("gir åtte tomme kategorier og Leangenbuktas egen identitet på boardet", async () => {
    const descriptor = getLocalDemo(DEMO);
    const dataset = await loadDataset(descriptor);
    const board = buildLocalBoard(dataset, descriptor);

    expect(board.categories).toHaveLength(8);
    for (const category of board.categories) {
      expect(category.pois ?? [], category.id).toEqual([]);
      expect(category.editorial?.body ?? "", category.id).toBe("");
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
    // Markøren har ingen undertittel: «Nybygg 2028» er en påstand om byggeår
    // dette datasettet ikke har dekning for.
    expect(board.home.pinSubtitle).toBe("");
    expect(board.home.pinImage).toBe("/demo/leangenbukta-lokal/leangenbukta-logo.svg");
    expect(board.poisById.size).toBe(0);
    expect(board.globalFaq ?? []).toEqual([]);
  });

  it("skjuler meglerkortet og lar prosjektet peke på datasettets senter", async () => {
    const descriptor = getLocalDemo(DEMO);
    const dataset = await loadDataset(descriptor);
    const project = buildLocalProject(dataset, descriptor);
    expect(project.reportConfig?.hideBrokerCard).toBe(true);
    expect(project.pois).toEqual([]);
    expect(project.centerCoordinates).toEqual({
      lat: 63.43947521501401,
      lng: 10.466113792494502,
    });
  });

  it("gir instruksene Leangenbuktas navn og en uttrykkelig tomtilstand i kartet (AE1)", async () => {
    const descriptor = getLocalDemo(DEMO);
    const dataset = await loadDataset(descriptor);
    const board = buildLocalBoard(dataset, descriptor);
    const backend = buildLocalInstructions(dataset, board);
    const voice = buildLocalVoiceInstructions(dataset);

    expect(backend).toContain("KART: Det er ingen steder i kartet.");
    expect(backend).toContain("Leangenbukta");
    expect(backend).not.toContain("Nyhavna");
    expect(voice).toContain("Leangenbukta");
    expect(voice).not.toContain("Nyhavna");
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
