/**
 * Cachede lesestier for board-sidene (ISR-vennlige).
 *
 * Supabase-klienten fetcher med `cache: "no-store"`, og en no-store-fetch
 * under render tvinger HELE ruten til dynamisk rendering i Next 14 — da er
 * `export const revalidate` virkningsløs og hver visning server-rendres live
 * (målt 2026-07-07: x-vercel-cache MISS på alle board-requests). unstable_cache
 * isolerer fetchene fra rutens staticness-sporing OG cacher resultatet.
 *
 * Cache-busting følger det etablerte tag-designet: `revalidateTag("product:
 * ${customer}_${slug}")` (se CLAUDE.md §LLM-integrasjon) — translations deler
 * produkt-taggen slik at én bust tar begge. IKKE legg poiIds/themeIds i
 * cache-nøkkelen: de utledes deterministisk av det cachede produktet og
 * busts derfor alltid i takt med det via taggen.
 */

import { unstable_cache } from "next/cache";
import { gzipSync, gunzipSync } from "node:zlib";
import { getProductAsync } from "@/lib/data-server";
import {
  getProjectTranslations,
  type Locale,
  type TranslationMap,
} from "@/lib/supabase/translations";
import type { Project } from "@/lib/types";

const REVALIDATE_SECONDS = 3600;

export async function getCachedReportProduct(
  customer: string,
  projectSlug: string,
): Promise<Project | null> {
  // Full paginated boards exceed Next's 2 MB per-entry limit (Wesselsløkka:
  // ~3 MB). Cache compressed JSON, restore the identical Project at the boundary.
  const compressed = await unstable_cache(
    async () => {
      const project = await getProductAsync(customer, projectSlug, "report");
      return project === null ? null : gzipSync(JSON.stringify(project)).toString("base64");
    },
    ["report-product-gzip-v1", customer, projectSlug],
    {
      tags: [`product:${customer}_${projectSlug}`],
      revalidate: REVALIDATE_SECONDS,
    },
  )();
  return compressed === null ? null : JSON.parse(gunzipSync(Buffer.from(compressed, "base64")).toString("utf8")) as Project;
}

export function getCachedProjectTranslations(
  customer: string,
  projectSlug: string,
  locale: Locale,
  poiIds: string[],
  themeIds: string[],
  reportProductId: string,
): Promise<TranslationMap> {
  return unstable_cache(
    () => getProjectTranslations(locale, poiIds, themeIds, reportProductId),
    ["report-translations", customer, projectSlug, locale],
    {
      tags: [`product:${customer}_${projectSlug}`],
      revalidate: REVALIDATE_SECONDS,
    },
  )();
}
