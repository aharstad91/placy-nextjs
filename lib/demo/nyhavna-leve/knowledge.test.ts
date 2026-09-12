import { describe, expect, it } from "vitest";
import { LEVE_POIS, LEVE_THEMES } from "./content";
import { nyhavnaKnowledge } from "./knowledge";

const allRecords = [nyhavnaKnowledge.area, ...nyhavnaKnowledge.entities];
const unplaced = nyhavnaKnowledge.entities.filter(
  (entity) => entity.mapPoiId === null,
);

describe("nyhavnaKnowledge", () => {
  it("is a serializable audit of the 7 mapped and 8 unplaced curated records", () => {
    expect(nyhavnaKnowledge.entities).toHaveLength(15);
    expect(nyhavnaKnowledge.entities.filter((entity) => entity.mapPoiId)).toHaveLength(7);
    expect(unplaced).toHaveLength(8);
    expect(JSON.parse(JSON.stringify(nyhavnaKnowledge))).toEqual(nyhavnaKnowledge);
  });

  it("binds every mapped record to exactly one curated demo POI", () => {
    const mapPoiIds = nyhavnaKnowledge.entities.flatMap((entity) =>
      entity.mapPoiId ? [entity.mapPoiId] : [],
    );

    expect(new Set(mapPoiIds).size).toBe(mapPoiIds.length);
    expect(mapPoiIds.sort()).toEqual(LEVE_POIS.map((poi) => poi.id).sort());
  });

  it("gives every unplaced theme mention a stable record without a map marker", () => {
    const unplacedNames = LEVE_THEMES.flatMap((theme) => theme.ikkePlassert ?? []);
    const searchableNames = unplaced.flatMap((entity) => [
      entity.name.toLocaleLowerCase("nb-NO"),
      ...entity.aliases.map((alias) => alias.toLocaleLowerCase("nb-NO")),
    ]);

    expect(unplacedNames).toHaveLength(8);
    for (const mention of unplacedNames) {
      const normalizedMention = mention
        .replace(/\s*\([^)]*\)\s*$/, "")
        .toLocaleLowerCase("nb-NO");
      expect(searchableNames).toContain(normalizedMention);
    }
    expect(unplaced.every((entity) => entity.mapPoiId === null)).toBe(true);
  });

  it("binds every atomic fact to a known, dated source and explicit decision", () => {
    const sourceIds = new Set(nyhavnaKnowledge.sources.map((source) => source.id));
    const factIds = new Set<string>();

    for (const record of allRecords) {
      expect(record.facts.length).toBeGreaterThan(0);
      for (const fact of record.facts) {
        expect(sourceIds.has(fact.sourceId)).toBe(true);
        expect(fact.checkedAt).toBe(nyhavnaKnowledge.checkedAt);
        expect(["confirmed", "unresolved"]).toContain(fact.verification);
        expect(factIds.has(fact.id)).toBe(false);
        factIds.add(fact.id);
      }
    }
  });

  it("keeps aliases non-empty, unique, and attached to one canonical record", () => {
    const canonicalIds = new Set(allRecords.map((record) => record.id));
    expect(canonicalIds.size).toBe(allRecords.length);

    const owners = new Map<string, string>();
    for (const record of allRecords) {
      expect(record.aliases.length).toBeGreaterThan(0);
      for (const value of [record.name, ...record.aliases]) {
        const normalized = value.trim().toLocaleLowerCase("nb-NO");
        expect(normalized).not.toBe("");
        expect(owners.get(normalized) ?? record.id).toBe(record.id);
        owners.set(normalized, record.id);
      }
    }
  });

  it("binds every relation to a known record and source", () => {
    const recordIds = new Set(allRecords.map((record) => record.id));
    const sourceIds = new Set(nyhavnaKnowledge.sources.map((source) => source.id));

    for (const record of allRecords) {
      for (const relation of record.relations) {
        expect(recordIds.has(relation.targetEntityId)).toBe(true);
        expect(sourceIds.has(relation.sourceId)).toBe(true);
        expect(relation.checkedAt).toBe(nyhavnaKnowledge.checkedAt);
        expect(["confirmed", "unresolved"]).toContain(relation.verification);
      }
    }
  });

  it("preserves planned, mixed, approximate, and unresolved distinctions", () => {
    expect(
      nyhavnaKnowledge.entities.find((entity) => entity.id === "elvepromenaden")
        ?.status,
    ).toBe("existing-with-planned-changes");
    expect(
      nyhavnaKnowledge.entities.find((entity) => entity.id === "kullkranparken")
        ?.status,
    ).toBe("planned");

    const bunkerparken = nyhavnaKnowledge.entities.find(
      (entity) => entity.id === "bunkerparken",
    );
    expect(bunkerparken?.status).toBe("unresolved");
    expect(bunkerparken?.mapPoiId).toBe("leve-bunkerparken");
    expect(
      bunkerparken?.facts.some(
        (fact) =>
          fact.verification === "unresolved" && fact.text.includes("status"),
      ),
    ).toBe(true);
  });
});
