import { describe, it, expect } from "vitest";
import { getIcon } from "@/lib/utils/map-icons";
import { MapPin } from "lucide-react";
import {
  ANNET_GROUP_ID,
  ASSIGNED_TERM_IDS,
  MIDTBYEN_GROUPS,
  groupForStore,
} from "./categories";
import storesFile from "./stores.json";

const stores = storesFile.stores as Array<{ name: string; termIds: number[] }>;
const sourceTermIds = storesFile.categories.map((c) => c.termId);

describe("MIDTBYEN_GROUPS", () => {
  it("har etikett og gyldig farge på hver gruppe", () => {
    for (const group of MIDTBYEN_GROUPS) {
      expect(group.label.length, group.id).toBeGreaterThan(0);
      expect(group.color, group.id).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("bruker ikonnavn som faktisk finnes i ikonkartet", () => {
    // getIcon faller stille tilbake til MapPin for ukjente navn. Uten denne
    // testen ville en skrivefeil gitt sju identiske grå pinner i stedet for
    // sju gjenkjennelige kategorier — og ingenting ville feilet.
    for (const group of MIDTBYEN_GROUPS) {
      expect(getIcon(group.icon), `${group.id} (${group.icon})`).not.toBe(MapPin);
    }
  });

  it("gir hver gruppe sin egen farge", () => {
    const colors = new Set(MIDTBYEN_GROUPS.map((g) => g.color));
    expect(colors.size).toBe(MIDTBYEN_GROUPS.length);
  });

  it("inneholder «Annet»", () => {
    expect(MIDTBYEN_GROUPS.map((g) => g.id)).toContain(ANNET_GROUP_ID);
  });
});

describe("dekning av kildens termer", () => {
  it("tilordner alle 28 filtertermene i kilden", () => {
    expect(sourceTermIds).toHaveLength(28);
    const missing = sourceTermIds.filter((t) => !ASSIGNED_TERM_IDS.includes(t));
    expect(missing).toEqual([]);
  });

  it("tilordner ikke termer som ikke finnes i kilden", () => {
    // En tilordning uten term er død vekt som lurer neste leser til å tro at
    // kilden har en kategori den ikke har.
    const extra = ASSIGNED_TERM_IDS.filter((t) => !sourceTermIds.includes(t));
    expect(extra).toEqual([]);
  });

  it("peker hver tilordning på en gruppe som finnes", () => {
    const ids = new Set(MIDTBYEN_GROUPS.map((g) => g.id));
    for (const termId of ASSIGNED_TERM_IDS) {
      expect(ids.has(groupForStore([termId]).id), `term ${termId}`).toBe(true);
    }
  });
});

describe("groupForStore", () => {
  it("velger termen som sier mest om hva butikken er", () => {
    // Sport & Fritid (101) mot generiske sortimentstermer.
    expect(groupForStore([22, 23, 14, 101]).id).toBe("sport-fritid");
  });

  it("lar en enkelt tung term slå mange lette", () => {
    // Frisør alene definerer butikken; Dame/Herre gjør det ikke.
    expect(groupForStore([22, 23, 21, 20, 146]).id).toBe("helse-velvare");
  });

  it("gir «Annet» for tom termliste", () => {
    expect(groupForStore([]).id).toBe(ANNET_GROUP_ID);
  });

  it("gir «Annet» for ukjent term uten å kaste", () => {
    // 13 står på 140 av 147 oppføringer og er ikke et kategorifilter.
    expect(groupForStore([13, 999]).id).toBe(ANNET_GROUP_ID);
  });

  it("ignorerer ukjente termer når det finnes en kjent", () => {
    expect(groupForStore([13, 146]).id).toBe("helse-velvare");
  });

  it("er uavhengig av rekkefølgen termene kommer i", () => {
    expect(groupForStore([22, 101, 14]).id).toBe(groupForStore([14, 22, 101]).id);
  });

  it("gir samme svar for samme vekt uansett rekkefølge", () => {
    // Dame (22) og Herre (23) har lik vekt. Uten et deterministisk oppgjør
    // ville tilordningen kunnet variere mellom kjøringer.
    expect(groupForStore([22, 23])).toEqual(groupForStore([23, 22]));
  });
});

describe("mot det ekte datasettet", () => {
  it("plasserer alle 147 butikkene", () => {
    expect(stores).toHaveLength(147);
    const placed = stores.map((s) => groupForStore(s.termIds));
    expect(placed.filter(Boolean)).toHaveLength(147);
  });

  it("teller hver butikk nøyaktig én gang", () => {
    // POI.category er ett felt. Havnet en butikk i to grupper, ville den vært
    // to punkter på kartet.
    const perGroup = new Map<string, number>();
    for (const store of stores) {
      const id = groupForStore(store.termIds).id;
      perGroup.set(id, (perGroup.get(id) ?? 0) + 1);
    }
    const sum = [...perGroup.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(stores.length);
  });

  it("etterlater ingen tom gruppe", () => {
    // adaptBoardData dropper kategorier uten POI-er, så en tom gruppe ville
    // blitt et kategorikort som forsvinner uten forklaring.
    const used = new Set(stores.map((s) => groupForStore(s.termIds).id));
    const empty = MIDTBYEN_GROUPS.filter((g) => !used.has(g.id));
    expect(empty.map((g) => g.id)).toEqual([]);
  });

  it("legger de tre butikkene uten kategori i «Annet»", () => {
    const annet = stores
      .filter((s) => groupForStore(s.termIds).id === ANNET_GROUP_ID)
      .map((s) => s.name)
      .sort();
    expect(annet).toEqual([
      "7-Eleven Nordre",
      "Trondheim parkering",
      "Trondheim trafikkskole",
    ]);
  });

  it("holder filialer av samme kjede i samme gruppe", () => {
    // Normal-filialene er tagget ulikt i kilden (Byhaven mangler Leker/Hobby).
    // Splittes de, står samme logo i to kategorier i demoen.
    const normal = stores.filter((s) => s.name.startsWith("Normal "));
    expect(normal.length).toBeGreaterThan(1);
    const groups = new Set(normal.map((s) => groupForStore(s.termIds).id));
    expect([...groups]).toHaveLength(1);
  });
});
