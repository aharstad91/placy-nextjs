/**
 * Udir-registrene: NSR (skoler) og NBR (barnehager).
 *
 * HVORFOR DETTE FINNES: for skole og barnehage er websøk feil verktøy. Vi
 * sammenlignet 2026-08-16 det Google AI og vår egen Gemini-grounding skrev om
 * Ranheim skole mot NSR-posten. Begge tekstene sa «offentlig barneskole … flott
 * beliggenhet ved sjøen». Ingen av dem sa 486 elever eller 1.–7. trinn — de to
 * opplysningene en småbarnsforelder faktisk filtrerer på. Registeret hadde
 * begge, gratis og strukturert.
 *
 * Samme sveip på fem Ranheim-barnehager: ikke ÉN av våre publiserte tekster
 * oppga antall barn eller aldersgruppe. Vi hadde skrevet kvadratmeter,
 * grillhytte og et amfi formet som et sjøskjell. Registeret hadde 98 barn 1–5
 * år, 80 barn 0–5 år, og så videre, på alle fem.
 *
 * Registeret er derfor FØRSTE kilde for disse to kategoriene, og grounding
 * håndterer bare restspørsmålene (profil, uteområde, opptak).
 *
 * BRUKES BARE FRA SCRIPT / BUILD-TIME. Ingen render-sti skal kalle dette —
 * fakta lagres på POI-raden og leses derfra (samme regel som Gemini-grounding).
 *
 * Kildene er åpne data fra Utdanningsdirektoratet. Ingen nøkkel, ingen kvote vi
 * har truffet. `DatoEndret` viser at postene vedlikeholdes løpende — Ranheim
 * skole var sist endret fire dager før vi slo den opp — så dette er også det
 * naturlige fundamentet for en planlagt oppfriskning av dataene.
 */

const NSR_BASE = "https://data-nsr.udir.no/v3";
const NBR_BASE = "https://data-nbr.udir.no/v3";

/** Trondheim. Eneste kommunen nabolagsdataene våre dekker per i dag. */
export const KOMMUNENR_TRONDHEIM = "5001";

export interface RegisterAdresse {
  adresse: string;
  postnr: string;
  poststed: string;
}

export interface RegisterKoordinat {
  lat: number;
  lng: number;
}

/** Feltene fra NSR som malen for skole faktisk spør etter. Resten kastes. */
export interface SkoleRegisterFacts {
  kilde: "nsr";
  orgnr: string;
  navn: string;
  /** 1 og 7 for en ren barneskole, 8 og 10 for ungdomsskole, 1 og 10 for 1–10. */
  trinnFra: number | null;
  trinnTil: number | null;
  elevtall: number | null;
  ansatte: number | null;
  /** true = kommunal/offentlig, false = privat. */
  offentlig: boolean;
  /** «Bokmål» / «Nynorsk». Bare verdt å nevne i teksten når den avviker. */
  maalform: string | null;
  grunnskole: boolean;
  videregaaende: boolean;
  adresse: RegisterAdresse | null;
  koordinat: RegisterKoordinat | null;
  url: string | null;
  /** ISO-dato. Styrer når posten skal friskes opp. */
  oppdatert: string | null;
  aktiv: boolean;
}

/** Feltene fra NBR som malen for barnehage spør etter. */
export interface BarnehageRegisterFacts {
  kilde: "nbr";
  orgnr: string;
  navn: string;
  antallBarn: number | null;
  /** 0 for barnehager som tar imot under ett år, ellers typisk 1. */
  alderFra: number | null;
  alderTil: number | null;
  ansatte: number | null;
  /** true = kommunal, false = privat. */
  offentlig: boolean;
  adresse: RegisterAdresse | null;
  koordinat: RegisterKoordinat | null;
  url: string | null;
  oppdatert: string | null;
  aktiv: boolean;
}

export type RegisterFacts = SkoleRegisterFacts | BarnehageRegisterFacts;

// ─── Parsing ────────────────────────────────────────────────────────────────
//
// Rene funksjoner, adskilt fra fetch, slik at de kan testes mot ekte
// responskropper uten nett.

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function parseAdresse(v: unknown): RegisterAdresse | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const adresse = str(o.Adresse);
  if (!adresse) return null;
  return {
    adresse,
    postnr: str(o.Postnr) ?? "",
    // Registeret skriver poststed i VERSALER. Teksten skal ikke rope.
    poststed: titleCase(str(o.Poststed) ?? ""),
  };
}

/**
 * «RANHEIM» → «Ranheim». Bevisst naiv: registeret bruker rene versaler, og
 * stedsnavn med bindestrek eller mellomrom er de eneste sammensetningene som
 * forekommer. Navn som «Å» eller «Bø i Telemark» håndteres riktig av dette.
 */
export function titleCase(s: string): string {
  return s
    .toLocaleLowerCase("nb-NO")
    .replace(/(^|[\s-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase("nb-NO"));
}

function parseKoordinat(v: unknown): RegisterKoordinat | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const lat = num(o.Breddegrad);
  const lng = num(o.Lengdegrad);
  if (lat === null || lng === null) return null;
  return { lat, lng };
}

export function parseSkoleEnhet(raw: unknown): SkoleRegisterFacts | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const orgnr = str(o.Orgnr);
  const navn = str(o.Navn);
  if (!orgnr || !navn) return null;

  const maalform =
    typeof o.Maalform === "object" && o.Maalform !== null
      ? str((o.Maalform as Record<string, unknown>).Navn)
      : null;

  return {
    kilde: "nsr",
    orgnr,
    navn,
    trinnFra: num(o.SkoletrinnGSFra),
    trinnTil: num(o.SkoletrinnGSTil),
    elevtall: num(o.Elevtall),
    // AnsatteFra og AnsatteTil er like i alle poster vi har sett; registeret
    // oppgir et intervall der begge ender er satt til samme tall.
    ansatte: num(o.AnsatteFra),
    offentlig: o.ErOffentligSkole === true,
    maalform,
    grunnskole: o.ErGrunnskole === true,
    videregaaende: o.ErVideregaaendeSkole === true,
    adresse: parseAdresse(o.Beliggenhetsadresse),
    koordinat: parseKoordinat(o.Koordinat),
    url: str(o.Url),
    oppdatert: str(o.DatoEndret),
    aktiv: o.ErAktiv === true,
  };
}

export function parseBarnehageEnhet(raw: unknown): BarnehageRegisterFacts | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const orgnr = str(o.Orgnr);
  const navn = str(o.Navn);
  if (!orgnr || !navn) return null;

  return {
    kilde: "nbr",
    orgnr,
    navn,
    antallBarn: num(o.AntallBarn),
    alderFra: num(o.AlderstrinnFra),
    alderTil: num(o.AlderstrinnTil),
    ansatte: num(o.AnsatteFra),
    offentlig: o.ErOffentligBarnehage === true,
    adresse: parseAdresse(o.Beliggenhetsadresse),
    koordinat: parseKoordinat(o.Koordinat),
    url: str(o.Url),
    oppdatert: str(o.DatoEndret),
    aktiv: o.ErAktiv === true,
  };
}

// ─── Formulering ────────────────────────────────────────────────────────────

/**
 * «1.–7. trinn». Tankestrek, ikke bindestrek, og punktum etter ordenstall —
 * ellers ser det ut som et telefonnummer i løpende tekst.
 */
export function formatTrinn(fra: number | null, til: number | null): string | null {
  if (fra === null || til === null) return null;
  if (fra === til) return `${fra}. trinn`;
  return `${fra}.–${til}. trinn`;
}

/**
 * «1–5 år». Registeret oppgir 0 for barnehager som tar imot barn under ett år;
 * «0–5 år» er riktig og skal ikke rundes opp til 1.
 */
export function formatAlder(fra: number | null, til: number | null): string | null {
  if (fra === null || til === null) return null;
  if (fra === til) return `${fra} år`;
  return `${fra}–${til} år`;
}

// ─── Henting ────────────────────────────────────────────────────────────────

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export async function fetchSkole(
  orgnr: string,
  signal?: AbortSignal,
): Promise<SkoleRegisterFacts | null> {
  return parseSkoleEnhet(await getJson(`${NSR_BASE}/enhet/${encodeURIComponent(orgnr)}`, signal));
}

export async function fetchBarnehage(
  orgnr: string,
  signal?: AbortSignal,
): Promise<BarnehageRegisterFacts | null> {
  return parseBarnehageEnhet(
    await getJson(`${NBR_BASE}/enhet/${encodeURIComponent(orgnr)}`, signal),
  );
}

/**
 * Alle enheter i en kommune. Listeposten er en kortversjon — den har navn,
 * orgnr og aktiv-flagg, men ikke elevtall eller antall barn. Bruk den til å
 * finne orgnr, og hent så detaljposten per treff.
 */
export async function fetchKommuneEnheter(
  slag: "skole" | "barnehage",
  kommunenr: string,
  signal?: AbortSignal,
): Promise<Array<{ orgnr: string; navn: string; aktiv: boolean }>> {
  const base = slag === "skole" ? NSR_BASE : NBR_BASE;
  const raw = await getJson(`${base}/enheter/kommune/${encodeURIComponent(kommunenr)}`, signal);
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r) => {
    if (typeof r !== "object" || r === null) return [];
    const o = r as Record<string, unknown>;
    const orgnr = str(o.Orgnr);
    const navn = str(o.Navn);
    if (!orgnr || !navn) return [];
    return [{ orgnr, navn, aktiv: o.ErAktiv === true }];
  });
}

// ─── Kobling POI → register ─────────────────────────────────────────────────

/**
 * Normaliser et navn for sammenligning. Selskapsformer og «avdeling» er støy:
 * POI-et heter «Stokkbekken barnehage» i Google og «Stokkbekken barnehage AS» i
 * registeret, og det er samme hus.
 */
export function normaliserNavn(navn: string): string {
  return navn
    .toLocaleLowerCase("nb-NO")
    .replace(/\b(as|asa|sa|ba|ans|da|stiftelsen|avd\.?|avdeling)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Meter mellom to punkter. Haversine — god nok på nabolagsavstand. */
export function avstandMeter(a: RegisterKoordinat, b: RegisterKoordinat): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Koble et POI til en registerpost.
 *
 * Navn alene holder ikke — «Ranheim skole» finnes i flere kommuner, og
 * «Grilstad Fus barnehage AS» mot «Grilstad FUS barnehage» er samme sted med
 * ulik skrivemåte. Koordinat alene holder heller ikke: to barnehager kan dele
 * tomt. Kravet er derfor BEGGE deler, og et treff avvises heller enn å gjettes.
 *
 * 300 meter er valgt fordi registeret og Google plasserer samme bygg litt ulikt
 * (Ranheim skole ligger 60 m fra hverandre i de to kildene), men to ulike
 * barnehager i samme nabolag ligger lenger fra hverandre enn det.
 */
export const MAKS_KOBLINGSAVSTAND_M = 300;

export function koblePoiTilRegister<T extends { navn: string; koordinat: RegisterKoordinat | null }>(
  poi: { navn: string; koordinat: RegisterKoordinat | null },
  kandidater: readonly T[],
): { treff: T; avstandM: number | null } | null {
  const målNavn = normaliserNavn(poi.navn);
  if (!målNavn) return null;

  const navnetreff = kandidater.filter((k) => {
    const kn = normaliserNavn(k.navn);
    return kn === målNavn || kn.startsWith(målNavn + " ") || målNavn.startsWith(kn + " ");
  });
  if (navnetreff.length === 0) return null;

  // Uten koordinat på én av sidene kan vi bare godta et entydig navnetreff.
  if (!poi.koordinat) {
    return navnetreff.length === 1 ? { treff: navnetreff[0], avstandM: null } : null;
  }

  const medAvstand = navnetreff
    .map((k) => ({
      treff: k,
      avstandM: k.koordinat ? avstandMeter(poi.koordinat!, k.koordinat) : null,
    }))
    .filter((x) => x.avstandM !== null && x.avstandM <= MAKS_KOBLINGSAVSTAND_M)
    .sort((a, b) => (a.avstandM ?? 0) - (b.avstandM ?? 0));

  if (medAvstand.length === 0) {
    // Navnet stemte, men stedet ligger et annet sted. Det er nettopp tilfellet
    // vi vil fange — ikke koble.
    return null;
  }
  return medAvstand[0];
}
