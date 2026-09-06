import { describe, it, expect, vi, afterEach } from "vitest";

import { computeIsOpen } from "./useOpeningHours";

/**
 * Åpent/stengt-markøren på POI-kortet. Regresjonsvernet her handler om ÉN ting:
 * markøren skal ikke være avhengig av hvilket språk Google svarte på.
 *
 * Fram til 2026-09-06 fant `computeIsOpen` dagens linje ved å matche «Monday»
 * og leste bare AM/PM-tider. Da nærhetssøket begynte å spørre på norsk
 * (`SEARCH_LANGUAGE`), ville hver eneste linje sluttet å matche — uten en
 * eneste feilmelding. Markøren ville bare forsvunnet fra alle kort.
 */

/** Sju linjer, mandag først — Google Places-kontrakten. */
function uke(språk: "en" | "no", tider: string): string[] {
  const dager =
    språk === "en"
      ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
      : ["mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag"];
  return dager.map((d) => `${d}: ${tider}`);
}

/** Onsdag 2026-09-02 kl. 14:00 lokal tid. */
function frysTiden(timer: number, minutter = 0) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 2, timer, minutter));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("computeIsOpen — samme svar på norsk og engelsk", () => {
  it("åpent midt i intervallet, uansett språk", () => {
    frysTiden(14);
    expect(computeIsOpen(uke("en", "8:00 AM – 5:00 PM"))).toBe(true);
    expect(computeIsOpen(uke("no", "08:00–17:00"))).toBe(true);
  });

  it("stengt etter stengetid, uansett språk", () => {
    frysTiden(19);
    expect(computeIsOpen(uke("en", "8:00 AM – 5:00 PM"))).toBe(false);
    expect(computeIsOpen(uke("no", "08:00–17:00"))).toBe(false);
  });

  it("«Closed» og «Stengt» betyr det samme", () => {
    frysTiden(14);
    expect(computeIsOpen(uke("en", "Closed"))).toBe(false);
    expect(computeIsOpen(uke("no", "Stengt"))).toBe(false);
  });

  it("«Open 24 hours» og «Døgnåpent» betyr det samme", () => {
    frysTiden(3);
    expect(computeIsOpen(uke("en", "Open 24 hours"))).toBe(true);
    expect(computeIsOpen(uke("no", "Døgnåpent"))).toBe(true);
  });
});

describe("computeIsOpen — dagen finnes ved posisjon, ikke ved dagsnavn", () => {
  it("leser ONSDAGENS linje på en onsdag, selv når dagsnavnene er norske", () => {
    frysTiden(14);
    const uken = [
      "mandag: 08:00–17:00",
      "tirsdag: 08:00–17:00",
      "onsdag: Stengt",
      "torsdag: 08:00–17:00",
      "fredag: 08:00–17:00",
      "lørdag: 10:00–16:00",
      "søndag: Stengt",
    ];
    expect(computeIsOpen(uken)).toBe(false);
  });

  it("søndag leses fra SISTE linje (JS teller søndag som 0, Google som 6)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 6, 14, 0)); // søndag
    const uken = [
      "mandag: Stengt",
      "tirsdag: Stengt",
      "onsdag: Stengt",
      "torsdag: Stengt",
      "fredag: Stengt",
      "lørdag: Stengt",
      "søndag: 12:00–18:00",
    ];
    expect(computeIsOpen(uken)).toBe(true);
  });
});

describe("computeIsOpen — det som IKKE skal gå tapt", () => {
  it("lunsjstengt: to intervaller på samme dag holdes fra hverandre", () => {
    const lunsj = uke("no", "11:00–14:00, 17:00–21:00");
    frysTiden(12);
    expect(computeIsOpen(lunsj)).toBe(true);
    frysTiden(15, 30);
    expect(computeIsOpen(lunsj)).toBe(false);
    frysTiden(18);
    expect(computeIsOpen(lunsj)).toBe(true);
  });

  it("åpent over midnatt: nattklubben er åpen klokka 01", () => {
    frysTiden(1);
    expect(computeIsOpen(uke("no", "18:00–02:00"))).toBe(true);
  });

  it("uleselig linje gir «vet ikke», ikke «stengt»", () => {
    frysTiden(14);
    expect(computeIsOpen(uke("no", "etter avtale"))).toBeUndefined();
  });

  it("kortere liste enn sju dager gir «vet ikke»", () => {
    frysTiden(14);
    expect(computeIsOpen(["mandag: 08:00–17:00"])).toBeUndefined();
  });
});
