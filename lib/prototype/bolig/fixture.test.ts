import { describe, expect, it } from "vitest";
import { BOLIG_FIXTURE } from "@/lib/prototype/bolig/fixture";
import type { TopicId } from "@/lib/prototype/bolig/contract";

const RANHEIM_BBOX = { latMin: 63.41, latMax: 63.45, lngMin: 10.48, lngMax: 10.56 };

describe("BOLIG_FIXTURE", () => {
  it("has unique IDs across places, seller, unknowns and sources", () => {
    const ids = [
      ...BOLIG_FIXTURE.places.map(p => p.id),
      ...BOLIG_FIXTURE.seller.map(s => s.id),
      ...BOLIG_FIXTURE.unknowns.map(u => u.id),
      ...BOLIG_FIXTURE.sources.map(s => s.id),
    ];
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("references only source IDs that exist in fixture.sources", () => {
    const validSourceIds = new Set(BOLIG_FIXTURE.sources.map(s => s.id));
    for (const place of BOLIG_FIXTURE.places) {
      for (const id of place.sourceIds) expect(validSourceIds.has(id)).toBe(true);
      for (const fact of place.facts) {
        for (const id of fact.sourceIds) expect(validSourceIds.has(id)).toBe(true);
      }
      if (place.walkSourceId) expect(validSourceIds.has(place.walkSourceId)).toBe(true);
    }
    for (const topic of BOLIG_FIXTURE.topics) {
      for (const id of topic.sourceIds) expect(validSourceIds.has(id)).toBe(true);
    }
    for (const unknown of BOLIG_FIXTURE.unknowns) {
      for (const id of unknown.sourceIds) expect(validSourceIds.has(id)).toBe(true);
    }
  });

  it("gives every documented fact at least one source and a checkedAt date", () => {
    for (const place of BOLIG_FIXTURE.places) {
      for (const fact of place.facts) {
        if (fact.provenance !== "documented") continue;
        expect(fact.sourceIds.length).toBeGreaterThan(0);
        expect(fact.checkedAt).toBeTruthy();
      }
    }
  });

  it("marks every seller note as example provenance", () => {
    for (const note of BOLIG_FIXTURE.seller) {
      expect(note.provenance).toBe("example");
    }
  });

  it("never invents a URL that doesn't start with https://", () => {
    for (const source of BOLIG_FIXTURE.sources) {
      if (source.url) expect(source.url.startsWith("https://")).toBe(true);
    }
  });

  it("covers every topic (except selger) with at least 3 places", () => {
    const topicsToCheck: TopicId[] = ["dagligvare", "barn", "natur", "kollektiv", "mat"];
    for (const topic of topicsToCheck) {
      const count = BOLIG_FIXTURE.places.filter(p => p.topics.includes(topic)).length;
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  it("only mentions 'skolekrets' inside unknowns, never as an asserted fact", () => {
    const haystacks: string[] = [
      ...BOLIG_FIXTURE.places.flatMap(p => p.facts.map(f => f.text)),
      ...BOLIG_FIXTURE.topics.map(t => t.text),
      ...BOLIG_FIXTURE.seller.map(s => s.text),
      BOLIG_FIXTURE.house.intro,
      ...BOLIG_FIXTURE.house.facts.map(f => f.text),
    ];
    for (const text of haystacks) {
      expect(text.toLocaleLowerCase("nb")).not.toContain("skolekrets");
    }
    const unknownMentions = BOLIG_FIXTURE.unknowns.filter(
      u => u.question.toLocaleLowerCase("nb").includes("skolekrets") || u.answer.toLocaleLowerCase("nb").includes("skolekrets")
    );
    expect(unknownMentions.length).toBeGreaterThan(0);
  });

  it("keeps every place within the Ranheim bounding box", () => {
    for (const place of BOLIG_FIXTURE.places) {
      expect(place.lat).toBeGreaterThanOrEqual(RANHEIM_BBOX.latMin);
      expect(place.lat).toBeLessThanOrEqual(RANHEIM_BBOX.latMax);
      expect(place.lng).toBeGreaterThanOrEqual(RANHEIM_BBOX.lngMin);
      expect(place.lng).toBeLessThanOrEqual(RANHEIM_BBOX.lngMax);
    }
  });

  it("gives every place a measured walk time from Mapbox", () => {
    for (const place of BOLIG_FIXTURE.places) {
      expect(place.walkMinutes).toBeGreaterThanOrEqual(1);
      expect(place.walkSourceId).toBe("src-mapbox-walk");
    }
  });
});
