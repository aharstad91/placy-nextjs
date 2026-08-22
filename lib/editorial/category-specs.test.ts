import { describe, it, expect } from "vitest";
import {
  BARNEHAGE_SPEC,
  boardQuestions,
  CATEGORY_SPECS,
  DAGLIGVARE_SPEC,
  PLANLAGTE_KATEGORIER,
  registerQuestions,
  searchQuestions,
  SKOLE_SPEC,
  specForCategory,
  textQuestions,
} from "./category-specs";

describe("specForCategory", () => {
  it("finner malen på category_id", () => {
    expect(specForCategory("skole")).toBe(SKOLE_SPEC);
    expect(specForCategory("barnehage")).toBe(BARNEHAGE_SPEC);
    expect(specForCategory("supermarket")).toBe(DAGLIGVARE_SPEC);
  });

  it("gir undefined for kategorier vi ikke har skrevet mal for ennå", () => {
    // Sju kategorier står igjen av topp ti. Fravær skal være stille, ikke feil.
    expect(specForCategory("haircare")).toBeUndefined();
    expect(specForCategory(null)).toBeUndefined();
    expect(specForCategory(undefined)).toBeUndefined();
  });

  it("slår ikke opp på det norske navnet — id-en er en engelsk slug like ofte", () => {
    // «dagligvare» var gjettet i første utkast og traff ingenting. Kategorien
    // heter `supermarket`. Denne testen er der for at gjetningen ikke skal
    // snike seg inn igjen.
    expect(specForCategory("dagligvare")).toBeUndefined();
  });
});

describe("malenes struktur", () => {
  it("ingen kategori er dekket av to maler", () => {
    const alle = CATEGORY_SPECS.flatMap((s) => s.kategorier);
    expect(new Set(alle).size).toBe(alle.length);
  });

  it("spørsmåls-id-er er unike innenfor hver mal", () => {
    for (const spec of CATEGORY_SPECS) {
      const ids = spec.spørsmål.map((q) => q.id);
      expect(new Set(ids).size, `${spec.navn} har duplikat spørsmåls-id`).toBe(ids.length);
    }
  });

  it("hver mal har minst ett kjernespørsmål", () => {
    for (const spec of CATEGORY_SPECS) {
      expect(spec.spørsmål.some((q) => q.kjerne), `${spec.navn} mangler kjernespørsmål`).toBe(true);
    }
  });

  it("hver mal tar stilling til når tom tekst er riktig", () => {
    // Feltet er obligatorisk nettopp fordi spørsmålet ellers aldri blir stilt,
    // og da blir svaret som standard en fyllsetning.
    for (const spec of CATEGORY_SPECS) {
      expect(spec.naarTom.length, `${spec.navn} mangler begrunnelse`).toBeGreaterThan(40);
    }
  });

  it("dagligvare tillater eksplisitt tom tekst, skole og barnehage ikke", () => {
    expect(DAGLIGVARE_SPEC.naarTom).toMatch(/OVERSTYRER/);
    expect(SKOLE_SPEC.naarTom).toMatch(/aldri/i);
    expect(BARNEHAGE_SPEC.naarTom).toMatch(/aldri/i);
  });

  it("ingen mal i køen bruker en id som alt er dekket av en skrevet mal", () => {
    const dekket = new Set(CATEGORY_SPECS.flatMap((s) => s.kategorier));
    for (const p of PLANLAGTE_KATEGORIER) {
      for (const k of p.kategorier) {
        expect(dekket.has(k), `${p.navn}/${k} står i kø men er alt skrevet`).toBe(false);
      }
    }
  });

  it("registerspørsmål oppgir hvilket felt svaret ligger i", () => {
    // Uten feltnavn kan ikke importen vite hva den skal hente, og
    // hygiene-jobben kan ikke vite hva den skal måle mot.
    for (const spec of CATEGORY_SPECS) {
      for (const q of registerQuestions(spec)) {
        expect(q.felt, `${spec.navn}/${q.id} mangler felt`).toBeTruthy();
      }
    }
  });
});

describe("arbeidsdelingen register vs. søk", () => {
  it("skolens kjernefakta hentes fra register eller egne data — aldri fra søk", () => {
    // Dette er hele poenget med malen: vi slutter å søke opp det som står
    // strukturert og gratis i NSR.
    for (const q of SKOLE_SPEC.spørsmål.filter((x) => x.kjerne)) {
      expect(q.kilde, `${q.id} er kjerne, men hentes med søk`).not.toBe("søk");
    }
  });

  it("barnehagens kjernefakta hentes fra register", () => {
    for (const q of BARNEHAGE_SPEC.spørsmål.filter((x) => x.kjerne)) {
      expect(q.kilde, `${q.id} er kjerne, men hentes med søk`).toBe("register");
    }
  });

  it("søkespørsmålene overlapper ikke med registerspørsmålene", () => {
    for (const spec of CATEGORY_SPECS) {
      const reg = new Set(registerQuestions(spec).map((q) => q.id));
      for (const q of searchQuestions(spec)) {
        expect(reg.has(q.id), `${spec.navn}/${q.id} både søkes og hentes`).toBe(false);
      }
    }
  });

  it("kjede er kildet på søk — verken NBR eller Enhetsregisteret ser kjeden", () => {
    // Sjekket 2026-08-16: FUS-barnehagene står som sin egen eierstruktur i NBR
    // og uten morselskap i Brønnøysund. Flyttes denne til «register» en gang i
    // framtida, må det være fordi noen har funnet en kilde som faktisk har den.
    const kjede = BARNEHAGE_SPEC.spørsmål.find((q) => q.id === "kjede")!;
    expect(kjede.kilde).toBe("søk");
    expect(kjede.felt).toBeUndefined();
  });

  it("dagligvare har ingen registerspørsmål — det finnes ikke noe register", () => {
    // Sjekket 2026-08-16: Brings hentepunkt-API krever nøkkel, og det finnes
    // ingen åpen kjede- eller butikkregister. Register-først generaliserer ikke
    // fra skole og barnehage.
    expect(registerQuestions(DAGLIGVARE_SPEC)).toHaveLength(0);
    expect(searchQuestions(DAGLIGVARE_SPEC).length).toBe(DAGLIGVARE_SPEC.spørsmål.length);
  });

  it("skolen har krets som eget-data, ikke som søk", () => {
    const krets = SKOLE_SPEC.spørsmål.find((q) => q.id === "krets")!;
    expect(krets.kilde).toBe("eget");
    expect(krets.kjerne).toBe(true);
  });
});

describe("eksemplene", () => {
  it("hvert godt eksempel er kortere enn 300 tegn", () => {
    // Malen skal ikke friste til lange tekster. Det gode eksempelet er
    // normen kurator kalibrerer mot.
    for (const spec of CATEGORY_SPECS) {
      expect(spec.eksempel.god.tekst.length, `${spec.navn}`).toBeLessThan(300);
    }
  });

  it("det gode eksempelet svarer på ALLE kjernespørsmål i tekstlaget", () => {
    // Denne testen er hele grunnen til at `svarer` finnes. Den ville fanget at
    // skolemalen hadde `krets` som kjernespørsmål i teksten — noe ingen tekst
    // kan svare på, siden teksten deles av alle boards.
    for (const spec of CATEGORY_SPECS) {
      const svart = new Set(spec.eksempel.god.svarer);
      const påkrevd = textQuestions(spec).filter((q) => q.kjerne);
      for (const q of påkrevd) {
        expect(svart.has(q.id), `${spec.navn}: prøven svarer ikke på kjernepunktet «${q.id}»`).toBe(
          true,
        );
      }
    }
  });

  it("det gode eksempelet svarer ALDRI på et board-spørsmål", () => {
    for (const spec of CATEGORY_SPECS) {
      const svart = new Set(spec.eksempel.god.svarer);
      for (const q of boardQuestions(spec)) {
        expect(svart.has(q.id), `${spec.navn}: prøven besvarer «${q.id}», som hører til boardet`).toBe(
          false,
        );
      }
    }
  });

  it("hver id i «svarer» finnes faktisk som spørsmål", () => {
    for (const spec of CATEGORY_SPECS) {
      const ids = new Set(spec.spørsmål.map((q) => q.id));
      for (const s of spec.eksempel.god.svarer) {
        expect(ids.has(s), `${spec.navn}: «${s}» er ikke et spørsmål i malen`).toBe(true);
      }
    }
  });

  it("prøven svarer ikke på alt — den skal vise hva man lar være", () => {
    // Ville en prøve dekket samtlige spørsmål, hadde den blitt en mal for
    // utfylling, og da er vi tilbake til fyllstoffet vi bygde dette for å unngå.
    const dekkerAlt = CATEGORY_SPECS.filter(
      (s) => s.eksempel.god.svarer.length === textQuestions(s).length,
    );
    expect(dekkerAlt.map((s) => s.navn)).toEqual([]);
  });

  it("begge prøvene navngir et sted", () => {
    // Uten navn er en prøve en påstand om hvordan noe burde høres ut. Med navn
    // kan den slås opp — og da hadde vi oppdaget at det første
    // dagligvare-eksempelet blandet to butikker.
    for (const spec of CATEGORY_SPECS) {
      expect(spec.eksempel.god.sted.length, `${spec.navn} god`).toBeGreaterThan(2);
      expect(spec.eksempel.dårlig.sted.length, `${spec.navn} dårlig`).toBeGreaterThan(2);
    }
  });

  it("hvert dårlig eksempel har en begrunnelse", () => {
    for (const spec of CATEGORY_SPECS) {
      expect(spec.eksempel.dårlig.hvorfor.length).toBeGreaterThan(40);
    }
  });

  it("det gode skoleeksempelet svarer faktisk på trinn og elevtall", () => {
    expect(SKOLE_SPEC.eksempel.god.tekst).toContain("1.–7. trinn");
    expect(SKOLE_SPEC.eksempel.god.tekst).toContain("486");
  });

  it("det gode barnehageeksempelet oppgir alder og antall", () => {
    expect(BARNEHAGE_SPEC.eksempel.god.tekst).toMatch(/null til fem|0–5/);
    expect(BARNEHAGE_SPEC.eksempel.god.tekst).toContain("80");
  });

  it("det gode dagligvareeksempelet åpner ikke med kategorien", () => {
    // Sju av åtte publiserte tekster åpnet med «Dagligvarebutikk». Normen må
    // vise det motsatte.
    expect(DAGLIGVARE_SPEC.eksempel.god.tekst.toLowerCase()).not.toMatch(/^dagligvare/);
  });

  it("ingen god-eksempler navngir en pakketransportør", () => {
    // Butikken tar imot fra flere, og avtalene skifter.
    for (const spec of CATEGORY_SPECS) {
      expect(spec.eksempel.god.tekst).not.toMatch(/Helthjem|PostNord|Instabox|Bring\b/i);
    }
  });

  it("ingen god-eksempler bryter forbudet mot årstall", () => {
    for (const spec of CATEGORY_SPECS) {
      expect(spec.eksempel.god.tekst).not.toMatch(/\b(18|19|20)\d{2}\b/);
    }
  });

  it("ingen god-eksempler inneholder vurderingsordet vi luket bort", () => {
    for (const spec of CATEGORY_SPECS) {
      expect(spec.eksempel.god.tekst.toLowerCase()).not.toContain("flott");
    }
  });
});
