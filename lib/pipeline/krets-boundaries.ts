/**
 * Sett ekte polygon på Trondheim-strøk fra kommunens skolekretser.
 *
 * HVORFOR: 25 av områdene fikk `boundary` avledet fra `postal_codes` — men de
 * postnumrene ble håndskrevet i migrasjon 050 sammen med senterkoordinater som
 * beviselig bommer (Vikåsen står med 63.4300/10.4800, som ligger utenfor hele
 * VIKÅSEN-kretsen). Formen arvet altså gjetningen. Skolekretsene er Trondheim
 * kommunes egne polygoner (NLOD) og er den eneste autoritative strøk-inndelingen
 * vi har for byen.
 *
 * RETNINGEN SNUS: postnummer var input til geometri; nå er ekte geometri input
 * og postnummer utledes fra den (`suggest-area-postal-codes.ts`). Postnummer
 * beholdes som måleenhet i dekningsregnskapet — det er den eneste enheten som
 * også dekker Malvik, Melhus og Stjørdal, der det ikke finnes kretsdata.
 *
 * KRETS ER IKKE AUTOMATISK FASIT. To kjente avvik er dokumentert i
 * PROJECT-LOG.md: skolekretsnavn er ikke alltid strøknavn (Sentrum måtte bygges
 * som SINGSAKER + BISPEHAUGEN), og RANHEIM-kretsen er smalere enn markeds-Ranheim
 * (2 av 3 lokalkjente adresser falt utenfor). Derfor er `boundary_source`
 * tredelt: `krets` betyr maskinsatt fra kommunedata, `curated` betyr at et
 * menneske har verifisert eller justert den. Kuraterte polygoner røres aldri her.
 *
 * Ren logikk. Lesing og skriving ligger i `scripts/apply-krets-boundaries.ts`.
 */

import {
  interiorWitnesses,
  pointInGeometry,
  type GeoJsonPolygonGeometry,
} from "@/lib/utils/geo";

/**
 * Område-id → skolekrets(er).
 *
 * Bare direkte navnetreff. De 20 øvrige Trondheim-strøkene (Bakklandet,
 * Møllenberg, Moholt, Tiller, …) har ikke en krets med samme navn, og hvilken
 * krets de hører til er en kurator-beslutning som ikke skal gjettes maskinelt —
 * de blir stående med `derived`-formen sin til noen tar dem én for én.
 *
 * De kuraterte områdene står oppført fordi korrespondansen er kunnskap verdt å
 * beholde, ikke fordi de skal skrives. `planKretsBoundaries` hopper over alt som
 * er kuratert — og hopper i tillegg over ethvert område som vil ha en krets et
 * kuratert område allerede eier. Det siste treffer `singsaker`: `sentrum` er
 * kuratert som SINGSAKER + BISPEHAUGEN, så SINGSAKER-kretsen er opptatt.
 * Hvorvidt Singsaker skal være eget strøk eller en del av Sentrum er en
 * kurator-beslutning, ikke en geometrisk.
 *
 * Flere kretser på samme område unioneres som MultiPolygon.
 */
export const AREA_KRETS_MAP: Readonly<Record<string, readonly string[]>> = {
  brundalen: ["BRUNDALEN"],
  byasen: ["BYÅSEN"],
  charlottenlund: ["CHARLOTTENLUND"],
  eberg: ["EBERG"],
  flatasen: ["FLATÅSEN"],
  ila: ["ILA"],
  kattem: ["KATTEM"],
  lade: ["LADE"],
  nardo: ["NARDO"],
  ranheim: ["RANHEIM"],
  sentrum: ["SINGSAKER", "BISPEHAUGEN"],
  singsaker: ["SINGSAKER"],
  strindheim: ["STRINDHEIM"],
  vikasen: ["VIKÅSEN"],
};

export interface KretsFeature {
  navn: string;
  kretsnr: number;
  boundary: GeoJsonPolygonGeometry;
}

export interface AreaForKrets {
  id: string;
  name_no: string;
  boundary: GeoJsonPolygonGeometry | null;
  boundary_source: string | null;
}

export interface KretsWrite {
  id: string;
  name: string;
  kretser: string[];
  boundary: { type: "MultiPolygon"; coordinates: number[][][][] };
  /** Hva raden hadde før — for logg og angring. */
  forrigeSource: string | null;
}

export type KretsSkipReason =
  | "ingen-kretsmapping"
  | "kuratert-polygon"
  | "krets-tatt-av-kuratert"
  | "krets-mangler-i-datasettet";

export interface KretsSkip {
  id: string;
  name: string;
  reason: KretsSkipReason;
  detalj?: string;
}

export interface KretsOverlap {
  /** Området hvis form tråkker inn i et annet. */
  id: string;
  /** Om `id` er et område denne kjøringen skriver, eller en form som lå der fra før. */
  nyForm: boolean;
  /** Kvaliteten på `id`-siden sin form, etter skrivingen. */
  kildeSource: "curated" | "krets" | "derived" | "ukjent";
  /** Området den nye formen tråkker inn i. */
  motId: string;
  /**
   * Formen vi kolliderer med, etter skrivingen. `derived` er den gamle
   * postnummer-gjetningen og betyr lite — den formen skal uansett byttes.
   * `curated` og `krets` er ekte konflikter: to autoritative former som
   * hevder samme grunn.
   */
  motSource: "curated" | "krets" | "derived" | "ukjent";
  /**
   * Antall vitnepunkter: punkter som ligger inne i BEGGE formene.
   *
   * Naboområder deler grense og dermed ringpunkter, og et punkt nøyaktig på
   * grensen kan testes som «innenfor» hos begge. Det er ikke overlapp — det er
   * at de ligger inntil hverandre. Derfor trekkes hvert testpunkt litt innover
   * i sin egen form først, og telles bare hvis det fortsatt er innenfor begge.
   */
  treffpunkter: number;
}

export interface KretsPlan {
  write: KretsWrite[];
  skipped: KretsSkip[];
  /** Kretser i datasettet som ingen område peker på. */
  ubrukteKretser: string[];
  /** Nye former som overlapper et annet områdes form. Rapporteres, blokkerer ikke. */
  overlapp: KretsOverlap[];
}

/** Alltid MultiPolygon ut, slik at unioner og enkeltkretser har samme form i basen. */
function toMultiPolygon(geometries: GeoJsonPolygonGeometry[]): {
  type: "MultiPolygon";
  coordinates: number[][][][];
} {
  const coordinates: number[][][][] = [];
  for (const g of geometries) {
    if (g.type === "MultiPolygon") coordinates.push(...(g.coordinates as number[][][][]));
    else coordinates.push(g.coordinates as number[][][]);
  }
  return { type: "MultiPolygon", coordinates };
}


export function planKretsBoundaries(
  areas: AreaForKrets[],
  kretser: KretsFeature[]
): KretsPlan {
  const kretsByNavn = new Map(kretser.map((k) => [k.navn.toUpperCase(), k]));
  const brukteKretser = new Set<string>();

  // Kretser et kuratert område allerede eier. Å skrive dem til et annet område
  // ville laget to autoritative former som hevder samme grunn, og geofencen
  // avgjør slikt på raderekkefølge.
  const eidAvKuratert = new Map<string, string>();
  for (const area of areas) {
    if (area.boundary_source !== "curated") continue;
    for (const n of AREA_KRETS_MAP[area.id] ?? []) {
      eidAvKuratert.set(n.toUpperCase(), area.id);
    }
  }

  const write: KretsWrite[] = [];
  const skipped: KretsSkip[] = [];

  for (const area of areas) {
    const navn = AREA_KRETS_MAP[area.id];
    if (!navn) {
      skipped.push({ id: area.id, name: area.name_no, reason: "ingen-kretsmapping" });
      continue;
    }

    // R4: håndjustert form vinner alltid over maskinsatt. Ranheim-polygonet er
    // krets PLUSS adressekorreksjoner — å skrive kretsen tilbake ville slettet
    // de korreksjonene uten spor.
    if (area.boundary_source === "curated") {
      navn.forEach((n) => brukteKretser.add(n.toUpperCase()));
      skipped.push({
        id: area.id,
        name: area.name_no,
        reason: "kuratert-polygon",
        detalj: navn.join("+"),
      });
      continue;
    }

    const opptatt = navn
      .map((n) => ({ krets: n.toUpperCase(), eier: eidAvKuratert.get(n.toUpperCase()) }))
      .filter((x) => x.eier !== undefined);
    if (opptatt.length > 0) {
      skipped.push({
        id: area.id,
        name: area.name_no,
        reason: "krets-tatt-av-kuratert",
        detalj: opptatt.map((x) => `${x.krets} eies av ${x.eier}`).join(", "),
      });
      continue;
    }

    const geometrier: GeoJsonPolygonGeometry[] = [];
    const mangler: string[] = [];
    for (const n of navn) {
      const krets = kretsByNavn.get(n.toUpperCase());
      if (krets) {
        geometrier.push(krets.boundary);
        brukteKretser.add(n.toUpperCase());
      } else {
        mangler.push(n);
      }
    }

    // Delvis treff er verre enn ingen: et område som får halve unionen sin ser
    // dekket ut i regnskapet, men mister adressene i den manglende kretsen.
    if (mangler.length > 0) {
      skipped.push({
        id: area.id,
        name: area.name_no,
        reason: "krets-mangler-i-datasettet",
        detalj: mangler.join(", "),
      });
      continue;
    }

    write.push({
      id: area.id,
      name: area.name_no,
      kretser: [...navn],
      boundary: toMultiPolygon(geometrier),
      forrigeSource: area.boundary_source,
    });
  }

  const ubrukteKretser = kretser
    .map((k) => k.navn)
    .filter((n) => !brukteKretser.has(n.toUpperCase()))
    .sort();

  return { write, skipped, ubrukteKretser, overlapp: findOverlaps(write, areas) };
}

/**
 * Finn alle områder som tråkker inn i hverandre, slik kartet ser ut ETTER
 * skrivingen.
 *
 * Geofencen (`find-area-for-point.ts`) returnerer `matches[0]` med en advarsel
 * når flere områder treffer, så overlapp betyr at hvilket strøk en bolig havner
 * i avgjøres av raderekkefølge. Vi rapporterer det i stedet for å skjule det.
 *
 * ALLE PAR, ikke bare de vi skriver. Grilstadvegen 1A treffer både `ranheim` og
 * `charlottenlund` — begge kuraterte, ingen av dem rørt av dette scriptet. Et
 * regnskap som bare viste konsekvensene av egen skriving ville ikke fanget det.
 */
function findOverlaps(write: KretsWrite[], areas: AreaForKrets[]): KretsOverlap[] {
  const nyForm = new Map(write.map((w) => [w.id, w.boundary]));

  // Formen hvert område har ETTER skrivingen: ny der vi skriver, eksisterende ellers.
  const etterpa: Array<{
    id: string;
    boundary: GeoJsonPolygonGeometry;
    source: KretsOverlap["motSource"];
    ny: boolean;
  }> = [];
  for (const area of areas) {
    const ny = nyForm.get(area.id);
    if (ny) {
      etterpa.push({ id: area.id, boundary: ny, source: "krets", ny: true });
      continue;
    }
    if (!area.boundary) continue;
    const source =
      area.boundary_source === "curated" || area.boundary_source === "derived"
        ? area.boundary_source
        : "ukjent";
    etterpa.push({ id: area.id, boundary: area.boundary, source, ny: false });
  }

  const overlapp: KretsOverlap[] = [];
  for (const a of etterpa) {
    const punkter = interiorWitnesses(a.boundary);
    for (const b of etterpa) {
      if (a.id === b.id) continue;
      let treffpunkter = 0;
      for (const [lng, lat] of punkter) {
        if (pointInGeometry(lng, lat, b.boundary)) treffpunkter++;
      }
      if (treffpunkter > 0) {
        overlapp.push({
          id: a.id,
          nyForm: a.ny,
          kildeSource: a.source,
          motId: b.id,
          motSource: b.source,
          treffpunkter,
        });
      }
    }
  }
  return overlapp;
}
