import type {
  CuratedProvider,
  ProjectInfo,
  ProjectInfoProvider,
} from "@/lib/realtime/nyhavna-chapters";
import type { KnowledgeBase, KnowledgeEntityLike } from "@/lib/realtime/knowledge-base";
import type { KnowledgeOptions } from "@/lib/realtime/nyhavna-knowledge";
import type { LocalDataset, LocalPlace, LocalStatus, LocalTopic } from "@/lib/demo/nyhavna-lokal/schema";

/**
 * Stemmens kunnskapsgrunnlag, bygd av det lokale JSON-datasettet (2026-09-13).
 *
 * ## Samme datasett som boardet og kartet
 *
 * Boardet (`board.ts`) og stemmen (denne fila) leser det SAMME `LocalDataset`.
 * Det er ikke en ryddighet, det er selve kravet: en guide som kjenner steder
 * kartet ikke viser, eller motsatt, ville vært en demo som lyver om hva den
 * har. Kartverktøyene validerer i tillegg hver ID mot boardets kategorier
 * (`executeBoardTool`), så et sted som ikke finnes i datasettet ikke kan få en
 * markør uansett hva modellen finner på.
 *
 * ## Ingen arv fra den andre demoen
 *
 * Ingenting her importerer `lib/demo/nyhavna-leve/` — verken de kuraterte
 * fakta-ene, nettstedsteksten, spørsmålskatalogen eller kart-ID-aliasene.
 * `poiAliases` settes eksplisitt til `{}` og `curatedFor` bygges av datasettet,
 * så standardverdiene (som peker på det frosne snapshotet) ikke kan snike seg
 * inn. Et tomt datasett gir derfor et TOMT faglig grunnlag, og guiden må si at
 * den ikke har informasjonen.
 *
 * ## Samtaleeksemplene er ikke her
 *
 * `conversations.json` lastes ikke av denne modulen og kan ikke nå modellen.
 * En transkripsjon er hva noen SA, ikke hva som er sant.
 */

/** Kildenes status-ord, slik `ProjectInfo` vil ha dem (og slik guiden skal si dem). */
const STATUS_WORDS: Record<LocalStatus, string> = {
  existing: "eksisterende",
  planned: "planlagt",
  "adopted-plan": "vedtatt plan",
  vision: "visjon",
  unresolved: "uavklart",
};

/**
 * Kunnskapsmodellen kjenner fire status-verdier og bruker dem til å velge
 * forbeholdet den legger på svaret. Datasettets fem mappes inn i dem: en vedtatt
 * plan og en visjon er begge «ikke et tilbud i dag», og forskjellen på dem bæres
 * av `caveats` og av temakunnskapens egne status-ord.
 */
const KNOWLEDGE_STATUS: Record<LocalStatus, string> = {
  existing: "existing",
  planned: "planned",
  "adopted-plan": "planned",
  vision: "planned",
  unresolved: "unresolved",
};

const normalize = (value: string) => value.toLocaleLowerCase("nb").trim();

/**
 * Forbehold blir «uavklarte fakta».
 *
 * Kunnskapsverktøyet skiller på `verification`: bekreftede fakta kan sies som
 * fakta, uavklarte returneres som `uncertainties` og skal brukes som forbehold.
 * Et forbehold i datasettet er nettopp det siste, så det er dit det hører.
 */
const caveatFacts = (owner: { caveats: string[]; checkedAt: string; sourceIds: string[] }) =>
  owner.caveats.map((text) => ({
    text,
    sourceId: owner.sourceIds[0] ?? "",
    checkedAt: owner.checkedAt,
    verification: "unresolved" as const,
  }));

function placeEntity(place: LocalPlace): KnowledgeEntityLike {
  return {
    id: place.id,
    name: place.name,
    aliases: place.aliases,
    // Temanøkkelen ER boardets kategori-ID her: datasettet har ingen egen
    // temataksonomi ved siden av kategoriene, og to nøkkelsett ville bare vært
    // to steder å skrive feil.
    themes: [place.categoryId],
    status: KNOWLEDGE_STATUS[place.status],
    mapPoiId: place.id,
    summary: place.summary,
    facts: [
      ...place.facts.map((fact) => ({
        text: fact.text,
        sourceId: fact.sourceId,
        checkedAt: fact.checkedAt,
        verification: fact.verification,
      })),
      ...caveatFacts(place),
    ],
    relations: [],
  };
}

/**
 * Området selv.
 *
 * Bygd av temakunnskapen som IKKE er knyttet til en kategori — det er de
 * utsagnene som gjelder helheten. Uten dem er området et navn uten påstander,
 * som er riktig når datasettet er tomt.
 */
function areaEntity(dataset: LocalDataset): KnowledgeEntityLike {
  const general = dataset.topics.filter((topic) => topic.categoryIds.length === 0);
  return {
    id: dataset.board.id,
    name: dataset.board.name,
    aliases: [],
    themes: dataset.board.categories.map((c) => c.id),
    status: "existing",
    mapPoiId: null,
    summary: dataset.board.intro,
    facts: general.flatMap((topic) => [
      {
        text: topic.text,
        sourceId: topic.sourceIds[0] ?? "",
        checkedAt: topic.checkedAt,
        verification: topic.status === "unresolved" ? ("unresolved" as const) : ("confirmed" as const),
      },
      ...caveatFacts(topic),
    ]),
    relations: [],
  };
}

export function buildKnowledgeBase(dataset: LocalDataset): KnowledgeBase {
  return {
    sources: dataset.sources.map((source) => ({
      id: source.id,
      label: source.label,
      page: source.page,
      url: source.url,
      checkedAt: source.checkedAt,
    })),
    entities: dataset.places.map(placeEntity),
    area: areaEntity(dataset),
  };
}

/**
 * Søkeordene som løfter et temaspørsmål til en kategori.
 *
 * Bygd av kategorinavnene i datasettet, ikke av en håndskrevet ordliste: legger
 * noen til et tema i `board.json`, blir det søkbart i samme slengen. Korte ord
 * («og», «i») droppes — de ville truffet alt.
 */
export function buildThemeWords(dataset: LocalDataset): Record<string, string[]> {
  const words: Record<string, string[]> = {};
  for (const category of dataset.board.categories) {
    // Både navnet og ID-en: ID-en er skrevet av et menneske og bærer ofte det
    // ordet folk faktisk sier («leve-servering»), mens navnet kan være kildens
    // egen overskrift («Café og restauranter»).
    for (const raw of normalize(`${category.name} ${category.id}`).split(/[^a-zæøå]+/)) {
      if (raw.length < 4) continue;
      words[raw] = [...new Set([...(words[raw] ?? []), category.id])];
    }
  }
  return words;
}

export function buildKnowledgeOptions(dataset: LocalDataset): KnowledgeOptions {
  return {
    knowledge: buildKnowledgeBase(dataset),
    // Eksplisitt tom: standarden peker på den ANDRE demoens kart-ID-er.
    poiAliases: {},
    themeWords: buildThemeWords(dataset),
  };
}

/** Kapitlenes kildekontrollerte omtaler: datasettets steder, per kategori. */
export function buildCuratedProvider(dataset: LocalDataset): CuratedProvider {
  const byCategory = new Map<string, LocalPlace[]>();
  for (const place of dataset.places) {
    const bucket = byCategory.get(place.categoryId);
    if (bucket) bucket.push(place);
    else byCategory.set(place.categoryId, [place]);
  }
  return (categoryId) =>
    (byCategory.get(categoryId) ?? []).map((place) => ({
      id: place.id,
      name: place.name,
      map_poi_id: place.id,
      status: KNOWLEDGE_STATUS[place.status],
      summary: place.summary,
      facts: place.facts
        .filter((fact) => fact.verification === "confirmed")
        .slice(0, 3)
        .map((fact) => fact.text),
      uncertainties: [
        ...place.facts.filter((fact) => fact.verification === "unresolved").map((fact) => fact.text),
        ...place.caveats,
      ],
    }));
}

function toProjectInfo(topic: LocalTopic, sources: LocalDataset["sources"]): ProjectInfo {
  const source = sources.find((s) => s.id === topic.sourceIds[0]);
  const caveats = topic.caveats.length ? ` Forbehold: ${topic.caveats.join(" ")}` : "";
  return {
    id: topic.id,
    title: topic.title,
    status: STATUS_WORDS[topic.status],
    text: `${topic.text}${caveats}`,
    source: {
      url: source?.url ?? "",
      page: source?.page ?? "",
      checked_at: topic.checkedAt,
    },
  };
}

/**
 * Temakunnskapen slik samtalen leser den (`find_project_info`).
 *
 * Søket er ordtelling, ikke vektorer: datasettet er lite og håndskrevet, og en
 * deterministisk rangering er lettere å feilsøke enn en modell i midten. Ingen
 * treff = tomt svar, og samtalekoden sier da ærlig at den ikke har grunnlaget.
 */
export function buildProjectInfo(dataset: LocalDataset): ProjectInfoProvider {
  const topics = dataset.topics;
  const forTheme = (themeId: string, limit: number) =>
    topics.filter((topic) => topic.categoryIds.includes(themeId)).slice(0, limit).map((t) => toProjectInfo(t, dataset.sources));

  const search = (query: string, themes: readonly string[], limit: number) => {
    const terms = normalize(query).split(/[^a-z0-9æøå]+/).filter((term) => term.length > 2);
    if (!terms.length) return [];
    const themeSet = new Set(themes);
    const scored = topics
      .map((topic) => {
        const haystack = normalize(`${topic.title} ${topic.text} ${topic.keywords.join(" ")}`);
        const hits = terms.filter((term) => haystack.includes(term)).length;
        if (!hits) return null;
        // Temaet man står i vinner ved likt antall treff: spørsmålet stilles
        // inne i et kapittel, og svaret skal høre til der man er.
        const inTheme = topic.categoryIds.some((id) => themeSet.has(id)) ? 1 : 0;
        return { topic, score: hits * 2 + inTheme };
      })
      .filter((entry): entry is { topic: LocalTopic; score: number } => entry !== null)
      .sort((a, b) => b.score - a.score || a.topic.id.localeCompare(b.topic.id, "nb"));
    return scored.slice(0, limit).map((entry) => toProjectInfo(entry.topic, dataset.sources));
  };

  return { forTheme, search };
}

/** Alt samtalen trenger fra datasettet, i ett kall. */
export function buildVoiceDeps(dataset: LocalDataset) {
  return {
    knowledge: buildKnowledgeOptions(dataset),
    curatedFor: buildCuratedProvider(dataset),
    projectInfo: buildProjectInfo(dataset),
  };
}

/**
 * Guidens instruksjon når datagrunnlaget er tomt eller tynt.
 *
 * Legges til hovedinstruksjonen, ikke i stedet for den: reglene om språk,
 * lengde, kart og kilder gjelder like fullt. Det som må sies eksplisitt er at
 * TAUSHET i dataene ikke er en invitasjon til å fylle hullet med generell
 * modellkunnskap — det er den ene feilen en demo om et konkret sted ikke har råd
 * til å gjøre foran kunden.
 */
export const LOCAL_DEMO_INSTRUCTION =
  "DEMOENS DATAGRUNNLAG: Denne demoen har et lokalt, kontrollert datasett som kan være tomt eller dekke få temaer. Har ikke verktøyene et svar, si kort og naturlig at du ikke har det i materialet ennå, og tilby gjerne å fortelle om noe du faktisk har. Ikke fyll hullet med generell kunnskap om Trondheim eller Nyhavna, ikke gjett, og ikke søk på nettet. Tom kategori betyr at innholdet ikke er lagt inn, ikke at tilbudet ikke finnes – si det slik.\nKARTET I DENNE DEMOEN: Demoen har ingen steder i kartet. Kartet er geografisk bakgrunn, ingenting mer. Ikke kall highlight_places eller show_place, ikke lov å vise, markere eller peke ut et sted, og ikke si «her ser du» eller «på kartet». Katalogsvarene navngir steder og oppgir minutter fra et annet Placy-board; gjengi navn, tall og forbehold som de står, men ikke påstå at stedene ligger i dette kartet.";

