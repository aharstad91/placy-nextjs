import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ZodType } from "zod";
import {
  localBoardSchema,
  localConversationsSchema,
  localFaqsSchema,
  localPlacesSchema,
  localSourcesSchema,
  localTopicsSchema,
  type LocalConversation,
  type LocalDataset,
} from "@/lib/demo/nyhavna-lokal/schema";

/**
 * Lasteren for den lokale Nyhavna-demoen (2026-09-13).
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

/** Mappa datasettet ligger i, relativt til repo-rota. */
export const LOCAL_DATASET_DIR = join("data", "demo", "nyhavna-lokal");

/** Datasett-ID-en ruta og stemmen bruker for å slå opp dette datasettet. */
export const LOCAL_DATASET_ID = "nyhavna-lokal";

const FILES = {
  board: "board.json",
  sources: "sources.json",
  places: "places.json",
  topics: "topics.json",
  faq: "faq.json",
  conversations: "conversations.json",
} as const;

export class LocalDatasetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalDatasetError";
  }
}

async function readJson(directory: string, file: string): Promise<unknown> {
  const path = join(directory, file);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    throw new LocalDatasetError(
      `Fant ikke ${path}. Demoen trenger alle seks filene i ${LOCAL_DATASET_DIR}/ — se docs/research/nyhavna-lokal-demo/README.md.`,
    );
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new LocalDatasetError(
      `${path} er ikke gyldig JSON: ${error instanceof Error ? error.message : "ukjent feil"}`,
    );
  }
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
 * Referansesjekken.
 *
 * Zod validerer FORMEN på hver fil for seg; her sjekkes at filene peker på
 * hverandre riktig. Det er den feilen som faktisk skjer når man skriver innhold
 * for hånd: en skrivefeil i en `categoryId`, en `sourceId` som ble hetende noe
 * annet, to steder med samme ID.
 */
export function assertReferences(dataset: LocalDataset): void {
  const problems: string[] = [];

  const categoryIds = new Set(dataset.board.categories.map((c) => c.id));
  const sourceIds = new Set(dataset.sources.map((s) => s.id));
  const placeIds = new Set(dataset.places.map((p) => p.id));

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

  for (const place of dataset.places) {
    const owner = `${FILES.places} → «${place.id}»`;
    if (!categoryIds.has(place.categoryId)) {
      problems.push(`${owner}: ukjent categoryId «${place.categoryId}» (mangler i ${FILES.board}).`);
    }
    source(owner, place.sourceIds);
    source(owner, place.facts.map((f) => f.sourceId));
    dupe(`${owner} → facts`, place.facts.map((f) => f.id));
    if (place.locationNote && place.locationPrecision !== "approximate") {
      problems.push(`${owner}: locationNote er forbeholdet til en omtrentlig plassering — sett locationPrecision: "approximate", eller fjern notatet.`);
    }
  }

  for (const topic of dataset.topics) {
    const owner = `${FILES.topics} → «${topic.id}»`;
    for (const id of topic.categoryIds) {
      if (!categoryIds.has(id)) problems.push(`${owner}: ukjent categoryId «${id}» (mangler i ${FILES.board}).`);
    }
    for (const id of topic.relatedPlaceIds) {
      if (!placeIds.has(id)) problems.push(`${owner}: ukjent relatedPlaceId «${id}» (mangler i ${FILES.places}).`);
    }
    source(owner, topic.sourceIds);
  }

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
      `Datasettet i ${LOCAL_DATASET_DIR}/ har brutte referanser:\n${problems.map((p) => `  • ${p}`).join("\n")}`,
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
export async function loadDataset(directory = LOCAL_DATASET_DIR): Promise<LocalDataset> {
  const [board, sources, places, topics, faqs] = await Promise.all([
    readJson(directory, FILES.board),
    readJson(directory, FILES.sources),
    readJson(directory, FILES.places),
    readJson(directory, FILES.topics),
    readJson(directory, FILES.faq),
  ]);
  const dataset: LocalDataset = {
    board: parse(localBoardSchema, board, FILES.board),
    sources: parse(localSourcesSchema, sources, FILES.sources),
    places: parse(localPlacesSchema, places, FILES.places),
    topics: parse(localTopicsSchema, topics, FILES.topics),
    faqs: parse(localFaqsSchema, faqs, FILES.faq),
  };
  assertReferences(dataset);
  return dataset;
}

/**
 * Samtaleeksemplene, lest for seg.
 *
 * Ingen annen modul i demoen kaller denne. Den finnes så en test, et script
 * eller en person kan lese eksemplene — ikke så modellen kan.
 */
export async function loadConversations(directory = LOCAL_DATASET_DIR): Promise<LocalConversation[]> {
  const raw = await readJson(directory, FILES.conversations);
  return parse(localConversationsSchema, raw, FILES.conversations);
}
