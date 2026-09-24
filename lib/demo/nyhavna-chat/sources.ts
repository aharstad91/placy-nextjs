import "server-only";

import { z } from "zod";
import registryFile from "@/data/demo/nyhavna-lokal/sources.json";
import { createSourceRegistry, type SourceRegistry } from "@/lib/demo/leangenbukta-chat/sources";

/**
 * Kilderegisteret Nyhavna-chatten viser kilder fra: samme fil som datasettet
 * (`data/demo/nyhavna-lokal/sources.json`). Reglene er Leangenbuktas
 * (`lib/demo/leangenbukta-chat/sources.ts`): en kilde vises bare når modellen
 * siterte den OG et verktøysvar i samme melding returnerte den.
 */
const sourceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  page: z.string(),
  url: z.string().url(),
  checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

let cached: SourceRegistry | null = null;

export function nyhavnaSourceRegistry(): SourceRegistry {
  cached ??= createSourceRegistry(z.array(sourceSchema).parse(registryFile));
  return cached;
}
