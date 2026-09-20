import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  getLocalDemo,
  isLocalDemoId,
  LOCAL_DEMOS,
  LOCAL_DEMO_IDS,
} from "@/lib/demo/local-board/registry";
import { LocalDatasetError } from "@/lib/demo/local-board/errors";

/**
 * Registeret er grensa mellom «hvilken demo ber flaten om» og «hvilken mappe
 * leses». Testene her holder tre løfter: bare oppførte demoer finnes, en ukjent
 * ID gir en feil i stedet for en annen demo, og den delte kjernen rører ikke
 * databasen.
 */

const DEMO_FILES = ["board.json", "sources.json", "topics.json", "faq.json", "conversations.json"];

describe("registeret over lokale demoer", () => {
  it("peker på mapper som faktisk finnes, med komplett stedsformat", async () => {
    for (const demo of LOCAL_DEMOS) {
      const files = await readdir(demo.directory);
      for (const file of DEMO_FILES) expect(files, `${demo.id}/${file}`).toContain(file);
      const hasLegacyPlaces = files.includes("places.json");
      const hasSplitPlaces = files.includes("places-audited.json") && files.includes("places-register.json");
      expect(hasLegacyPlaces || hasSplitPlaces, `${demo.id}/places`).toBe(true);
    }
  });

  it("slår opp en godkjent demo med mappe, dokument og funksjonsflagg", () => {
    const demo = getLocalDemo("nyhavna-lokal");
    expect(demo.directory).toBe("data/demo/nyhavna-lokal");
    expect(demo.readme).toMatch(/README\.md$/);
    expect(demo.features.faqProgress).toBe(true);
    expect(demo.features.revealPlaces).toBe(true);
  });

  it("avviser en ukjent ID med de godkjente listet opp, og laster ingen annen demo", () => {
    expect(() => getLocalDemo("finnes-ikke")).toThrow(LocalDatasetError);
    expect(() => getLocalDemo("finnes-ikke")).toThrow(/Ukjent lokalt datasett «finnes-ikke»/);
    expect(() => getLocalDemo("finnes-ikke")).toThrow(new RegExp(LOCAL_DEMO_IDS.join(", ")));
    expect(isLocalDemoId("finnes-ikke")).toBe(false);
    expect(isLocalDemoId("nyhavna-lokal")).toBe(true);
  });

  it("holder den delte kjernen utenfor Supabase og POI-poolen", async () => {
    const files = (await readdir("lib/demo/local-board")).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const source = await readFile(join("lib/demo/local-board", file), "utf8");
      const imports = source.split("\n").filter((line) => line.startsWith("import ") || line.startsWith("} from "));
      expect(imports.join("\n"), file).not.toMatch(/supabase/i);
    }
  });
});
