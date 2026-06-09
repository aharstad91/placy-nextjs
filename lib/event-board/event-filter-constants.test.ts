import { describe, it, expect } from "vitest";
import {
  TIME_BUCKETS,
  TIMELESS_BUCKET_LABEL,
  bucketForTime,
} from "./event-filter-constants";

describe("event-filter-constants", () => {
  it("har tre tid-bøtter i kanonisk rekkefølge med ikke-overlappende grenser", () => {
    expect(TIME_BUCKETS.map((b) => b.slot)).toEqual([
      "morning",
      "afternoon",
      "evening",
    ]);
    // Sammenhengende, ikke-overlappende dekning 0–24.
    expect(TIME_BUCKETS[0].startHour).toBe(0);
    expect(TIME_BUCKETS[0].endHour).toBe(TIME_BUCKETS[1].startHour);
    expect(TIME_BUCKETS[1].endHour).toBe(TIME_BUCKETS[2].startHour);
    expect(TIME_BUCKETS[2].endHour).toBe(24);
  });

  it("grensene matcher useKompassFilter-semantikken (morning<12, afternoon 12–17, evening≥17)", () => {
    expect(bucketForTime("00:00")).toBe("morning");
    expect(bucketForTime("08:30")).toBe("morning");
    expect(bucketForTime("11:59")).toBe("morning");
    expect(bucketForTime("12:00")).toBe("afternoon");
    expect(bucketForTime("16:59")).toBe("afternoon");
    expect(bucketForTime("17:00")).toBe("evening");
    expect(bucketForTime("23:00")).toBe("evening");
  });

  it("manglende/ugyldig tid → null (timeless, fail-open)", () => {
    expect(bucketForTime(undefined)).toBeNull();
    expect(bucketForTime("")).toBeNull();
    expect(bucketForTime("ikke-en-tid")).toBeNull();
  });

  it("eksponerer en timeless-etikett", () => {
    expect(TIMELESS_BUCKET_LABEL).toBe("Tidspunkt ikke oppgitt");
  });
});
