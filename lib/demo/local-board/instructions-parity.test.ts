import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { loadDataset } from "@/lib/demo/local-board/dataset";
import { buildLocalBoard } from "@/lib/demo/local-board/board";
import { buildLocalInstructions } from "@/lib/demo/local-board/voice";
import { buildLocalVoiceInstructions } from "@/lib/demo/local-board/voice-instructions";
import { getLocalDemo } from "@/lib/demo/local-board/registry";
import { writeTestDemo } from "@/lib/demo/local-board/__fixtures__/test-demo";

const NYHAVNA = getLocalDemo("nyhavna-lokal");

/**
 * Uttrekket til en delt kjerne flyttet stedsnavn, delområde-regler og ordvalg
 * fra koden til datasettet. Det er en refaktorering, ikke en innholdsendring:
 * guiden skal få NØYAKTIG de samme setningene som før.
 *
 * Fixturen er tatt opp fra koden slik den var før uttrekket
 * (`__fixtures__/*.baseline.txt`). Datablokkene er klippet vekk — de endrer seg
 * hver gang noen skriver innhold, og det er prosaen parameteriseringen kunne
 * ødelagt.
 */
const DATA_MARKER = "(data): ";
const CATALOG_MARKER = "\nSPØRSMÅL OG SVAR (data, per tema):";

export function redactData(text: string): string {
  return text
    .split(CATALOG_MARKER)[0]
    .split("\n")
    .map((line) => {
      const at = line.indexOf(DATA_MARKER);
      return at === -1 ? line : `${line.slice(0, at + DATA_MARKER.length)}…`;
    })
    .join("\n");
}

describe("tekstlig paritet med koden før uttrekket", () => {
  it("gir Nyhavna nøyaktig samme backend-instruks", async () => {
    const dataset = await loadDataset(NYHAVNA);
    const instructions = buildLocalInstructions(dataset, buildLocalBoard(dataset, NYHAVNA));
    const baseline = await readFile("lib/demo/local-board/__fixtures__/nyhavna-backend-instructions.baseline.txt", "utf8");
    expect(redactData(instructions)).toBe(baseline);
  });

  it("gir Nyhavna nøyaktig samme rolleinstruks til stemmen", async () => {
    const dataset = await loadDataset(NYHAVNA);
    const baseline = await readFile("lib/demo/local-board/__fixtures__/nyhavna-voice-instructions.baseline.txt", "utf8");
    expect(buildLocalVoiceInstructions(dataset)).toBe(baseline);
  });

  it("lar et annet datasett stå uten Nyhavnas setninger", async () => {
    const other = await writeTestDemo();
    const dataset = await loadDataset(other);
    const instructions = buildLocalInstructions(dataset, buildLocalBoard(dataset, other));
    expect(instructions).not.toMatch(/Nyhavna/);
    expect(buildLocalVoiceInstructions(dataset)).not.toMatch(/Nyhavna/);
    // Uten setninger i datasettet blir linjene borte, ikke tomme plassholdere.
    expect(instructions).not.toMatch(/OMFANG:/);
    expect(instructions).not.toMatch(/BYDEL OG DELOMRÅDER:/);
    expect(instructions).toContain("INNGANG: Hilsenen tilbyr to retninger. Ved brede spørsmål");
    expect(instructions).toContain("KART: Det er ingen steder i kartet.");
  });
});
