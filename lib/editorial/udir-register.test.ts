import { describe, it, expect } from "vitest";
import {
  avstandMeter,
  formatAlder,
  formatTrinn,
  koblePoiTilRegister,
  MAKS_KOBLINGSAVSTAND_M,
  normaliserNavn,
  parseBarnehageEnhet,
  parseSkoleEnhet,
  titleCase,
} from "./udir-register";

// ─── Fixtures ───────────────────────────────────────────────────────────────
//
// Klippet fra ekte responser 2026-08-16, ikke oppdiktet. Feltnavn og casing er
// registerets egne — det er nettopp dem parseren må tåle.

const RANHEIM_SKOLE = {
  Orgnr: "975278980",
  Navn: "Ranheim skole",
  Beliggenhetsadresse: {
    Adresse: "Ernst Larsens veg 3",
    Postnr: "7055",
    Poststed: "RANHEIM",
    Land: "Norge",
  },
  Koordinat: { Lengdegrad: 10.52283, Breddegrad: 63.42996, Zoom: 12, GeoKilde: "GeoNorge" },
  Url: "www.trondheim.kommune.no/org/oppvekst/skoler/ranheim-skole/",
  Maalform: { Id: "B", Navn: "Bokmål" },
  ErAktiv: true,
  ErGrunnskole: true,
  ErVideregaaendeSkole: false,
  ErPrivatskole: false,
  ErOffentligSkole: true,
  Elevtall: 486,
  AnsatteFra: 96,
  AnsatteTil: 96,
  SkoletrinnGSFra: 1,
  SkoletrinnGSTil: 7,
  DatoFoedt: "1969-02-01T00:00:00+00:00",
  DatoEndret: "2026-08-12T01:10:25.873+00:00",
};

const STOKKBEKKEN = {
  Orgnr: "973488589",
  Navn: "Stokkbekken barnehage AS",
  Beliggenhetsadresse: {
    Adresse: "Nyheimsvegen 37B",
    Postnr: "7058",
    Poststed: "CHARLOTTENLUND",
    Land: "Norge",
  },
  Koordinat: { Lengdegrad: 10.49316, Breddegrad: 63.41912, Zoom: 12, GeoKilde: "GeoNorge" },
  Url: "stokkbekkenbhg.no",
  ErAktiv: true,
  ErOffentligBarnehage: false,
  ErPrivatBarnehage: true,
  AntallBarn: 12,
  AnsatteFra: 12,
  AnsatteTil: 12,
  AlderstrinnFra: 1,
  AlderstrinnTil: 2,
  DatoEndret: "2026-06-12T01:32:22.177+00:00",
};

// ─── Parsing ────────────────────────────────────────────────────────────────

describe("parseSkoleEnhet", () => {
  it("henter ut nøyaktig de feltene skolemalen spør etter", () => {
    const s = parseSkoleEnhet(RANHEIM_SKOLE)!;
    expect(s.orgnr).toBe("975278980");
    expect(s.trinnFra).toBe(1);
    expect(s.trinnTil).toBe(7);
    expect(s.elevtall).toBe(486);
    expect(s.offentlig).toBe(true);
    expect(s.ansatte).toBe(96);
    expect(s.koordinat).toEqual({ lat: 63.42996, lng: 10.52283 });
    expect(s.oppdatert).toBe("2026-08-12T01:10:25.873+00:00");
  });

  it("normaliserer poststed fra registerets versaler", () => {
    // «RANHEIM» skal ikke rope i løpende tekst.
    expect(parseSkoleEnhet(RANHEIM_SKOLE)!.adresse?.poststed).toBe("Ranheim");
  });

  it("returnerer null når posten mangler orgnr eller navn", () => {
    expect(parseSkoleEnhet({ Navn: "Uten orgnr" })).toBeNull();
    expect(parseSkoleEnhet({ Orgnr: "123" })).toBeNull();
    expect(parseSkoleEnhet(null)).toBeNull();
    expect(parseSkoleEnhet("ikke et objekt")).toBeNull();
  });

  it("skiller privat fra offentlig på ErOffentligSkole, ikke på fravær av flagget", () => {
    const privat = parseSkoleEnhet({ ...RANHEIM_SKOLE, ErOffentligSkole: false, ErPrivatskole: true })!;
    expect(privat.offentlig).toBe(false);
  });
});

describe("parseBarnehageEnhet", () => {
  it("henter antall barn og aldersspenn — de to malen krever", () => {
    const b = parseBarnehageEnhet(STOKKBEKKEN)!;
    expect(b.antallBarn).toBe(12);
    expect(b.alderFra).toBe(1);
    expect(b.alderTil).toBe(2);
    expect(b.offentlig).toBe(false);
  });

  it("beholder 0 som aldersgrense i stedet for å tolke det som mangler verdi", () => {
    // Sjøskogbekken står med AlderstrinnFra 0. En falsy-sjekk ville spist den
    // og gjort en 0–5-barnehage om til en uten oppgitt alder.
    const b = parseBarnehageEnhet({ ...STOKKBEKKEN, AlderstrinnFra: 0, AlderstrinnTil: 5 })!;
    expect(b.alderFra).toBe(0);
    expect(b.alderTil).toBe(5);
  });

  it("beholder 0 barn i stedet for null", () => {
    const b = parseBarnehageEnhet({ ...STOKKBEKKEN, AntallBarn: 0 })!;
    expect(b.antallBarn).toBe(0);
  });
});

// ─── Formulering ────────────────────────────────────────────────────────────

describe("formatTrinn", () => {
  it("skriver spennet med tankestrek og ordenstall", () => {
    expect(formatTrinn(1, 7)).toBe("1.–7. trinn");
    expect(formatTrinn(8, 10)).toBe("8.–10. trinn");
  });

  it("kollapser til ett trinn når skolen bare har ett", () => {
    expect(formatTrinn(1, 1)).toBe("1. trinn");
  });

  it("gir null når registeret ikke oppgir trinn — da skal punktet utelates", () => {
    expect(formatTrinn(null, 7)).toBeNull();
    expect(formatTrinn(1, null)).toBeNull();
  });
});

describe("formatAlder", () => {
  it("beholder 0 som nedre grense", () => {
    expect(formatAlder(0, 5)).toBe("0–5 år");
  });

  it("skriver 1–2 år slik registeret oppgir det", () => {
    // Vi publiserte «mellom ett og tre år» om Stokkbekken. Registeret sier 1–2.
    expect(formatAlder(1, 2)).toBe("1–2 år");
  });

  it("gir null når spennet mangler", () => {
    expect(formatAlder(null, null)).toBeNull();
  });
});

describe("titleCase", () => {
  it("håndterer sammensatte stedsnavn", () => {
    expect(titleCase("CHARLOTTENLUND")).toBe("Charlottenlund");
    expect(titleCase("BØ I TELEMARK")).toBe("Bø I Telemark");
    expect(titleCase("SANDVIKA-BÆRUM")).toBe("Sandvika-Bærum");
  });

  it("takler norske tegn i første posisjon", () => {
    expect(titleCase("ÅS")).toBe("Ås");
  });
});

// ─── Kobling ────────────────────────────────────────────────────────────────

describe("normaliserNavn", () => {
  it("fjerner selskapsform slik at Google-navn og registernavn møtes", () => {
    expect(normaliserNavn("Stokkbekken barnehage AS")).toBe(
      normaliserNavn("Stokkbekken barnehage"),
    );
    expect(normaliserNavn("Stiftelsen Steinerbarnehagen Rotnissen")).toBe(
      normaliserNavn("Steinerbarnehagen Rotnissen"),
    );
  });

  it("er ufølsom for store bokstaver i akronymer", () => {
    expect(normaliserNavn("Grilstad FUS barnehage")).toBe(normaliserNavn("Grilstad Fus barnehage AS"));
  });
});

describe("avstandMeter", () => {
  it("gir tilnærmet null for samme punkt", () => {
    expect(avstandMeter({ lat: 63.43, lng: 10.52 }, { lat: 63.43, lng: 10.52 })).toBeLessThan(1);
  });

  it("regner et kjent kort spenn riktig", () => {
    // ~111 m per 0.001 breddegrad.
    const d = avstandMeter({ lat: 63.43, lng: 10.52 }, { lat: 63.431, lng: 10.52 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(118);
  });
});

describe("koblePoiTilRegister", () => {
  const registerpost = {
    navn: "Ranheim skole",
    koordinat: { lat: 63.42996, lng: 10.52283 },
  };

  it("kobler når navnet stemmer og punktene ligger nær hverandre", () => {
    const treff = koblePoiTilRegister(
      { navn: "Ranheim skole", koordinat: { lat: 63.4302, lng: 10.5231 } },
      [registerpost],
    );
    expect(treff?.treff.navn).toBe("Ranheim skole");
    expect(treff!.avstandM!).toBeLessThan(MAKS_KOBLINGSAVSTAND_M);
  });

  it("nekter å koble når navnet stemmer men stedet ligger et annet sted", () => {
    // Samme skolenavn i en annen kommune er den klassiske fellen.
    const treff = koblePoiTilRegister(
      { navn: "Ranheim skole", koordinat: { lat: 59.91, lng: 10.75 } },
      [registerpost],
    );
    expect(treff).toBeNull();
  });

  it("velger nærmeste når to registerposter har samme navn", () => {
    const nær = { navn: "Ranheim skole", koordinat: { lat: 63.43, lng: 10.5229 } };
    const fjern = { navn: "Ranheim skole", koordinat: { lat: 63.4315, lng: 10.5245 } };
    const treff = koblePoiTilRegister(
      { navn: "Ranheim skole", koordinat: { lat: 63.42996, lng: 10.52283 } },
      [fjern, nær],
    );
    expect(treff?.treff).toBe(nær);
  });

  it("godtar entydig navnetreff uten koordinat, men ikke et flertydig", () => {
    const enTreff = koblePoiTilRegister({ navn: "Ranheim skole", koordinat: null }, [registerpost]);
    expect(enTreff?.treff.navn).toBe("Ranheim skole");

    const toTreff = koblePoiTilRegister({ navn: "Ranheim skole", koordinat: null }, [
      registerpost,
      { navn: "Ranheim skole", koordinat: { lat: 59.91, lng: 10.75 } },
    ]);
    expect(toTreff).toBeNull();
  });

  it("kobler på tvers av selskapsform", () => {
    const treff = koblePoiTilRegister(
      { navn: "Stokkbekken barnehage", koordinat: { lat: 63.41912, lng: 10.49316 } },
      [{ navn: "Stokkbekken barnehage AS", koordinat: { lat: 63.41912, lng: 10.49316 } }],
    );
    expect(treff?.treff.navn).toBe("Stokkbekken barnehage AS");
  });

  it("kobler ikke på tomt eller ukjent navn", () => {
    expect(koblePoiTilRegister({ navn: "   ", koordinat: null }, [registerpost])).toBeNull();
    expect(
      koblePoiTilRegister({ navn: "Charlottenlund skole", koordinat: null }, [registerpost]),
    ).toBeNull();
  });
});
