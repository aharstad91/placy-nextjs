import "server-only";

import registryFile from "@/data/demo/nyhavna-lokal/sources.json";
import { parseSourceRegistry, type SourceRegistry } from "@/lib/demo/site-chat/sources";

/**
 * Kilderegisteret Nyhavna-chatten viser kilder fra: samme fil som datasettet
 * (`data/demo/nyhavna-lokal/sources.json`). Reglene er de felles
 * (`lib/demo/site-chat/sources.ts`): en kilde vises bare når modellen
 * siterte den OG et verktøysvar i samme melding returnerte den.
 */
let cached: SourceRegistry | null = null;

export function nyhavnaSourceRegistry(): SourceRegistry {
  cached ??= parseSourceRegistry(registryFile);
  return cached;
}
