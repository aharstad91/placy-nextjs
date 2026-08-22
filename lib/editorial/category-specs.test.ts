import { describe, it, expect } from "vitest";
import {
  BARNEHAGE_SPEC,
  boardQuestions,
  CATEGORY_SPECS,
  DAGLIGVARE_SPEC,
  faqQuestionsForTheme,
  PLANLAGTE_KATEGORIER,
  registerQuestions,
  RESTAURANT_SPEC,
  searchQuestions,
  SKOLE_SPEC,
  specForCategory,
  textQuestions,
  TRANSPORT_SPEC,
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

  it("barnehagens kjernefakta i TEKSTEN hentes fra register", () => {
    // Scopet til tekstlaget: board-lag-spørsmål er `eget` per definisjon —
    // de regnes ut fra adressen og finnes ikke i noe register.
    for (const q of textQuestions(BARNEHAGE_SPEC).filter((x) => x.kjerne)) {
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
    // Alt i TEKSTEN må søkes opp. Board-laget («hvor gjør jeg hverdagshandelen»)
    // regnes ut av oss og hører ikke med i denne tellingen.
    expect(searchQuestions(DAGLIGVARE_SPEC).length).toBe(
      textQuestions(DAGLIGVARE_SPEC).length,
    );
  });

  it("skolen har krets som eget-data, ikke som søk", () => {
    const krets = SKOLE_SPEC.spørsmål.find((q) => q.id === "krets")!;
    expect(krets.kilde).toBe("eget");
    expect(krets.kjerne).toBe(true);
  });

  it("transport har ingen registerspørsmål — Entur er ikke et register vi kobler POI-er mot", () => {
    // Entur svarer på ADRESSEN (nærmeste stopp, linjer, reisetid), ikke på
    // stoppestedet som enhet. Derfor board-lag, ikke register-lag.
    expect(registerQuestions(TRANSPORT_SPEC)).toHaveLength(0);
    expect(boardQuestions(TRANSPORT_SPEC).every((q) => q.kilde === "eget")).toBe(true);
  });
});

describe("board-laget", () => {
  const alleBoard = CATEGORY_SPECS.flatMap((s) =>
    boardQuestions(s).map((q) => ({ spec: s, q })),
  );

  it("hvert board-spørsmål oppgir hvor svaret regnes ut fra", () => {
    // Uten `felt` kan ingen se hvilken kilde et FAQ-svar hviler på, og
    // sporbarhets-kravet (ingen diktede svar) blir umulig å etterprøve.
    for (const { spec, q } of alleBoard) {
      expect(q.felt, `${spec.navn}/${q.id} mangler felt`).toBeTruthy();
    }
  });

  it("board-spørsmåls-id-er er unike PÅ TVERS av alle maler", () => {
    // FAQ-en slår sammen flere maler i ett tema (skole + barnehage under Barn
    // & Oppvekst) og kuraterte overstyringer nøkles på bare id-en. Kolliderer
    // to maler, overstyrer kurator feil svar — stille.
    const ids = alleBoard.map(({ q }) => q.id);
    expect(new Set(ids).size, `duplikat: ${ids.join(", ")}`).toBe(ids.length);
  });

  it("board-spørsmål er formulert som et spørsmål og kort nok til en overskrift", () => {
    // De rendres ORDRETT som FAQ-overskrift. Den gamle krets-formuleringen bar
    // begrunnelsen sin inni strengen («… siden svaret er ulikt fra bolig til
    // bolig») og var 140 tegn — uleselig som overskrift.
    for (const { spec, q } of alleBoard) {
      expect(q.spørsmål.endsWith("?"), `${spec.navn}/${q.id} er ikke et spørsmål`).toBe(true);
      expect(q.spørsmål.length, `${spec.navn}/${q.id} er for lang som overskrift`).toBeLessThan(
        90,
      );
    }
  });

  it("board-spørsmål er stilt fra boligen, ikke fra stedet", () => {
    // «Sogner denne adressen hit?» er stilt til et skole-POI. På boardet er
    // det boligen som spør, og pekeordene røper at formuleringen ikke er snudd.
    for (const { spec, q } of alleBoard) {
      expect(
        /\b(hit|dit|herfra fra stedet)\b/i.test(q.spørsmål) && !/går herfra/i.test(q.spørsmål),
        `${spec.navn}/${q.id} peker på stedet i stedet for på boligen`,
      ).toBe(false);
    }
  });

  it("videregående spørres om nærhet, aldri om krets", () => {
    // Inntak til vgs er fylkeskommunalt og karakterbasert. `schoolZone` dekker
    // bare barne- og ungdomstrinn, så en «sogner til»-formulering ville vært
    // et løfte vi ikke har dekning for.
    const vgs = SKOLE_SPEC.spørsmål.find((q) => q.id === "vgs-naerhet")!;
    expect(vgs.lag).toBe("board");
    expect(vgs.spørsmål.toLowerCase()).not.toMatch(/krets|sogner/);
  });
});

describe("faqQuestionsForTheme", () => {
  // Kategorilistene er de ekte fra REPORT_THEME_DEFAULTS.
  const BARN = ["skole", "barnehage", "lekeplass", "idrett", "fritidsklubb"];
  const TRANSPORT = ["bus", "train", "tram", "bike", "parking", "carshare", "taxi"];
  const OPPLEVELSER = ["museum", "cinema", "library", "theatre"];

  it("gir transport-malens board-spørsmål i mal-rekkefølge", () => {
    expect(faqQuestionsForTheme("transport", TRANSPORT).map((f) => f.question.id)).toEqual([
      "naermeste-holdeplass",
      "linjer",
      "til-sentrum",
    ]);
  });

  it("fletter flere maler i ett tema uten duplikater", () => {
    const ids = faqQuestionsForTheme("barn-oppvekst", BARN).map((f) => f.question.id);
    expect(ids).toEqual(["krets", "vgs-naerhet", "barnehage-dekning"]);
  });

  it("lar hver mal bidra ÉN gang selv om temaet lister flere av kategoriene", () => {
    // bus, train og tram deler TRANSPORT_SPEC. Uten dedup ville «Hvor er
    // nærmeste holdeplass?» stått tre ganger i FAQ-en.
    const treff = faqQuestionsForTheme("transport", TRANSPORT);
    expect(treff.every((f) => f.categoryId === "bus")).toBe(true);
  });

  it("tema uten mal-dekning gir tom liste, ikke feil", () => {
    expect(faqQuestionsForTheme("opplevelser", OPPLEVELSER)).toEqual([]);
    expect(faqQuestionsForTheme("natur-friluftsliv", ["park", "outdoor"])).toEqual([]);
  });

  it("normaliserer alias-tema-id til den kanoniske", () => {
    // Gammel config kan bære «barnefamilier». Kuraterte overstyringer nøkles
    // på kanonisk id, så begge skrivemåtene må lande samme sted.
    const alias = faqQuestionsForTheme("barnefamilier", BARN);
    expect(alias.map((f) => f.themeId)).toEqual(["barn-oppvekst", "barn-oppvekst", "barn-oppvekst"]);
    expect(alias.map((f) => f.question.id)).toEqual(
      faqQuestionsForTheme("barn-oppvekst", BARN).map((f) => f.question.id),
    );
  });

  it("tom kategoriliste gir tom liste", () => {
    expect(faqQuestionsForTheme("transport", [])).toEqual([]);
  });

  it("bærer malen med, så et svar kan spores tilbake til hvor spørsmålet står", () => {
    const [første] = faqQuestionsForTheme("mat-drikke", ["restaurant", "cafe", "bar"]);
    expect(første.spec).toBe(RESTAURANT_SPEC);
    expect(første.categoryId).toBe("restaurant");
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
