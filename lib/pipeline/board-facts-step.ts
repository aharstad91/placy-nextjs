/**
 * Provisjoneringssteget som henter boardets deterministiske fakta og skriver
 * dem til `products.config.reportConfig.boardFacts`.
 *
 * Plassering i rekkefølgen: ETTER reisetidene (steg 7) og FØR editorial-arven
 * (steg 8). Ikke fordi de deler data — de gjør ikke det — men fordi begge gjør
 * read-modify-write mot samme config-rad, og to skriv i samme retning er
 * lettere å resonnere om enn to som møtes.
 *
 * ATOMISK: hele `boardFacts` skrives i ÉN PATCH med optimistisk lås på
 * `updated_at` (`patchProductConfigWithLock`). Delvise fakta er greit å LAGRE
 * — et board uten sentrumsreise er et board der det spørsmålet utelates — men
 * en delvis SKRIVING er ikke, for da vet ingen hva som står der.
 *
 * FAIL-SOFT: steget kaster aldri. En Entur-nedetid skal ikke stoppe en
 * provisjonering; boardet står da uten FAQ-transportsvar og med resten intakt.
 */

import { computeBoardFacts } from "@/lib/pipeline/board-facts";
import { patchProductConfigWithLock } from "@/lib/pipeline/patch-product-config";
import type { ReportBoardFacts } from "@/lib/types";

/** Timeout på Supabase REST — samme mønster som editorial-arven. */
const REST_TIMEOUT_MS = 30_000;

export interface BoardFactsStepResult {
  /** true → ingenting skrevet (ingen fakta, eller fail-soft-stopp). */
  skipped?: boolean;
  facts?: ReportBoardFacts;
  warnings: string[];
}

interface ProductRow {
  id: string;
  config: unknown;
  updated_at: string;
}

export async function runBoardFactsStep(options: {
  productId: string;
  lat: number;
  lng: number;
  city?: string;
  kommunenummer?: string;
  /** Injiserbar for tester. */
  now?: Date;
}): Promise<BoardFactsStepResult> {
  const { productId, lat, lng, city, kommunenummer, now } = options;

  const { facts, warnings } = await computeBoardFacts({ lat, lng, city, kommunenummer, now });
  if (!facts) return { skipped: true, warnings };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    warnings.push(
      "⚠️  NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY mangler — board-fakta ikke skrevet",
    );
    return { skipped: true, facts, warnings };
  }

  const getUrl = new URL(`${supabaseUrl}/rest/v1/products`);
  getUrl.searchParams.set("id", `eq.${productId}`);
  getUrl.searchParams.set("select", "id,config,updated_at");

  let rows: ProductRow[];
  try {
    const res = await fetch(getUrl.toString(), {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        // v2 er eneste skjema etter cutover; rå REST treffer `public` som default.
        "Accept-Profile": "v2",
      },
      signal: AbortSignal.timeout(REST_TIMEOUT_MS),
    });
    if (!res.ok) {
      warnings.push(`⚠️  Henting av products-rad feilet (${res.status}) — board-fakta ikke skrevet`);
      return { skipped: true, facts, warnings };
    }
    rows = (await res.json()) as ProductRow[];
  } catch (e) {
    warnings.push(
      `⚠️  Henting av products-rad feilet (${message(e)}) — board-fakta ikke skrevet`,
    );
    return { skipped: true, facts, warnings };
  }

  const product = Array.isArray(rows) ? rows[0] : undefined;
  if (!product) {
    warnings.push(`⚠️  Ingen products-rad for id=${productId} — board-fakta ikke skrevet`);
    return { skipped: true, facts, warnings };
  }

  // jsonb-vs-streng: config kan være lagret som jsonb ELLER som JSON-streng.
  // Formen må BEVARES ved skriving, ellers bytter raden representasjon under
  // føttene på alle andre lesere (dokumentert i jsonb-merge-læringen).
  const configWasString = typeof product.config === "string";
  let existingConfig: Record<string, unknown>;
  if (configWasString) {
    try {
      existingConfig = JSON.parse(product.config as string) as Record<string, unknown>;
    } catch {
      warnings.push(
        `⚠️  products.config for ${product.id} er korrupt JSON-streng — board-fakta ikke skrevet`,
      );
      return { skipped: true, facts, warnings };
    }
  } else {
    existingConfig = (product.config ?? {}) as Record<string, unknown>;
  }

  const rc = (existingConfig.reportConfig ?? {}) as Record<string, unknown>;
  // Spread-merge KUN boardFacts-nøkkelen: temaer, grounding, lyd og alt annet
  // i config overlever urørt. Re-kjøring overskriver faktaene i sin helhet —
  // de er et øyeblikksbilde, ikke noe som skal flettes med et eldre.
  const nextConfig = {
    ...existingConfig,
    reportConfig: { ...rc, boardFacts: facts },
  };

  const patched = await patchProductConfigWithLock({
    supabaseUrl,
    supabaseKey: serviceKey,
    productId: product.id,
    updatedAt: product.updated_at,
    config: configWasString ? JSON.stringify(nextConfig) : nextConfig,
  });

  if (!patched.ok) {
    warnings.push(
      patched.reason === "zero-rows"
        ? "⚠️  Optimistisk lås: products.updated_at endret seg under kjøringen — board-fakta IKKE skrevet (re-kjør steget)"
        : `⚠️  PATCH av board-fakta feilet (${patched.status}) — ingenting skrevet`,
    );
    return { skipped: true, facts, warnings };
  }

  return { facts, warnings };
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : "ukjent feil";
}
