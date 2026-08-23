import { describe, expect, it } from "vitest";
import {
  formatHourRange,
  parseWeekdayLine,
  parseWeekdayText,
  sundayHours,
  weekdayConsensus,
} from "./opening-hours";

// Googles engelske strenger bruker U+202F (narrow no-break) og U+2009 (thin
// space) — de ekte tegnene fra cachen, ikke vanlige mellomrom.
const AM_PM = "Monday: 5:00 AM – 9:00 PM";

describe("parseWeekdayLine", () => {
  it("leser Googles engelske AM/PM-format med spesialmellomrom", () => {
    expect(parseWeekdayLine(AM_PM)).toEqual({ openMin: 300, closeMin: 21 * 60 });
  });

  it("leser norsk 24-timers format", () => {
    expect(parseWeekdayLine("mandag: 07:00–23:00")).toEqual({
      openMin: 7 * 60,
      closeMin: 23 * 60,
    });
  });

  it("delt markør arves: «1:00 – 10:00 PM» er 13–22, ikke 01–22", () => {
    // Funnet live på Pizzabakeren Ranheims søndagstider (2026-08-23): Google
    // deler PM-markøren når begge tidene er på samme halvdel av døgnet.
    expect(parseWeekdayLine("Sunday: 1:00 – 10:00 PM")).toEqual({
      openMin: 13 * 60,
      closeMin: 22 * 60,
    });
  });

  it("«12:00 AM» som stengetid er midnatt i slutten av dagen", () => {
    expect(parseWeekdayLine("Monday: 5:00 AM – 12:00 AM")).toEqual({
      openMin: 300,
      closeMin: 1440,
    });
  });

  it("døgnåpent og stengt er egne fakta", () => {
    expect(parseWeekdayLine("Monday: Open 24 hours")).toEqual({ openMin: 0, closeMin: 1440 });
    expect(parseWeekdayLine("Sunday: Closed")).toBe("closed");
    expect(parseWeekdayLine("søndag: Stengt")).toBe("closed");
  });

  it("lunsjstengt (flere intervaller) gir null — sammenslåing ville diktet", () => {
    expect(
      parseWeekdayLine("Monday: 11:30 AM – 2:00 PM, 5:00 – 9:00 PM"),
    ).toBeNull();
  });

  it("over midnatt (nattklubb) gir null — utenfor det vi lover", () => {
    expect(parseWeekdayLine("Friday: 8:00 PM – 2:00 AM")).toBeNull();
  });

  it("uleselig linje gir null, ikke kast", () => {
    expect(parseWeekdayLine("Monday: varies")).toBeNull();
    expect(parseWeekdayLine("bare tekst uten kolon")).toBeNull();
  });
});

describe("weekdayConsensus", () => {
  const dag = (line: string) => parseWeekdayLine(line);

  it("fem like hverdager gir tidene", () => {
    const days = [AM_PM, AM_PM, AM_PM, AM_PM, AM_PM, "Saturday: Closed", "Sunday: Closed"].map(dag);
    expect(weekdayConsensus(days)).toEqual({ openMin: 300, closeMin: 21 * 60 });
  });

  it("sprikende hverdager gir null — «på hverdager» må være sant for alle fem", () => {
    const days = [AM_PM, AM_PM, "Wednesday: 6:00 AM – 9:00 PM", AM_PM, AM_PM, AM_PM, AM_PM].map(dag);
    expect(weekdayConsensus(days)).toBeNull();
  });

  it("én uparselig hverdag gir null", () => {
    const days = [dag(AM_PM), null, dag(AM_PM), dag(AM_PM), dag(AM_PM), dag(AM_PM), dag(AM_PM)];
    expect(weekdayConsensus(days)).toBeNull();
  });
});

describe("parseWeekdayText + sundayHours", () => {
  it("krever nøyaktig sju linjer", () => {
    expect(parseWeekdayText(["Monday: Closed"])).toBeNull();
    expect(parseWeekdayText(undefined)).toBeNull();
  });

  it("søndag er indeks 6 i mandag-først-lista", () => {
    const days = parseWeekdayText([
      AM_PM,
      AM_PM,
      AM_PM,
      AM_PM,
      AM_PM,
      "Saturday: Closed",
      "Sunday: 11:00 AM – 5:00 PM",
    ])!;
    expect(sundayHours(days)).toEqual({ openMin: 11 * 60, closeMin: 17 * 60 });
  });
});

describe("formatHourRange", () => {
  it("hele timer skrives som på en dør", () => {
    expect(formatHourRange({ openMin: 300, closeMin: 23 * 60 })).toBe("05–23");
    expect(formatHourRange({ openMin: 300, closeMin: 1440 })).toBe("05–24");
  });

  it("halvtimer beholder minuttene", () => {
    expect(formatHourRange({ openMin: 7 * 60 + 30, closeMin: 15 * 60 })).toBe("07.30–15");
  });
});
