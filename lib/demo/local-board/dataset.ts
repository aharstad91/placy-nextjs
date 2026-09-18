import { isAnchorPOI } from "@/lib/board/anchor-poi";
import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ZodType } from "zod";
import type { LocalDemoDescriptor } from "@/lib/demo/local-board/registry";
import { LocalDatasetError } from "@/lib/demo/local-board/errors";
import { PLACE_FILES, readPlaceStorage } from "@/lib/demo/local-board/place-storage";
import { BOARD_PROFILES, IMPLEMENTED_PROFILES, isImplementedProfile } from "@/lib/demo/local-board/profiles";
import {
  localBoardSchema,
  localConversationsSchema,
  localFaqsSchema,
  localPlacesSchema,
  localSourcesSchema,
  localTopicsSchema,
  type LocalConversation,
  type LocalDataset,
  type LocalTopic,
} from "@/lib/demo/local-board/schema";

/**
 * Lasteren for lokale demo-datasett (2026-09-13, delt kjerne 2026-09-18).
 *
 * Hvilket datasett som lastes kommer fra registerets deskriptor, aldri fra en
 * standardmappe: en laster med en innebygd standard ville lastet Nyhavna når
 * oppringeren glemte å si hvem den spurte for.
 *
 * ## Hvorfor filer og ikke Supabase
 *
 * Demoen skal kunne fylles med innhold av et menneske eller en agent som
 * redigerer JSON, og den skal kunne være TOM uten at noe annet lekker inn. En
 * database ville gitt begge deler motsatt fortegn: innhold måtte gå gjennom en
 * migrasjon, og den delte POI-poolen ville fylt kategoriene med steder demoen
 * ikke har kontrollert. Ingenting her leser eller skriver Supabase.
 *
 * ## Grensen
 *
 * Dette er HELE grensen mellom innholdskilden og presentasjonen: `loadDataset`
 * gir et validert `LocalDataset`, og `board.ts`/`voice.ts` bygger boardet og
 * stemmens kunnskap av det. Skal kilden byttes senere (CMS, database, API), er
 * det denne ene funksjonen som skiftes ut — ingen board-komponent vet hvor
 * dataene kom fra. Bevisst ingen adapter-rammeverk: én funksjon, én form.
 *
 * ## Feil skal være til å forstå
 *
 * Ugyldige data og brutte referanser kaster med filnavn, sti i JSON-en og hva
 * som manglet. En demo som starter med et halvt datasett er verre enn en som
 * ikke starter: da oppdages hullet på møtet i stedet for i terminalen.
 */

export { LocalDatasetError };

const FILES = {
  board: "board.json",
  sources: "sources.json",
  places: "places.json eller places-audited.json + places-register.json",
  topics: "topics.json",
  faq: "faq.json",
  conversations: "conversations.json",
} as const;

async function readJson(descriptor: LocalDemoDescriptor, file: string): Promise<unknown> {
  const path = join(descriptor.directory, file);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    throw new LocalDatasetError(
      `Fant ikke ${path}. Demoen trenger alle seks filene i ${descriptor.directory}/ — se ${descriptor.readme}.`,
    );
  }
  return parseJson(raw, path);
}

function parse<T>(schema: ZodType<T>, value: unknown, file: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issues = result.error.issues
    .slice(0, 10)
    .map((issue) => `  • ${issue.path.join(".") || "(rot)"}: ${issue.message}`)
    .join("\n");
  throw new LocalDatasetError(`${file} har ugyldige data:\n${issues}`);
}

function parseJson(raw: string, path: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new LocalDatasetError(
      `${path} er ikke gyldig JSON: ${error instanceof Error ? error.message : "ukjent feil"}`,
    );
  }
}

/**
 * Små datasett kan fortsatt ligge i én `places.json`. Store datasett kan dele
 * det håndreviderte laget fra det genererte registeret. Filparet er atomisk:
 * lasteren godtar aldri bare én fil eller både gammelt og nytt format, fordi
 * det ville gjort det uklart hvilket lag som faktisk er autoritativt.
 */
async function readPlaces(descriptor: LocalDemoDescriptor) {
  const storage = await readPlaceStorage(descriptor.directory, descriptor.readme);
  if (storage.format === "legacy") {
    const raw = parseJson(storage.legacyRaw, join(descriptor.directory, PLACE_FILES.legacy));
    return parse(localPlacesSchema, raw, PLACE_FILES.legacy);
  }

  const auditedRaw = parseJson(storage.auditedRaw, join(descriptor.directory, PLACE_FILES.audited));
  const registerRaw = parseJson(storage.registerRaw, join(descriptor.directory, PLACE_FILES.register));
  const audited = parse(localPlacesSchema, auditedRaw, PLACE_FILES.audited);
  const register = parse(localPlacesSchema, registerRaw, PLACE_FILES.register);
  const misplacedAudited = audited.filter((place) => place.knowledgeLevel !== "audited").map((place) => place.id);
  const misplacedRegister = register.filter((place) => place.knowledgeLevel !== "register").map((place) => place.id);
  if (misplacedAudited.length || misplacedRegister.length) {
    const problems = [
      misplacedAudited.length
        ? `${PLACE_FILES.audited} skal bare inneholde audited-steder: ${misplacedAudited.join(", ")}`
        : undefined,
      misplacedRegister.length
        ? `${PLACE_FILES.register} skal bare inneholde register-steder: ${misplacedRegister.join(", ")}`
        : undefined,
    ].filter(Boolean);
    throw new LocalDatasetError(`${descriptor.directory}/ har steder i feil kunnskapslag:\n${problems.map((p) => `  • ${p}`).join("\n")}`);
  }
  return [...audited, ...register];
}

/** Alle ID-ene i ei liste som forekommer mer enn én gang. */
function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) twice.add(id);
    seen.add(id);
  }
  return [...twice].sort();
}


/**
 * Referansesjekken for ETT utbyggingsobjekt.
 *
 * Tre av reglene finnes fordi betydningen ellers stille ville forsvunnet:
 * en `claimId` som ikke treffer en påstand gjør sammendraget usporbart, en
 * `buildingId` som peker på noe annet enn et bygg gjør innflyttingskoblingen
 * til en påstand om ingenting, og `availability: "open"` uten påstand er
 * nøyaktig det ene svaret demoen ikke har lov til å gi uten kilde.
 */
function developmentProblems(
  topic: LocalTopic,
  owner: string,
  known: { sourceIds: ReadonlySet<string>; placeIds: ReadonlySet<string>; buildingIds: ReadonlySet<string> },
): string[] {
  const development = topic.development;
  if (!development) return [];
  const problems: string[] = [];
  const claimIds = new Set(development.claims.map((c) => c.id));

  const dupeClaims = duplicates(development.claims.map((c) => c.id));
  if (dupeClaims.length) problems.push(`${owner} → development.claims: ID-en(e) ${dupeClaims.join(", ")} finnes flere ganger.`);
  for (const claim of development.claims) {
    if (!known.sourceIds.has(claim.sourceId)) {
      problems.push(`${owner} → development.claims «${claim.id}»: ukjent sourceId «${claim.sourceId}» (mangler i ${FILES.sources}).`);
    }
  }

  const claim = (field: string, id: string | undefined) => {
    if (id && !claimIds.has(id)) problems.push(`${owner} → development.${field}: ukjent claimId «${id}» (mangler i objektets egne claims).`);
  };
  claim("buildStatusClaimId", development.buildStatusClaimId);
  claim("availabilityClaimId", development.availabilityClaimId);
  claim("timing.claimId", development.timing?.claimId);
  claim("access.claimId", development.access.claimId);

  if (development.availability === "open") {
    const claimId = development.availabilityClaimId;
    if (!claimId) {
      problems.push(`${owner} → development.availability: «open» krever availabilityClaimId — at noe er åpent må ha en påstand med kilde.`);
    } else {
      // En uavklart påstand er per definisjon noe vi IKKE sier som fakta. At den
      // likevel kan bære «open» ville gjort forbeholdet usynlig: projeksjonen
      // skriver «åpnet» uten et eneste forbehold, og stemmen sier det videre.
      const referenced = development.claims.find((c) => c.id === claimId);
      if (referenced && referenced.verification !== "confirmed") {
        problems.push(
          `${owner} → development.availability: «open» krever en bekreftet påstand (verification: confirmed); «${claimId}» er uavklart.`,
        );
      }
    }
  }

  const building = (field: string, id: string) => {
    if (id === topic.id) problems.push(`${owner} → development.${field}: «${id}» peker på objektet selv.`);
    else if (!known.buildingIds.has(id)) problems.push(`${owner} → development.${field}: «${id}» er ikke et tema med objectType «building».`);
  };
  if (development.access.scope === "named-buildings") {
    if (!development.access.buildingIds.length) {
      problems.push(`${owner} → development.access: scope «named-buildings» krever minst én buildingId.`);
    }
    for (const id of development.access.buildingIds) building("access.buildingIds", id);
  } else if (development.access.buildingIds.length) {
    problems.push(`${owner} → development.access: buildingIds gjelder bare scope «named-buildings».`);
  }

  for (const link of development.moveInLinks) {
    building("moveInLinks.buildingId", link.buildingId);
    if (!known.sourceIds.has(link.confirmedBy)) {
      problems.push(`${owner} → development.moveInLinks: ukjent confirmedBy «${link.confirmedBy}» (mangler i ${FILES.sources}).`);
    }
    claim("moveInLinks.claimId", link.claimId);
  }

  for (const conflict of development.conflicts) {
    for (const id of conflict.claimIds) claim("conflicts.claimIds", id);
  }

  const placeId = development.mapAnchor?.placeId;
  if (placeId && !known.placeIds.has(placeId)) {
    problems.push(`${owner} → development.mapAnchor: ukjent placeId «${placeId}» (mangler i ${FILES.places}).`);
  }

  return problems;
}

/**
 * Referansesjekken.
 *
 * Zod validerer FORMEN på hver fil for seg; her sjekkes at filene peker på
 * hverandre riktig. Det er den feilen som faktisk skjer når man skriver innhold
 * for hånd: en skrivefeil i en `categoryId`, en `sourceId` som ble hetende noe
 * annet, to steder med samme ID.
 */
function assertProfile(dataset: LocalDataset): void {
  const profile = dataset.board.profile;
  if (isImplementedProfile(profile)) return;
  // Egen feil, ikke en linje i referanselista: dette er ikke en skrivefeil som
  // kan rettes i datasettet, det er en profil koden ennå ikke bærer begrepene
  // for. Å laste den som et boligprosjekt ville gitt en demo som later som den
  // har kunnskap den aldri har definert.
  throw new LocalDatasetError(
    `Profilen «${profile}» (${BOARD_PROFILES[profile].label}) er dokumentert men ikke implementert. ` +
      `Implementerte profiler: ${IMPLEMENTED_PROFILES.join(", ")}. ` +
      `Kunnskapsbehovet står i docs/demos/board-profiler.md: ${BOARD_PROFILES[profile].knowledgeNeeds}`,
  );
}

export function assertReferences(dataset: LocalDataset, descriptor: LocalDemoDescriptor): void {
  assertProfile(dataset);
  const problems: string[] = [];

  const categoryIds = new Set(dataset.board.categories.map((c) => c.id));
  const sourceIds = new Set(dataset.sources.map((s) => s.id));
  const placeById = new Map(dataset.places.map(p => [p.id, p]));
  const placeIds = new Set(placeById.keys());
  const childCountByParentId = new Map<string, number>();
  for (const place of dataset.places) {
    if (place.parentPlaceId) childCountByParentId.set(place.parentPlaceId, (childCountByParentId.get(place.parentPlaceId) ?? 0) + 1);
  }

  const dupe = (file: string, ids: string[]) => {
    const found = duplicates(ids);
    if (found.length) problems.push(`${file}: ID-en(e) ${found.join(", ")} finnes flere ganger.`);
  };
  dupe(FILES.board, dataset.board.categories.map((c) => c.id));
  dupe(FILES.sources, dataset.sources.map((s) => s.id));
  dupe(FILES.places, dataset.places.map((p) => p.id));
  dupe(FILES.topics, dataset.topics.map((t) => t.id));

  const source = (owner: string, ids: readonly string[]) => {
    for (const id of ids) {
      if (!sourceIds.has(id)) problems.push(`${owner}: ukjent sourceId «${id}» (mangler i ${FILES.sources}).`);
    }
  };

  for (const category of dataset.board.categories) {
    if (category.sourceId) source(`${FILES.board} → kategori «${category.id}»`, [category.sourceId]);
  }

  for (const id of dataset.board.discoveryCategoryIds) {
    if (!categoryIds.has(id)) problems.push(`${FILES.board} → discoveryCategoryIds: ukjent categoryId «${id}».`);
  }

  dupe("board.json → presentation", (dataset.board.presentation ?? []).map(s => s.id));
  for (const segment of dataset.board.presentation ?? []) {
    const owner = `board.json → presentation «${segment.id}»`;
    if (!categoryIds.has(segment.categoryId)) problems.push(`${owner}: ukjent categoryId «${segment.categoryId}».`);
    for (const id of segment.placeIds) {
      const place = dataset.places.find(p => p.id === id);
      if (!place) problems.push(`${owner}: ukjent placeId «${id}».`);
      else if (place.categoryId !== segment.categoryId) problems.push(`${owner}: stedet «${id}» tilhører kategorien «${place.categoryId}», ikke «${segment.categoryId}».`);
    }
    source(owner, segment.sourceIds);
  }

  for (const place of dataset.places) {
    const owner = `${FILES.places} → «${place.id}»`;
    if (!categoryIds.has(place.categoryId)) {
      problems.push(`${owner}: ukjent categoryId «${place.categoryId}» (mangler i ${FILES.board}).`);
    }
    if (place.parentPlaceId) {
      const parent = placeById.get(place.parentPlaceId);
      if (place.parentPlaceId === place.id || !parent || !isAnchorPOI(parent) || parent.parentPlaceId || isAnchorPOI(place)) {
        problems.push(`${owner}: parentPlaceId må peke til et annet, selvstendig anker.`);
      }
    }
    if (isAnchorPOI(place) && !place.anchorKeepsOwnName && (childCountByParentId.get(place.id) ?? 0) < 4) {
      problems.push(`${owner}: kjøpesenter må ha minst fire dokumenterte virksomheter.`);
    }
    if (place.anchorKeepsOwnName && !isAnchorPOI(place)) {
      problems.push(`${owner}: anchorKeepsOwnName krever anchorSummary — ellers finnes det ikke noe anker å navngi.`);
    }
    if (isAnchorPOI(place) && place.anchorKeepsOwnName && (childCountByParentId.get(place.id) ?? 0) < 1) {
      problems.push(`${owner}: generisk anker må ha minst ett dokumentert medlem.`);
    }
    source(owner, place.sourceIds);
    source(owner, place.facts.map((f) => f.sourceId));
    dupe(`${owner} → facts`, place.facts.map((f) => f.id));
    if (place.locationNote && place.locationPrecision !== "approximate") {
      problems.push(`${owner}: locationNote er forbeholdet til en omtrentlig plassering — sett locationPrecision: "approximate", eller fjern notatet.`);
    }
  }

  const buildingIds = new Set(
    dataset.topics.filter((t) => t.development?.objectType === "building").map((t) => t.id),
  );
  // Kartankeret slår opp objektet på stedets ID. Deler to objekter anker, ville
  // det ene stille forsvunnet fra både kartet og stedsfaktaene mens fritekstsøket
  // fortsatt fant begge — samme demo, to forskjellige svar.
  const anchoredPlaceIds: string[] = [];
  for (const topic of dataset.topics) {
    const owner = `${FILES.topics} → «${topic.id}»`;
    const anchoredPlaceId = topic.development?.mapAnchor?.placeId;
    if (anchoredPlaceId) anchoredPlaceIds.push(anchoredPlaceId);
    for (const id of topic.categoryIds) {
      if (!categoryIds.has(id)) problems.push(`${owner}: ukjent categoryId «${id}» (mangler i ${FILES.board}).`);
    }
    for (const id of topic.relatedPlaceIds) {
      if (!placeIds.has(id)) problems.push(`${owner}: ukjent relatedPlaceId «${id}» (mangler i ${FILES.places}).`);
    }
    source(owner, topic.sourceIds);
    if (topic.development) problems.push(...developmentProblems(topic, owner, { sourceIds, placeIds, buildingIds }));
  }
  dupe(`${FILES.topics} → development.mapAnchor.placeId`, anchoredPlaceIds);

  dupe(FILES.faq, dataset.faqs.map((f) => f.id));
  for (const entry of dataset.faqs) {
    const owner = `${FILES.faq} → «${entry.id}»`;
    if (entry.categoryId && !categoryIds.has(entry.categoryId)) {
      problems.push(`${owner}: ukjent categoryId «${entry.categoryId}» (mangler i ${FILES.board}). Utelat feltet hvis spørsmålet gjelder hele området.`);
    }
    source(owner, entry.sourceIds);
    // Et importert svar uten kilde ville vært en påstand uten opphav: teksten
    // er skrevet et annet sted, og da må det stå hvor.
    if (entry.origin === "imported" && entry.sourceIds.length === 0) {
      problems.push(`${owner}: origin er "imported", men sourceIds er tom — oppgi hvor svaret er hentet fra.`);
    }
    for (const match of entry.answer.matchAll(/\[[^\]]+\]\(poi:([^)]+)\)/g)) {
      if (!placeIds.has(match[1].trim())) problems.push(`${owner}: ukjent kartsted «${match[1]}» i svaret.`);
    }
    // Kategorilenker i svaret: degraderer til ren tekst på flaten, men en
    // lenke som aldri kan klikkes er en skrivefeil, ikke en variant.
    for (const match of entry.answer.matchAll(/\[[^\]]+\]\(category:([^)]+)\)/g)) {
      const id = match[1].trim();
      if (!categoryIds.has(id)) problems.push(`${owner}: svaret lenker til ukjent kategori «${id}» (mangler i ${FILES.board}).`);
    }
  }

  if (problems.length) {
    throw new LocalDatasetError(
      `Datasettet i ${descriptor.directory}/ har brutte referanser:\n${problems.map((p) => `  • ${p}`).join("\n")}`,
    );
  }
}

/**
 * Leser og validerer datasettet.
 *
 * Samtaleeksemplene lastes IKKE her: de er testgrunnlag, ikke faktagrunnlag, og
 * skal ikke kunne havne i noe som sendes til modellen ved et uhell. Bruk
 * `loadConversations` når du faktisk vil lese dem.
 */
export async function loadDataset(descriptor: LocalDemoDescriptor): Promise<LocalDataset> {
  const [board, sources, places, topics, faqs] = await Promise.all([
    readJson(descriptor, FILES.board),
    readJson(descriptor, FILES.sources),
    readPlaces(descriptor),
    readJson(descriptor, FILES.topics),
    readJson(descriptor, FILES.faq),
  ]);
  const dataset: LocalDataset = {
    board: parse(localBoardSchema, board, FILES.board),
    sources: parse(localSourcesSchema, sources, FILES.sources),
    places,
    topics: parse(localTopicsSchema, topics, FILES.topics),
    faqs: parse(localFaqsSchema, faqs, FILES.faq),
  };
  assertReferences(dataset, descriptor);
  return dataset;
}

/**
 * Samtaleeksemplene, lest for seg.
 *
 * Ingen annen modul i demoen kaller denne. Den finnes så en test, et script
 * eller en person kan lese eksemplene — ikke så modellen kan.
 */
export async function loadConversations(descriptor: LocalDemoDescriptor): Promise<LocalConversation[]> {
  const raw = await readJson(descriptor, FILES.conversations);
  return parse(localConversationsSchema, raw, FILES.conversations);
}
