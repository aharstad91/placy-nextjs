import type {
  DevelopmentAvailability,
  DevelopmentBuildStatus,
  LocalDevelopment,
  LocalTopic,
} from "@/lib/demo/local-board/schema";

/**
 * Projeksjonen: strukturert prosjektkunnskap → det skjermen viser og det
 * stemmen får vite (2026-09-18).
 *
 * ## Hvorfor ÉN funksjon og ikke to
 *
 * Fordi den dyre feilen ikke er at en linje mangler på skjermen — det er at
 * skjermen og stemmen sier forskjellige ting om samme fasilitet. Lå ordvalget
 * to steder, ville de driftet fra hverandre første gang noen justerte det ene:
 * kortet ville sagt «åpning ikke oppgitt» mens guiden sa «åpner i 2027». Derfor
 * lager `projectDevelopment` begge deler av samme objekt, i samme kall, og
 * `board.ts` og `voice.ts` velger bare hvilken del de rendrer.
 *
 * ## Hvorfor ingenting her ser på klokka
 *
 * Det finnes ingen `Date.now()` i denne modulen, og det er en regel, ikke en
 * forglemmelse. En forventet åpning i «Q1 2027» som passerer blir en GAMMEL
 * forventning, ikke en åpning: kilden har ikke sagt noe nytt. Automatikk her
 * ville gjort kalenderen til kilde. Av samme grunn er `checkedAt` på en påstand
 * bare når noen kontrollerte den — aldri en åpningsdato.
 *
 * ## Hvorfor forbeholdene er en egen liste
 *
 * `facts` er det kilden sier. `caveats` er det leseren og guiden må ta hensyn
 * til når de bruker det. Blandet sammen ville et forbehold blitt lest som en
 * opplysning, og en manglende opplysning som et avslag. `voice.ts` sender
 * `caveats` inn som UAVKLARTE fakta, som er nettopp det kunnskapsverktøyet
 * returnerer under `uncertainties` og aldri siterer som fakta.
 */

/** Byggestatusens ord, slik guiden skal si dem. */
const BUILD_STATUS_WORDS: Record<DevelopmentBuildStatus, string> = {
  existing: "eksisterende",
  "under-construction": "under bygging",
  planned: "planlagt",
  "adopted-plan": "vedtatt plan",
  vision: "visjon",
  unresolved: "uavklart",
};

/**
 * Byggestatus → kunnskapsmodellens tre verdier.
 *
 * `under-construction` blir `planned`: et bygg som reises er ikke et åpent
 * tilbud i dag, og kunnskapsverktøyets forbehold for planlagt utvikling er
 * nøyaktig det svaret trenger. Forskjellen på «under bygging» og «planlagt»
 * bæres av status-ordet over, som står i teksten guiden leser.
 */
export const BUILD_STATUS_KNOWLEDGE: Record<DevelopmentBuildStatus, string> = {
  existing: "existing",
  "under-construction": "planned",
  planned: "planned",
  "adopted-plan": "planned",
  vision: "planned",
  unresolved: "unresolved",
};

/** Tilgjengelighetens ord. «ikke oppgitt» er et ærlig svar, ikke et avslag. */
const AVAILABILITY_WORDS: Record<DevelopmentAvailability, string> = {
  open: "åpnet",
  "not-open": "ikke åpnet",
  expected: "åpning forventet",
  unknown: "åpning ikke oppgitt",
};

const ACCESS_WORDS = {
  "all-residents": "alle beboere",
  public: "offentlig",
  unresolved: "uavklart",
} as const;

/** Én linje i den korte strukturerte visningen: hva feltet heter, og hva det sier. */
export interface DevelopmentFact {
  label: string;
  value: string;
}

export interface DevelopmentProjection {
  /** Kunnskapsmodellens status: `existing`, `planned` eller `unresolved`. */
  knowledgeStatus: string;
  /** Status og åpning i én setningsdel, f.eks. «under bygging, åpning ikke oppgitt». */
  statusNote: string;
  /** Den korte strukturerte visningen. Bare felt som faktisk har innhold. */
  facts: DevelopmentFact[];
  /** Forbeholdene. Går til stemmen som uavklarte fakta, aldri som påstander. */
  caveats: string[];
}

/** Navnene på byggene, slik et menneske skal høre dem. Ukjent ID beholdes som ID. */
export function buildingNames(topics: readonly LocalTopic[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const topic of topics) {
    if (topic.development?.objectType === "building") names.set(topic.id, topic.title);
  }
  return names;
}

/** Objektene som er forankret i et sted i kartet, slått opp på stedets ID. */
export function developmentByPlaceId(topics: readonly LocalTopic[]): Map<string, LocalTopic> {
  const byPlace = new Map<string, LocalTopic>();
  for (const topic of topics) {
    const placeId = topic.development?.mapAnchor?.placeId;
    if (placeId && !byPlace.has(placeId)) byPlace.set(placeId, topic);
  }
  return byPlace;
}

/**
 * «a», «b» og «c» — slik en norsk setning ramser opp en liste.
 *
 * Bor her fordi adgangs- og innflyttingslinjene var det første stedet som
 * trengte den. `voice.ts` bruker den samme funksjonen på siterte ord, så
 * skjermen og stemmen ikke kan ramse opp på hver sin måte.
 */
export const joinWithOg = (items: readonly string[]): string =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} og ${items[items.length - 1]}`;

function accessValue(access: LocalDevelopment["access"], names: ReadonlyMap<string, string>): string {
  const base =
    access.scope === "named-buildings"
      ? joinWithOg(access.buildingIds.map((id) => names.get(id) ?? id))
      : ACCESS_WORDS[access.scope];
  return access.conditions ? `${base} — ${access.conditions}` : base;
}

/**
 * Objektet → skjerm og stemme.
 *
 * Returnerer `null` når temaet ikke er et utbyggingsobjekt, så kallstedet slipper
 * å gjenta betingelsen. `names` gjør at et bygg omtales med navn og ikke med ID
 * i adgangs- og innflyttingslinjene; mangler den, står ID-en — synlig, i stedet
 * for at linja forsvinner.
 */
export function projectDevelopment(
  topic: LocalTopic,
  names: ReadonlyMap<string, string> = new Map(),
): DevelopmentProjection | null {
  const development = topic.development;
  if (!development) return null;

  const claimText = new Map(development.claims.map((claim) => [claim.id, claim.text]));
  const subject = `«${topic.title}»`;
  const facts: DevelopmentFact[] = [
    { label: "Status", value: BUILD_STATUS_WORDS[development.buildStatus] },
    { label: "Åpning", value: AVAILABILITY_WORDS[development.availability] },
  ];
  const caveats: string[] = [];

  if (development.availability === "unknown") {
    caveats.push(`Kildene sier ikke om ${subject} er åpen. Ikke slutt at den er åpen.`);
  } else if (development.availability === "not-open") {
    caveats.push(`${subject} er ikke åpnet ennå.`);
  } else if (development.availability === "expected") {
    caveats.push(`${subject} er ventet åpnet, ikke bekreftet åpen.`);
  }

  if (development.timing) {
    facts.push({
      label: development.timing.qualifier === "confirmed" ? "Bekreftet tidspunkt" : "Forventet tidspunkt",
      value: development.timing.text,
    });
    if (development.timing.qualifier === "expected") {
      caveats.push(
        `Tidspunktet «${development.timing.text}» er en forventning fra kilden, ikke en bekreftet dato.`,
      );
    }
  }

  facts.push({ label: "Adgang", value: accessValue(development.access, names) });
  if (development.access.scope === "unresolved") {
    caveats.push(`Hvem som har adgang til ${subject} er uavklart.`);
  }

  if (development.moveInLinks.length) {
    facts.push({
      label: "Bekreftet ved innflytting",
      value: joinWithOg(development.moveInLinks.map((link) => names.get(link.buildingId) ?? link.buildingId)),
    });
  } else if (development.objectType !== "project" && development.availability !== "open") {
    // Det som mangler er nettopp det kjøperen spør om: er det der når jeg
    // flytter inn? Uten kilde er svaret at ingen har sagt det.
    caveats.push(`Ingen kilde bekrefter at ${subject} er tilgjengelig ved innflytting.`);
  }

  if (development.mapAnchor?.approximateArea) {
    facts.push({ label: "Omtrentlig plassering", value: development.mapAnchor.approximateArea });
  }

  for (const conflict of development.conflicts) {
    // Begge sidene blir stående, i den rekkefølgen datasettet har dem. Ingen
    // rangering på dato: en nyere side er ikke automatisk en bedre kilde.
    const texts = conflict.claimIds.map((id) => `«${claimText.get(id) ?? id}»`);
    caveats.push(`Kildene spriker: ${texts.join(" mot ")}. ${conflict.note}`);
  }

  return {
    knowledgeStatus: BUILD_STATUS_KNOWLEDGE[development.buildStatus],
    statusNote: `${BUILD_STATUS_WORDS[development.buildStatus]}, ${AVAILABILITY_WORDS[development.availability]}`,
    facts,
    caveats,
  };
}
