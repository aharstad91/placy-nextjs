import { describe, expect, it } from "vitest";
import { isPlausibleKretsSchool, pickKretsSchool } from "./school-facts";
import type { SkoleRegisterFacts } from "@/lib/editorial/udir-register";

function skole(over: Partial<SkoleRegisterFacts> = {}): SkoleRegisterFacts {
  return {
    kilde: "nsr",
    orgnr: "1",
    navn: "Ranheim skole",
    trinnFra: 1,
    trinnTil: 7,
    elevtall: 486,
    ansatte: null,
    offentlig: true,
    maalform: "Bokmål",
    grunnskole: true,
    videregaaende: false,
    adresse: null,
    koordinat: null,
    url: null,
    oppdatert: null,
    aktiv: true,
    ...over,
  };
}

describe("pickKretsSchool", () => {
  it("tar det entydige treffet uten å se på navnet", () => {
    // «RANHEIM» treffer bare «Ranheim skole», som verken sier barne- eller
    // ungdomsskole i navnet. Ett treff er svaret.
    const treff = [{ navn: "Ranheim skole" }];
    expect(pickKretsSchool("barneskole", treff)).toBe(treff[0]);
  });

  it("skiller barne- fra ungdomsskole når kretsnavnet treffer flere", () => {
    // «CHARLOTTENLUND» treffer tre enheter i NSR — barneskolen, ungdomsskolen
    // og den videregående. Ordet i navnet er det eneste som skiller dem.
    const treff = [
      { navn: "Charlottenlund barneskole" },
      { navn: "Charlottenlund ungdomsskole" },
      { navn: "Charlottenlund videregående skole" },
    ];
    expect(pickKretsSchool("ungdomsskole", treff)?.navn).toBe("Charlottenlund ungdomsskole");
    expect(pickKretsSchool("barneskole", treff)?.navn).toBe("Charlottenlund barneskole");
  });

  it("gjetter ALDRI når flere treff bærer samme ord", () => {
    // Et feil kretssvar er verre enn ingen krets: det er den ene opplysningen
    // på boardet en kjøper tar en beslutning på.
    const treff = [
      { navn: "Nardo barneskole" },
      { navn: "Nardo barneskole avd Sør" },
    ];
    expect(pickKretsSchool("barneskole", treff)).toBeNull();
  });

  it("gir null for tom liste", () => {
    expect(pickKretsSchool("barneskole", [])).toBeNull();
  });
});

describe("isPlausibleKretsSchool", () => {
  it("godtar barneskolen når registeret sier at den starter på 1. trinn", () => {
    expect(isPlausibleKretsSchool("barneskole", skole())).toBe(true);
  });

  it("godtar en 1–10-skole for begge trinn", () => {
    const kombinert = skole({ navn: "Markaplassen skole", trinnFra: 1, trinnTil: 10 });
    expect(isPlausibleKretsSchool("barneskole", kombinert)).toBe(true);
    expect(isPlausibleKretsSchool("ungdomsskole", kombinert)).toBe(true);
  });

  it("avviser en barneskole som ungdomsskole", () => {
    expect(isPlausibleKretsSchool("ungdomsskole", skole({ trinnFra: 1, trinnTil: 7 }))).toBe(
      false,
    );
  });

  it("avviser en videregående som kretsskole uansett trinn", () => {
    // Navnematchen kan lande på «Charlottenlund videregående skole»; kretsen
    // gjelder aldri videregående, og et slikt svar ville vært et løfte vi ikke
    // har dekning for.
    const vgs = skole({
      navn: "Charlottenlund videregående skole",
      trinnFra: null,
      trinnTil: null,
      grunnskole: false,
      videregaaende: true,
    });
    expect(isPlausibleKretsSchool("ungdomsskole", vgs)).toBe(false);
  });

  it("avviser en nedlagt enhet", () => {
    expect(isPlausibleKretsSchool("barneskole", skole({ aktiv: false }))).toBe(false);
  });

  it("faller tilbake på grunnskole-flagget når trinn mangler i registeret", () => {
    const utenTrinn = skole({ trinnFra: null, trinnTil: null });
    expect(isPlausibleKretsSchool("barneskole", utenTrinn)).toBe(true);
    expect(isPlausibleKretsSchool("barneskole", { ...utenTrinn, grunnskole: false })).toBe(false);
  });
});
