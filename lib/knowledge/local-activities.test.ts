import { describe, expect, it } from "vitest";
import { activityAnswer, activeLocalActivities } from "@/lib/knowledge/local-activities";
import { generateCategoryFaq } from "@/lib/generators/faq-generator";
import { LocalActivitySchema } from "@/lib/knowledge/local-activities";
import pilot from "@/data/knowledge/broset-activities.json";

const now = Date.parse("2026-09-07T00:00:00Z");
describe("shared local activities", () => {
  it("reuses the same corrected relationship in two questions, keeping its source", () => {
    const facts = structuredClone(pilot.facts);
    facts[0].structured_data.venue = "på et korrigert øvingssted";
    for (const id of ["oppvekst-fritid", "idrettslag"]) {
      const answer = activityAnswer(id, facts, now)!;
      expect(answer.answer).toContain("på et korrigert øvingssted");
      expect(answer.knowledgeSources[0].id).toBe(facts[0].id);
      expect(answer.knowledgeSources[0].url).toBe(facts[0].source_url);
    }
    expect(activityAnswer("idrettslag", facts, now)!.answer).not.toContain("Skolekorps");
    expect(activityAnswer("oppvekst-fritid", facts, now)!.answer).toContain("Åsvang skole");
  });

  it("omits missing, unreviewed, unsafe, expired and future-reviewed facts", () => {
    const fact = pilot.facts[0];
    for (const invalid of [
      {}, { ...fact, confidence: "unverified" }, { ...fact, display_ready: false },
      { ...fact, source_url: "javascript:alert(1)" }, { ...fact, verified_at: null },
      { ...fact, verified_at: "2027-01-01T00:00:00Z" },
    ]) expect(activeLocalActivities([invalid], now)).toEqual([]);
    expect(activityAnswer("idrettslag", [fact], Date.parse(fact.structured_data.validUntil))).toBeUndefined();
    expect(activityAnswer("idrettslag", [], now)).toBeUndefined();
  });

  it("keeps board curation authoritative and unrelated questions unchanged", () => {
    const input = {
      themeId: "barn-oppvekst", categoryIds: ["skole"], pois: [], allPois: [],
      center: { lat: 63.422, lng: 10.450 },
      localActivities: pilot.facts.map((f) => LocalActivitySchema.parse({
        ...f, verified_at: "2020-01-01T00:00:00Z",
        structured_data: { ...f.structured_data, validUntil: "2099-01-01T00:00:00Z" },
      })),
    };
    const firstBoard = generateCategoryFaq(input);
    const secondBoard = generateCategoryFaq({ ...input, center: { lat: 63.423, lng: 10.451 } });
    expect(firstBoard).toEqual(secondBoard);
    expect(firstBoard).toHaveLength(1);
    expect(firstBoard[0].source).toBe("knowledge");
    expect(generateCategoryFaq({ ...input, localActivities: [] })).toEqual([]);
    const curated = generateCategoryFaq({ ...input, curated: [{ id: "oppvekst-fritid", svar: "Eget svar" }] });
    expect(curated[0].answer).toBe("Eget svar");
    expect(curated[0].knowledgeSources).toBeUndefined();
  });
});
