import "server-only";

import { z } from "zod";

/**
 * Kilderegisteret et chatsvar kan vise kilder fra (2026-09-24), felles for alle
 * kunder. Hver kunde gir sin egen liste (datasettets `sources.json`) gjennom
 * `parseSourceRegistry`; det er den ENESTE lista over kilder et svar kan vise.
 * En kilde-ID er bare bevis når den (1) står i et verktøysvar fra DENNE
 * meldingen og (2) finnes i kundens register. En ID modellen skriver selv,
 * eller en registerkilde verktøyene ikke returnerte, blir aldri vist.
 *
 * Grensen: at en kilde sto i verktøysvaret og at modellen siterte den, betyr at
 * kilden var en del av grunnlaget — ikke at hver setning i svaret er
 * kontrollert mot den. Skjemaet kan ikke bevise påstand-for-påstand-dekning.
 */

const sourceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  page: z.string(),
  url: z.string().url(),
  checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type RegistrySource = z.infer<typeof sourceSchema>;

/** Det widgeten får vise: etikett og kontrolldato, aldri en URL. */
export interface ChatSource {
  id: string;
  label: string;
  page: string;
  checkedAt: string;
}

export interface SourceRegistry {
  byId: (id: string) => RegistrySource | null;
  idForUrl: (url: string) => string | null;
  /** Siste `checkedAt` i registeret — innholdsdatoen chatten oppgir. */
  latestCheckedAt: string;
}

export function createSourceRegistry(sources: readonly RegistrySource[]): SourceRegistry {
  const byId = new Map(sources.map((source) => [source.id, source]));
  const byUrl = new Map(sources.map((source) => [source.url, source.id]));
  const latestCheckedAt = sources.map((source) => source.checkedAt).sort().at(-1) ?? "";
  return {
    byId: (id) => byId.get(id) ?? null,
    idForUrl: (url) => byUrl.get(url) ?? null,
    latestCheckedAt,
  };
}

/** Leser og validerer et kilderegister fra datasettets `sources.json`. */
export function parseSourceRegistry(file: unknown): SourceRegistry {
  return createSourceRegistry(z.array(sourceSchema).parse(file));
}

/**
 * Legger `source_id` på hvert kildeobjekt i et verktøysvar som bare har URL
 * (`find_project_info` og kapitlenes `source`), når URL-en står i registeret.
 * Modellen kan da sitere kilden med ID, og ID-en er utledet av serveren — ikke
 * skrevet av modellen. Returnerer en kopi; samtalens egne objekter endres ikke.
 */
export function annotateSourceIds(output: unknown, registry: SourceRegistry): unknown {
  if (Array.isArray(output)) return output.map((item) => annotateSourceIds(item, registry));
  if (!output || typeof output !== "object") return output;
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(output)) copy[key] = annotateSourceIds(value, registry);
  if (typeof copy.url === "string" && copy.source_id === undefined && copy.id === undefined) {
    const id = registry.idForUrl(copy.url);
    if (id) copy.source_id = id;
  }
  return copy;
}

/**
 * Alle registerkilder et (annotert) verktøysvar faktisk bærer: `source_id` på
 * fakta og kildeobjekter, og `id` i en `sources`-liste. Alt som ikke finnes i
 * registeret faller bort.
 */
export function sourceIdsInOutput(output: unknown, registry: SourceRegistry): string[] {
  const found = new Set<string>();
  const visit = (value: unknown, inSourceList: boolean) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item, inSourceList);
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (typeof record.source_id === "string" && registry.byId(record.source_id)) found.add(record.source_id);
    if (inSourceList && typeof record.id === "string" && registry.byId(record.id)) found.add(record.id);
    for (const [key, child] of Object.entries(record)) visit(child, key === "sources");
  };
  visit(output, false);
  return [...found];
}

const MAX_SOURCES = 4;

/** Modellens siterte ID-er, snevret inn til dem verktøyene returnerte i denne meldingen. */
export function resolveCitedSources(
  cited: readonly string[],
  verified: ReadonlySet<string>,
  registry: SourceRegistry,
): ChatSource[] {
  const resolved: ChatSource[] = [];
  for (const id of new Set(cited)) {
    if (resolved.length >= MAX_SOURCES) break;
    if (!verified.has(id)) continue;
    const source = registry.byId(id);
    if (source) resolved.push({ id: source.id, label: source.label, page: source.page, checkedAt: source.checkedAt });
  }
  return resolved;
}
