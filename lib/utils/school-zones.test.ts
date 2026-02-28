import { describe, it, expect } from "vitest";
import { getSchoolZone, getAllBarneskoler, getAllUngdomsskoler } from "./school-zones";

describe("getSchoolZone", () => {
  it("returns correct schools for Brøset (63.418, 10.395)", () => {
    const zone = getSchoolZone(63.418, 10.395);
    expect(zone.barneskole).toBe("SINGSAKER");
    expect(zone.ungdomsskole).toBe("ROSENBORG");
  });

  it("returns correct schools for Lilleby area (63.44, 10.44)", () => {
    const zone = getSchoolZone(63.44, 10.44);
    expect(zone.barneskole).toBe("LILLEBY");
    expect(zone.ungdomsskole).not.toBeNull();
  });

  it("returns correct schools for Nyborg area (63.41, 10.34)", () => {
    const zone = getSchoolZone(63.41, 10.34);
    expect(zone.barneskole).toBe("NYBORG");
    expect(zone.ungdomsskole).not.toBeNull();
  });

  it("returns null for coordinates outside Trondheim (Oslo)", () => {
    const zone = getSchoolZone(59.91, 10.75);
    expect(zone.barneskole).toBeNull();
    expect(zone.ungdomsskole).toBeNull();
  });
});

describe("getAllBarneskoler", () => {
  it("returns a non-empty sorted list", () => {
    const schools = getAllBarneskoler();
    expect(schools.length).toBeGreaterThan(30);
    // Verify sorted (use locale-aware comparison for Norwegian characters)
    for (let i = 1; i < schools.length; i++) {
      expect(schools[i].localeCompare(schools[i - 1], "nb")).toBeGreaterThanOrEqual(0);
    }
  });

  it("includes known schools", () => {
    const schools = getAllBarneskoler();
    expect(schools).toContain("SINGSAKER");
    expect(schools).toContain("LADE");
    expect(schools).toContain("BYÅSEN");
  });
});

describe("getAllUngdomsskoler", () => {
  it("returns 18 ungdomsskoler", () => {
    const schools = getAllUngdomsskoler();
    expect(schools.length).toBe(18);
  });
});
