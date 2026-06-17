/**
 * Editorial-arv med highlight-fallback (R4, R6, R7, R9) — kjernen i
 * nabolags-arv-PoC-en. Kjøres ETTER hydrering (Steg 6 — board-settet må
 * eksistere) og FØR revalidering.
 *
 * Flyt:
 *   1. `findAreaForPoint(lat, lng)` — ingen treff → `{ skipped: true }`,
 *      config urørt (R2: nivå 1-fallback)
 *   2. Board-settet beregnes via SAMME kodesti som rendering
 *      (`getProductFromSupabase` → `transformToReportData`) — aldri
 *      replikerte filtre som kan drifte
 *   3. Per tema i `area.report_editorial`: gå gjennom `highlightCandidates`
 *      i kurator-prioritert rekkefølge, behold de første inntil
 *      MAX_HIGHLIGHTS som finnes i temaets filtrerte `allPOIs`. Hver droppet
 *      kandidat klassifiseres (R9): `ikke-i-db` / `under-trust` /
 *      `utenfor-board` — fail-soft: kan årsaken ikke avgjøres brukes
 *      `utenfor-board` + warning
 *   4. ATOMISK skriving: patches for ALLE temaer beregnes først, deretter ÉN
 *      read-modify-write mot `products.config` med `updated_at`-optimistisk
 *      lås. Per-tema-PATCH i løkke er forbudt — midt-løkke-feil ville
 *      etterlate delvis editorial og bryte tier-konsistensen.
 *
 * Import-gotcha (MÅ bevares): `@/lib/supabase/queries` og
 * `@/components/variants/report/report-data` trekkes inn via dynamisk
 * `await import()` INNE i steg-funksjonen — queries.ts leser den modul-nivå
 * anon-klienten fra client.ts (bygget ved import-tid), og report-data drar
 * en "use client"-kjede (ReportHeroInsight → next/image/Radix) som ikke
 * skal inn i den statiske grafen til alle konsumenter av denne modulen.
 * NB: dynamisk import alene er IKKE nok i scripts — kjørende script må
 * laste env FØR client.ts evalueres (`import "./load-env"` som FØRSTE
 * import, se scripts/load-env.ts), ellers er anon-klienten modul-cachet
 * null og `getProductFromSupabase` returnerer stille null.
 *
 * Fail-soft (warnings, ikke abort) — UNNTATT skrive-/optimistisk-lås-feil
 * og korrupt config, som kaster høylytt (aldri delvis/utrygg skriving).
 */

import { findAreaForPoint } from "@/lib/pipeline/find-area-for-point";
import { ThemeEditorialStagingSchema } from "@/lib/pipeline/area-staging";
import { createServerClient } from "@/lib/supabase/client";
import { MIN_TRUST_SCORE } from "@/lib/utils/poi-trust";
import type { ReportThemeEditorial } from "@/lib/types";

/** Visningstaket — kurateringen har 4–6 kandidater per tema som slack. */
const MAX_HIGHLIGHTS = 3;

/** Timeout på Supabase REST-kall — henger aldri evig (mønster: checkWebsite). */
const REST_TIMEOUT_MS = 30_000;

/** fetch med AbortController-timeout — timeout/nettverksfeil kaster som annen fetch-feil. */
async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export type HighlightDropReason = "ikke-i-db" | "under-trust" | "utenfor-board";

export interface DroppedHighlight {
  themeId: string;
  id: string;
  reason: HighlightDropReason;
}

export interface InheritAreaEditorialResult {
  /** true → ingen kuratert område (nivå 1, R2) eller fail-soft-stopp — config urørt */
  skipped?: boolean;
  /** Navn på området editorial arves fra (når funnet) */
  areaName?: string;
  /** Tema-IDer som fikk editorial skrevet i denne kjøringen */
  themesInherited: string[];
  /** R9-loggen: beholdte highlights + droppede kandidater med årsak */
  highlights: { kept: number; dropped: DroppedHighlight[] };
  warnings: string[];
}

// ── Lokale config-former (samme løse typing som apply-curation-staging) ──

interface ConfigTheme {
  id: string;
  editorial?: ReportThemeEditorial;
  [k: string]: unknown;
}

interface ProductRow {
  id: string;
  config: unknown;
  updated_at: string;
}

// ── R9-klassifisering ─────────────────────────────────────────────────────

/**
 * Klassifiser droppede kandidater via ett batch-oppslag mot pois-tabellen.
 * Fail-soft: kan oppslaget ikke gjennomføres → alle `utenfor-board` + warning.
 */
async function classifyDroppedCandidates(
  ids: string[],
  warnings: string[]
): Promise<Map<string, HighlightDropReason>> {
  const reasons = new Map<string, HighlightDropReason>();
  const fallbackAll = (why: string) => {
    warnings.push(
      `⚠️  Klassifisering av droppede highlights feilet (${why}) — alle merket utenfor-board`
    );
    for (const id of ids) reasons.set(id, "utenfor-board");
    return reasons;
  };

  const supabase = createServerClient();
  if (!supabase) return fallbackAll("Supabase ikke konfigurert");

  const { data, error } = await supabase
    .from("pois")
    .select("id, trust_score")
    .in("id", ids);

  if (error || !data) return fallbackAll(error?.message ?? "ingen data");

  const rowById = new Map(data.map((r) => [r.id, r]));
  for (const id of ids) {
    const row = rowById.get(id);
    if (!row) {
      reasons.set(id, "ikke-i-db");
    } else if (row.trust_score != null && row.trust_score < MIN_TRUST_SCORE) {
      reasons.set(id, "under-trust");
    } else {
      // Finnes med ok/null trust men overlevde ikke board-filtrene
      // (radius/kategori-cap/child-merge/skolekrets) — eller ukjent årsak.
      reasons.set(id, "utenfor-board");
    }
  }
  return reasons;
}

// ── Hovedsteg ─────────────────────────────────────────────────────────────

export async function inheritAreaEditorial(options: {
  projectId: string;
  customerSlug: string;
  projectSlug: string;
  lat: number;
  lng: number;
}): Promise<InheritAreaEditorialResult> {
  const { projectId, customerSlug, projectSlug, lat, lng } = options;

  const result: InheritAreaEditorialResult = {
    themesInherited: [],
    highlights: { kept: 0, dropped: [] },
    warnings: [],
  };

  // 1. Område-oppslag (R2): ingen treff → nivå 1, config urørt
  const { area, warnings: areaWarnings } = await findAreaForPoint({ lat, lng });
  result.warnings.push(...areaWarnings);
  if (!area) {
    return { ...result, skipped: true };
  }
  result.areaName = area.name_no;

  // 2. Board-settet via render-kodestien. Dynamisk import — se modulheader:
  //    queries.ts leser modul-nivå anon-klient, report-data drar "use client"-
  //    kjeden; ingen av dem skal inn i denne modulens statiske graf.
  const { getProductFromSupabase } = await import("@/lib/supabase/queries");
  const { transformToReportData } = await import(
    "@/components/variants/report/report-data"
  );

  const project = await getProductFromSupabase(customerSlug, projectSlug, "report");
  if (!project) {
    result.warnings.push(
      `⚠️  Prosjekt ${customerSlug}/${projectSlug} (report) ikke funnet — editorial-arv hoppet over`
    );
    return { ...result, skipped: true };
  }

  const board = transformToReportData(project);
  const boardPoiIdsByTheme = new Map<string, Set<string>>(
    board.themes.map((t) => [t.id, new Set(t.allPOIs.map((p) => p.id))])
  );

  // 3. Hent products-raden (read-delen av read-modify-write). REST med
  //    service-key — samme mønster som apply-curation-staging.ts.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY mangler — editorial-arv kan ikke skrive config"
    );
  }
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };

  const getUrl = new URL(`${supabaseUrl}/rest/v1/products`);
  getUrl.searchParams.set("project_id", `eq.${projectId}`);
  getUrl.searchParams.set("product_type", "eq.report");
  getUrl.searchParams.set("select", "id,config,updated_at");

  // Timeout/nettverksfeil på GET er fail-soft (som !ok): warning + skip,
  // ingenting skrevet — kun skrivefeil skal kaste høylytt (se modulheader).
  let getRes: Response;
  try {
    getRes = await fetchWithTimeout(getUrl.toString(), { headers });
  } catch (e) {
    result.warnings.push(
      `⚠️  Henting av products-rad feilet (${e instanceof Error ? e.message : "ukjent"}) — editorial-arv hoppet over (ingenting skrevet)`
    );
    return { ...result, skipped: true };
  }
  if (!getRes.ok) {
    result.warnings.push(
      `⚠️  Henting av products-rad feilet (${getRes.status}) — editorial-arv hoppet over (ingenting skrevet)`
    );
    return { ...result, skipped: true };
  }
  const rows = (await getRes.json()) as ProductRow[];
  if (!Array.isArray(rows) || rows.length === 0) {
    result.warnings.push(
      `⚠️  Ingen products-rad (report) for project_id=${projectId} — editorial-arv hoppet over`
    );
    return { ...result, skipped: true };
  }
  const product = rows[0];

  // jsonb-vs-streng-gotcha: config kan være lagret som jsonb ELLER
  // JSON-streng (dokumentert i jsonb-merge-læringen). Detektér formen her og
  // bevar den ved skriving. Korrupt streng → høylytt feil (kan ikke merge
  // trygt, og stille skip ville skjule data-korrupsjon).
  const configWasString = typeof product.config === "string";
  let existingConfig: Record<string, unknown>;
  if (configWasString) {
    try {
      existingConfig = JSON.parse(product.config as string) as Record<string, unknown>;
    } catch {
      throw new Error(
        `products.config for ${product.id} er korrupt JSON-streng — editorial-arv avbrutt (ingenting skrevet)`
      );
    }
  } else {
    existingConfig = (product.config ?? {}) as Record<string, unknown>;
  }

  const rc = (existingConfig.reportConfig ?? {}) as Record<string, unknown>;
  const configThemes = Array.isArray(rc.themes) ? (rc.themes as ConfigTheme[]) : [];
  if (configThemes.length === 0) {
    result.warnings.push(
      "⚠️  config.reportConfig.themes mangler/er tom — editorial-arv hoppet over"
    );
    return { ...result, skipped: true };
  }
  const themeIdsInConfig = new Set(configThemes.map((t) => t.id));

  // 4. Beregn patches for ALLE temaer FØRST (alt-eller-ingenting).
  const patches = new Map<string, ReportThemeEditorial>();
  const pendingDrops: Array<{ themeId: string; id: string }> = [];

  for (const [themeId, rawEntry] of Object.entries(area.report_editorial)) {
    const parsed = ThemeEditorialStagingSchema.safeParse(rawEntry);
    if (!parsed.success) {
      result.warnings.push(
        `⚠️  Område ${area.id}, tema "${themeId}": ugyldig editorial-form (${parsed.error.issues
          .map((i) => i.message)
          .join("; ")}) — hoppet over`
      );
      continue;
    }
    if (!themeIdsInConfig.has(themeId)) {
      result.warnings.push(
        `⚠️  Tema "${themeId}" i område-editorial finnes ikke i prosjektets config-temaer — hoppet over`
      );
      continue;
    }
    const entry = parsed.data;

    // Kurator-rekkefølge: behold de første inntil MAX_HIGHLIGHTS som
    // overlever det FILTRERTE board-settet (temaets allPOIs). Tema som ikke
    // nådde boardet (f.eks. for få POIer) gir tomt sett → alt droppes.
    const boardIds = boardPoiIdsByTheme.get(themeId);
    const survivors: string[] = [];
    for (const candidate of entry.highlightCandidates) {
      if (survivors.length >= MAX_HIGHLIGHTS) {
        // Forbi capen (R9-valg, dokumentert): off-board-kandidater logges
        // FORTSATT som droppet — de er utilgjengelige uansett cap, og skal
        // synliggjøre systematiske tilgjengelighetsproblemer i Unit 7.
        // On-board-kandidater forbi capen logges IKKE — de er ikke droppet,
        // bare forbi visningstaket (ingen egen «forbi-cap»-årsak).
        if (!boardIds?.has(candidate)) {
          pendingDrops.push({ themeId, id: candidate });
        }
        continue;
      }
      if (survivors.includes(candidate)) continue; // duplikat i kandidatlisten
      if (boardIds?.has(candidate)) {
        survivors.push(candidate);
      } else {
        pendingDrops.push({ themeId, id: candidate });
      }
    }

    // Gating-kontrakten (drill-in-læringen): body ELLER ≥1 highlight bærer
    // nivå 2. Tomme survivors + body → skriv med tom liste. Verken body
    // eller survivors → ikke ekte nivå 2-innhold, skip med warning.
    if (!entry.body.trim() && survivors.length === 0) {
      result.warnings.push(
        `⚠️  Tema "${themeId}": verken body eller overlevende highlights — editorial ikke skrevet (forblir nivå 1)`
      );
      continue;
    }

    const editorial: ReportThemeEditorial = {
      body: entry.body,
      // Render-feltnavnet fra ReportThemeEditorial — IKKE highlightCandidates
      highlightPoiIds: survivors,
    };
    if (entry.image) editorial.image = entry.image;
    patches.set(themeId, editorial);
    result.highlights.kept += survivors.length;
  }

  // 5. R9: klassifiser droppede kandidater (ett batch-oppslag, fail-soft)
  if (pendingDrops.length > 0) {
    const uniqueIds = Array.from(new Set(pendingDrops.map((d) => d.id)));
    const reasons = await classifyDroppedCandidates(uniqueIds, result.warnings);
    for (const drop of pendingDrops) {
      result.highlights.dropped.push({
        ...drop,
        reason: reasons.get(drop.id) ?? "utenfor-board",
      });
    }
  }

  if (patches.size === 0) {
    result.warnings.push(
      `⚠️  Ingen temaer å arve fra område "${area.name_no}" — config urørt`
    );
    return result;
  }

  // 6. ÉN atomisk skriving: spread-merge KUN `editorial`-nøkkelen inn i de
  //    aktuelle tema-objektene — alt annet på temaet (grounding, leadText,
  //    audio, …) og alt annet i config overlever urørt. Optimistisk lås på
  //    updated_at; 0 rader → høylytt feil (aldri stille retry).
  const nextThemes = configThemes.map((theme) => {
    const editorial = patches.get(theme.id);
    return editorial ? { ...theme, editorial } : theme;
  });
  const nextConfig = {
    ...existingConfig,
    reportConfig: { ...rc, themes: nextThemes },
  };

  const patchUrl = new URL(`${supabaseUrl}/rest/v1/products`);
  patchUrl.searchParams.set("id", `eq.${product.id}`);
  patchUrl.searchParams.set("updated_at", `eq.${product.updated_at}`);

  // Timeout/nettverksfeil på PATCH feiler HØYLYTT — som annen PATCH-feil
  // (aldri stille/delvis skriving).
  let patchRes: Response;
  try {
    patchRes = await fetchWithTimeout(patchUrl.toString(), {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        // Bevar lagringsformen: var config en JSON-streng, skriv streng tilbake
        config: configWasString ? JSON.stringify(nextConfig) : nextConfig,
      }),
    });
  } catch (e) {
    throw new Error(
      `PATCH av products.config feilet (${e instanceof Error ? e.message : "ukjent"}) — INGEN temaer skrevet`
    );
  }

  if (!patchRes.ok) {
    throw new Error(
      `PATCH av products.config feilet (${patchRes.status}): ${await patchRes
        .text()
        .catch(() => "ukjent")} — INGEN temaer skrevet`
    );
  }
  const patched = (await patchRes.json()) as unknown[];
  if (!Array.isArray(patched) || patched.length === 0) {
    throw new Error(
      `Optimistisk lås: PATCH traff 0 rader (products.updated_at endret seg under kjøringen) — INGEN temaer skrevet. Re-kjør steget.`
    );
  }

  result.themesInherited = Array.from(patches.keys());
  return result;
}
