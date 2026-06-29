import { describe, it, expect } from "vitest";
import { isValidProjectIdShape, PROJECT_ID_SHAPE } from "@/lib/pipeline/project-id";

describe("isValidProjectIdShape", () => {
  it("godtar kanoniske {customer}_{slug}-IDer", () => {
    expect(isValidProjectIdShape("klp-eiendom_ferjemannsveien-10")).toBe(true);
    expect(isValidProjectIdShape("intern_wesselslokka")).toBe(true);
    expect(isValidProjectIdShape("broset-utvikling-as_wesselslokka")).toBe(true);
    // Suffiks-slug ved kollisjon (create-report-project.ts:206) er fortsatt en slug
    expect(isValidProjectIdShape("intern_wesselslokka-a1b2c3")).toBe(true);
    expect(isValidProjectIdShape("a_b")).toBe(true);
  });

  it("avviser ID uten underscore (mangler customer-ledd — typisk feilskrevet arg)", () => {
    expect(isValidProjectIdShape("wesselslokka")).toBe(false);
    expect(isValidProjectIdShape("ferjemannsveien-10")).toBe(false);
  });

  it("avviser tomt customer- eller slug-ledd", () => {
    expect(isValidProjectIdShape("_wesselslokka")).toBe(false);
    expect(isValidProjectIdShape("klp-eiendom_")).toBe(false);
    expect(isValidProjectIdShape("_")).toBe(false);
    expect(isValidProjectIdShape("")).toBe(false);
  });

  it("avviser flere underscores (slugify produserer aldri underscore i et ledd)", () => {
    expect(isValidProjectIdShape("a_b_c")).toBe(false);
    expect(isValidProjectIdShape("klp__wessel")).toBe(false);
  });

  it("avviser store bokstaver, mellomrom og ugyldige tegn", () => {
    expect(isValidProjectIdShape("KLP_wessel")).toBe(false);
    expect(isValidProjectIdShape("klp eiendom_wessel")).toBe(false);
    expect(isValidProjectIdShape("klp_wessel!")).toBe(false);
    expect(isValidProjectIdShape("klp_wessel.10")).toBe(false);
    expect(isValidProjectIdShape("klp/eiendom_wessel")).toBe(false);
  });

  it("eksponerer regexen for gjenbruk", () => {
    expect(PROJECT_ID_SHAPE.test("intern_wesselslokka")).toBe(true);
    expect(PROJECT_ID_SHAPE.test("intern")).toBe(false);
  });
});
