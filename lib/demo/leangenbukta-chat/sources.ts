import "server-only";

import registryFile from "@/data/demo/leangenbukta-lokal/sources.json";
import { parseSourceRegistry, type SourceRegistry } from "@/lib/demo/site-chat/sources";

/** Leangenbuktas kilderegister: samme fil som datasettet `leangenbukta-lokal`. */
let cached: SourceRegistry | null = null;

export function leangenbuktaSourceRegistry(): SourceRegistry {
  cached ??= parseSourceRegistry(registryFile);
  return cached;
}

