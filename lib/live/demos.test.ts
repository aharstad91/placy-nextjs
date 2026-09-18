import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadLiveDemo, type LiveDatasetId } from "@/lib/live/demos";
import { loadDataset } from "@/lib/demo/local-board/dataset";
import { getLocalDemo } from "@/lib/demo/local-board/registry";
import { conversationTools } from "@/lib/realtime/nyhavna-conversation";
import { NYHAVNA_LABELS } from "@/lib/realtime/conversation-labels";
import { NYHAVNA_GREETING_INSTRUCTION } from "@/lib/realtime/nyhavna-greeting";
import { NYHAVNA_VOICE_INSTRUCTIONS } from "@/lib/live/voice-instructions";

/**
 * Hver demo bærer sin EGEN verktøyliste og sine egne instrukser. Testene her
 * holder to løfter: det frosne snapshotet får nøyaktig de tekstene det alltid
 * har fått, og den lokale demoen faller aldri tilbake på dem.
 */
describe("Live-demoenes egne tekster", () => {
  it("gir det frosne snapshotet Nyhavna-navnene eksplisitt", async () => {
    const demo = await loadLiveDemo("nyhavna-leve");
    expect(demo.tools).toEqual(conversationTools(NYHAVNA_LABELS));
    // Snapshotet har ingen egen stemmeinstruks: ruta bruker Nyhavnas.
    expect(demo.voiceInstructions).toBeUndefined();
  });

  it("gir den lokale demoen datasettets navn i verktøytekstene", async () => {
    const descriptor = getLocalDemo("nyhavna-lokal");
    const dataset = await loadDataset(descriptor);
    const demo = await loadLiveDemo(descriptor.id as LiveDatasetId);
    const find = demo.tools.find((tool) => tool.name === "find_project_info");
    expect(find?.description).toContain(`Søk i ${dataset.board.projectInfoLabel}:`);
    // Datasettets eget navn, ikke det frosne snapshotets faste beskrivelse.
    expect(find?.description).not.toContain(NYHAVNA_LABELS.projectInfoLabel);
    expect(demo.tools.find((tool) => tool.name === "find_places")?.description)
      .toContain(`Finn steder på ${dataset.board.name}:`);
    // Presentasjonsverktøyene ligger i samme liste; ruta setter ikke sammen noe selv.
    for (const name of ["present_neighbourhood", "find_similar_places"]) {
      expect(demo.tools.map((tool) => tool.name)).toContain(name);
    }
  });

  it("lar den lokale demoen bære både hilsen og stemmeinstruks selv", async () => {
    const demo = await loadLiveDemo("nyhavna-lokal");
    // Ruta og boardet velger fallback bare når feltet mangler; her gjør det ikke det.
    expect(demo.voiceInstructions).toBeTruthy();
    expect(demo.voiceInstructions).not.toBe(NYHAVNA_VOICE_INSTRUCTIONS);
    expect(demo.board.demoGreeting).toBeTruthy();
    expect(NYHAVNA_GREETING_INSTRUCTION).not.toContain(String(demo.board.demoGreeting));
  });
});


/**
 * Den delte kjeden skal ikke kjenne navnet på noen demo. Sjekken er en test og
 * ikke en kodegjennomgang fordi den forrige slug-sammenligningen kom tilbake
 * tre ganger: hver gang en ny funksjon trengte «bare denne demoen».
 */
describe("den delte kjeden nevner ingen demo ved navn", () => {
  const skip = (file: string) => file.includes(".test.") || file.endsWith(".d.ts");

  async function sources(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sources(path);
      return /\.tsx?$/.test(entry.name) && !skip(entry.name) ? [path] : [];
    }));
    return files.flat();
  }

  it("har ingen «nyhavna-lokal»-sammenligning igjen i komponenter eller Live-koden", async () => {
    const files = [...await sources("components"), ...await sources("lib/live"), ...await sources("lib/realtime")];
    expect(files.length).toBeGreaterThan(50);
    const offenders: string[] = [];
    for (const file of files) {
      if ((await readFile(file, "utf8")).includes('"nyhavna-lokal"')) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("gir den lokale demoen en egen slug, så rapportflaten viser splash som før", async () => {
    // `ReportReelsPage` viser splash for enhver slug som ikke er det frosne
    // snapshotets «nyhavna». Lokale demoer har sin datasett-ID som slug og
    // treffer derfor samme gren som i dag, uansett hvilket sted de gjelder.
    const demo = await loadLiveDemo("nyhavna-lokal");
    expect(demo.board.projectSlug).toBe("nyhavna-lokal");
    expect(demo.board.projectSlug).not.toBe("nyhavna");
  });
});

/**
 * To demoer i samme prosess (U4-scenario 2).
 *
 * Verktøytekstene navngir stedet, og de bygges per demo. Testene her måler at
 * navnene ikke krysser: en Leangenbukta-samtale skal aldri få et verktøy som
 * sier «Nyhavna», og omvendt — det er den feilen som ikke synes på skjermen,
 * bare i det modellen leser.
 */
describe("to lokale demoer ved siden av hverandre", () => {
  it("gir Leangenbukta sin egen innholds-ID, sine egne tekster og sitt eget board", async () => {
    const leangenbukta = await loadLiveDemo("leangenbukta-lokal");
    const nyhavna = await loadLiveDemo("nyhavna-lokal");

    expect(leangenbukta.snapshotId).toMatch(/^leangenbukta-lokal-/);
    expect(leangenbukta.snapshotId).not.toBe(nyhavna.snapshotId);
    expect(leangenbukta.board.projectSlug).toBe("leangenbukta-lokal");
    expect(leangenbukta.board.demoGreeting).not.toBe(nyhavna.board.demoGreeting);
    expect(leangenbukta.voiceInstructions).toBeTruthy();
    expect(leangenbukta.voiceInstructions).not.toBe(nyhavna.voiceInstructions);
    expect(leangenbukta.backendInstructions).not.toBe(nyhavna.backendInstructions);
    expect(leangenbukta.backendInstructions).toContain("STEDER OG REISETIDER (data):");
    expect(leangenbukta.backendInstructions).toContain("Skolekretsen for Haakon VIIs gate 14 er ikke verifisert");
    expect(leangenbukta.backendInstructions).not.toContain("KART: Det er ingen steder i kartet.");
    expect(leangenbukta.board.poisById.size).toBe(357);
  });

  it("krysser ikke verktøynavnene mellom de to demoene", async () => {
    const descriptor = getLocalDemo("leangenbukta-lokal");
    const dataset = await loadDataset(descriptor);
    const leangenbukta = await loadLiveDemo(descriptor.id as LiveDatasetId);
    const nyhavna = await loadLiveDemo("nyhavna-lokal");

    const find = leangenbukta.tools.find((tool) => tool.name === "find_project_info");
    expect(find?.description).toContain(`Søk i ${dataset.board.projectInfoLabel}:`);
    expect(find?.description).toContain("Leangenbukta");
    expect(leangenbukta.tools.find((tool) => tool.name === "find_places")?.description)
      .toContain("Finn steder på Leangenbukta:");
    for (const tool of leangenbukta.tools) {
      expect(JSON.stringify(tool), tool.name).not.toContain("Nyhavna");
    }
    for (const tool of nyhavna.tools) {
      expect(JSON.stringify(tool), tool.name).not.toContain("Leangenbukta");
    }
    // Presentasjonsverktøyene ligger i samme liste for begge demoene.
    for (const name of ["present_neighbourhood", "find_similar_places", "reveal_more_places"]) {
      expect(leangenbukta.tools.map((tool) => tool.name)).toContain(name);
    }
  });
});
