import { describe, expect, it } from "vitest";
import { nextWeekdayRushHour, osloParts } from "./oslo-time";

describe("osloParts", () => {
  it("leser veggklokka i Oslo, ikke i UTC", () => {
    // 2026-06-15T22:30Z er 16. juni 00:30 norsk tid (sommertid, +02:00).
    const p = osloParts(new Date("2026-06-15T22:30:00Z"));
    expect([p.year, p.month, p.day, p.hour, p.minute]).toEqual([2026, 6, 16, 0, 30]);
  });

  it("håndterer vintertid (+01:00)", () => {
    const p = osloParts(new Date("2026-01-15T22:30:00Z"));
    expect([p.month, p.day, p.hour]).toEqual([1, 15, 23]);
  });

  it("normaliserer midnatt til time 0, ikke 24", () => {
    // Intl med hour12:false gir «24» for midnatt i noen runtimes.
    expect(osloParts(new Date("2026-06-15T22:00:00Z")).hour).toBe(0);
  });
});

describe("nextWeekdayRushHour", () => {
  it("gir neste dag når den er en hverdag", () => {
    // Mandag 2026-08-24 → tirsdag 25.
    expect(nextWeekdayRushHour(new Date("2026-08-24T09:00:00Z"))).toBe(
      "2026-08-25T08:00:00+02:00",
    );
  });

  it("hopper over helga fra fredag", () => {
    // Fredag 2026-08-21 → mandag 24.
    expect(nextWeekdayRushHour(new Date("2026-08-21T09:00:00Z"))).toBe(
      "2026-08-24T08:00:00+02:00",
    );
  });

  it("hopper over helga fra lørdag og søndag", () => {
    for (const day of ["2026-08-22T09:00:00Z", "2026-08-23T09:00:00Z"]) {
      expect(nextWeekdayRushHour(new Date(day))).toBe("2026-08-24T08:00:00+02:00");
    }
  });

  it("går ALLTID en dag fram, også tidlig på en hverdagsmorgen", () => {
    // Kjører provisjoneringen mandag kl. 05:00 norsk tid, er dagens 08:00
    // fortsatt i framtida — men et tidspunkt som passerer mens faktaene er i
    // bruk kan ikke etterprøves, så svaret er tirsdag.
    expect(nextWeekdayRushHour(new Date("2026-08-24T03:00:00Z"))).toBe(
      "2026-08-25T08:00:00+02:00",
    );
  });

  it("bruker vintertidens offset om vinteren", () => {
    // Torsdag 2026-01-15 → fredag 16., +01:00.
    expect(nextWeekdayRushHour(new Date("2026-01-15T09:00:00Z"))).toBe(
      "2026-01-16T08:00:00+01:00",
    );
  });

  it("treffer riktig offset dagen etter sommertidsomstillingen", () => {
    // Sommertid starter siste søndag i mars (2026: 29. mars). Mandag 30. er
    // +02:00; en hardkodet offset ville bommet med en time.
    expect(nextWeekdayRushHour(new Date("2026-03-27T09:00:00Z"))).toBe(
      "2026-03-30T08:00:00+02:00",
    );
  });

  it("treffer riktig offset dagen etter overgangen til vintertid", () => {
    // Vintertid starter siste søndag i oktober (2026: 25. oktober).
    expect(nextWeekdayRushHour(new Date("2026-10-23T09:00:00Z"))).toBe(
      "2026-10-26T08:00:00+01:00",
    );
  });

  it("krysser årsskiftet uten å havne i feil år", () => {
    // Torsdag 31. desember 2026 → fredag 1. januar 2027.
    expect(nextWeekdayRushHour(new Date("2026-12-31T09:00:00Z"))).toBe(
      "2027-01-01T08:00:00+01:00",
    );
  });
});
