import { describe, it, expect } from "vitest";
import {
  ReportTierSchema,
  OptionalReportTierSchema,
} from "./report-tier-schema";

describe("ReportTierSchema", () => {
  it("godtar nivå 1, 2 og 3", () => {
    expect(ReportTierSchema.parse(1)).toBe(1);
    expect(ReportTierSchema.parse(2)).toBe(2);
    expect(ReportTierSchema.parse(3)).toBe(3);
  });

  it("avviser tall utenfor 1–3", () => {
    expect(ReportTierSchema.safeParse(0).success).toBe(false);
    expect(ReportTierSchema.safeParse(4).success).toBe(false);
    expect(ReportTierSchema.safeParse(-1).success).toBe(false);
  });

  it("avviser string-representasjon (\"3\")", () => {
    expect(ReportTierSchema.safeParse("3").success).toBe(false);
    expect(ReportTierSchema.safeParse("1").success).toBe(false);
  });

  it("avviser null og objekter", () => {
    expect(ReportTierSchema.safeParse(null).success).toBe(false);
    expect(ReportTierSchema.safeParse({}).success).toBe(false);
  });
});

describe("OptionalReportTierSchema", () => {
  it("godtar undefined/manglende felt (nivå 1-default)", () => {
    expect(OptionalReportTierSchema.parse(undefined)).toBeUndefined();
  });

  it("godtar gyldige nivåer", () => {
    expect(OptionalReportTierSchema.parse(2)).toBe(2);
  });

  it("avviser ugyldige verdier selv som optional", () => {
    expect(OptionalReportTierSchema.safeParse(4).success).toBe(false);
    expect(OptionalReportTierSchema.safeParse("2").success).toBe(false);
  });
});
