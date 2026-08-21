import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  API_SKUS,
  DEFAULT_DAILY_CAPS,
  USD_PER_1000,
  capForSku,
  envVarForSku,
  vurderBelastning,
  summerLedger,
  belastApiKall,
  lesForbruk,
  forbruksrapport,
  idag,
  ApiBudgetExceededError,
} from "@/lib/api-budget";

describe("capForSku", () => {
  it("bruker default når env ikke er satt", () => {
    expect(capForSku("gemini-grounding", {})).toBe(DEFAULT_DAILY_CAPS["gemini-grounding"]);
  });

  it("lar env heve taket bevisst", () => {
    expect(capForSku("places-nearby", { PLACY_CAP_PLACES_NEARBY: "5000" })).toBe(5000);
  });

  it("godtar 0 som gyldig tak — det slår kilden helt av", () => {
    expect(capForSku("gemini-video", { PLACY_CAP_GEMINI_VIDEO: "0" })).toBe(0);
  });

  it("faller tilbake til default ved ugyldig verdi", () => {
    // En skrivefeil må ikke tolkes som «ubegrenset».
    expect(capForSku("places-nearby", { PLACY_CAP_PLACES_NEARBY: "mange" })).toBe(
      DEFAULT_DAILY_CAPS["places-nearby"],
    );
    expect(capForSku("places-nearby", { PLACY_CAP_PLACES_NEARBY: "-5" })).toBe(
      DEFAULT_DAILY_CAPS["places-nearby"],
    );
  });

  it("navngir env-variabelen forutsigbart", () => {
    expect(envVarForSku("places-details-enterprise")).toBe("PLACY_CAP_PLACES_DETAILS_ENTERPRISE");
  });
});

describe("standardtakene", () => {
  it("holder Gemini-grounding under gratiskvoten på 1 500", () => {
    expect(DEFAULT_DAILY_CAPS["gemini-grounding"]).toBeLessThan(1500);
  });

  it("har Veo på null — den skal aldri fyre av utilsiktet", () => {
    expect(DEFAULT_DAILY_CAPS["gemini-video"]).toBe(0);
  });

  it("dekker hver SKU med både tak og pris", () => {
    for (const sku of API_SKUS) {
      expect(DEFAULT_DAILY_CAPS[sku]).toBeTypeOf("number");
      expect(USD_PER_1000[sku]).toBeTypeOf("number");
    }
  });
});

describe("vurderBelastning", () => {
  it("tillater kall under taket", () => {
    expect(vurderBelastning(10, 5, 100).tillatt).toBe(true);
  });

  it("tillater kallet som treffer taket eksakt", () => {
    expect(vurderBelastning(95, 5, 100).tillatt).toBe(true);
  });

  it("avviser kallet som ville krysset taket", () => {
    expect(vurderBelastning(96, 5, 100).tillatt).toBe(false);
  });

  it("avviser alt når taket er null", () => {
    expect(vurderBelastning(0, 1, 0).tillatt).toBe(false);
  });

  it("rapporterer aldri negativt gjenstående", () => {
    expect(vurderBelastning(150, 1, 100).gjenstaende).toBe(0);
  });
});

describe("summerLedger", () => {
  it("summerer kall per SKU", () => {
    const sum = summerLedger([
      JSON.stringify({ sku: "places-nearby", n: 3 }),
      JSON.stringify({ sku: "places-nearby", n: 2 }),
      JSON.stringify({ sku: "gemini-grounding", n: 10 }),
    ]);
    expect(sum).toEqual({ "places-nearby": 5, "gemini-grounding": 10 });
  });

  it("hopper over korrupte linjer i stedet for å velte regnskapet", () => {
    // Halvskrevet linje kan oppstå når to scripts skriver samtidig.
    const sum = summerLedger([
      JSON.stringify({ sku: "places-nearby", n: 3 }),
      '{"sku":"places-nea',
      "",
      JSON.stringify({ sku: "places-nearby", n: 1 }),
    ]);
    expect(sum["places-nearby"]).toBe(4);
  });

  it("ignorerer linjer uten gyldig antall", () => {
    const sum = summerLedger([JSON.stringify({ sku: "places-nearby", n: "tre" })]);
    expect(sum["places-nearby"]).toBeUndefined();
  });
});

describe("belastApiKall (med ekte ledger-fil)", () => {
  let dir: string;
  const gamleEnv = { ...process.env };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "placy-budsjett-"));
    process.env.PLACY_API_LEDGER_DIR = dir;
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    process.env = { ...gamleEnv };
  });

  it("teller opp forbruket på tvers av kall", () => {
    process.env.PLACY_CAP_PLACES_NEARBY = "10";
    belastApiKall("places-nearby", 3);
    belastApiKall("places-nearby", 2);
    expect(lesForbruk()["places-nearby"]).toBe(5);
  });

  it("kaster når taket nås, og teller ikke det avviste kallet", () => {
    process.env.PLACY_CAP_PLACES_NEARBY = "5";
    belastApiKall("places-nearby", 5);
    expect(() => belastApiKall("places-nearby", 1)).toThrow(ApiBudgetExceededError);
    expect(lesForbruk()["places-nearby"]).toBe(5);
  });

  it("stopper Veo på første kall med standardtaket", () => {
    expect(() => belastApiKall("gemini-video", 1)).toThrow(ApiBudgetExceededError);
  });

  it("holder SKU-ene adskilt", () => {
    process.env.PLACY_CAP_PLACES_NEARBY = "1";
    belastApiKall("places-nearby", 1);
    expect(() => belastApiKall("places-text", 1)).not.toThrow();
  });

  it("feilmeldingen sier hvordan taket heves", () => {
    process.env.PLACY_CAP_PLACES_TEXT = "0";
    expect(() => belastApiKall("places-text", 1)).toThrow(/PLACY_CAP_PLACES_TEXT/);
  });

  it("rapporterer forbruk og estimert kost", () => {
    process.env.PLACY_CAP_GEMINI_GROUNDING = "100";
    belastApiKall("gemini-grounding", 100);
    const rad = forbruksrapport().find((r) => r.sku === "gemini-grounding");
    expect(rad?.brukt).toBe(100);
    expect(rad?.usd).toBeCloseTo((100 * USD_PER_1000["gemini-grounding"]) / 1000);
  });

  it("gir tomt forbruk for en dato uten aktivitet", () => {
    expect(lesForbruk("2020-01-01")).toEqual({});
  });
});

describe("idag", () => {
  it("formaterer lokal dato som ISO-dato", () => {
    expect(idag(new Date(2026, 7, 14, 23, 30))).toBe("2026-08-14");
  });

  it("bruker lokal tid, ikke UTC — regnskapet følger arbeidsdagen", () => {
    // 23:30 lokal 14. august er 21:30 UTC samme dag i Norge, men poenget er at
    // datoen leses av lokale felter, ikke av toISOString().
    const sen = new Date(2026, 0, 1, 23, 59);
    expect(idag(sen)).toBe("2026-01-01");
  });
});

describe("testmiljøet spiser ikke produksjonsbudsjettet", () => {
  const gamleEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...gamleEnv };
  });

  it("skriver ingenting når VITEST er satt uten eksplisitt ledger-mappe", () => {
    // Oppdaget da `npm test` fikk rapporten til å vise 15 grounding-kall uten
    // at ett eneste kall var sendt til Google.
    delete process.env.PLACY_API_LEDGER_DIR;
    expect(process.env.VITEST).toBeTruthy();
    expect(() => belastApiKall("gemini-grounding", 5)).not.toThrow();
    expect(lesForbruk()).toEqual({});
  });

  it("men respekterer en eksplisitt ledger-mappe, så budsjettet kan testes", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "placy-budsjett-eksplisitt-"));
    process.env.PLACY_API_LEDGER_DIR = dir;
    try {
      belastApiKall("places-photo", 2);
      expect(lesForbruk()["places-photo"]).toBe(2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
