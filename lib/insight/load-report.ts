// Felles laster for innsiktssidene (oversikt + ett tema). Token-sjekk,
// prosjekt-oppslag, rader for to perioder, aggregering og anbefalinger.
// Sidene gjør bare notFound() når dette returnerer null.

import { cache } from "react";
import { headers } from "next/headers";
import { unstable_cache } from "next/cache";
import { verifyInsightToken } from "./token";
import { getCachedInsightLabels } from "./labels";
import { aggregateInsight } from "./aggregate";
import { deriveRecommendations, type Recommendation } from "./recommendations";
import { generateDemoEvents } from "./demo-data";
import { fetchBaselineCategoryEvents, fetchProjectEvents } from "./fetch-events";
import { buildSwitcherOptions, getInsightCustomer, type InsightCustomer, type InsightSwitcherOption } from "./projects";
import type { InsightLabels, InsightReport } from "./types";

export interface InsightSearchParams {
  t?: string;
  demo?: string;
  dager?: string;
}

export interface LoadedInsight {
  /** Boardets visningsnavn, fra prosjektraden — ikke fra det store produktet. */
  projectName: string;
  labels: InsightLabels;
  report: InsightReport;
  recommendations: Recommendation[];
  demo: boolean;
  /** Spørrestrengen som må følge alle interne lenker (token, demo, vindu). */
  query: string;
  /** Kunden prosjektet hører til — navn og søsken-boards til velgeren. */
  customer: InsightCustomer | null;
  switcher: InsightSwitcherOption[];
}

const DEFAULT_DAYS = 30;
/**
 * Rapporten holdes i fem minutter. Sidene er ett grensesnitt, ikke ett
 * dokument: megleren klikker mellom oversikten og seks temaer, og hvert klikk
 * hentet FØR dette hele hendelses-settet for to perioder pluss grunnlinja fra
 * de andre boardene på nytt — 0,8–1,3 s per bytte, altså en synlig lasting
 * mellom kategorier som viser tall fra nøyaktig samme rapport.
 *
 * Nøkkelen kvantiseres til hel time, ellers ville den vært ny ved hvert
 * millisekund og cachen aldri truffet. Prisen er at tallene kan være opptil
 * en time gamle — rapporten lover uansett døgnoppdatering, og ingen
 * beslutning her tas på en times ferskhet.
 */
const REPORT_CACHE_SECONDS = 300;

/** Bygger `?t=…&demo=1&dager=…` så lenkene mellom sidene beholder tilgangen. */
export function insightQuery(sp: InsightSearchParams): string {
  const q = new URLSearchParams();
  if (sp.t) q.set("t", sp.t);
  if (sp.demo === "1") q.set("demo", "1");
  if (sp.dager) q.set("dager", sp.dager);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * Spørrestrengen slik proxy-en ga den videre. Layouten rundt innsiktssidene
 * trenger token og vindu på samme måte som sidene, men en layout får ikke
 * searchParams — se `proxy.ts`. Sidene bruker sine egne searchParams; dette er
 * bare til layouten.
 */
export async function insightSearchParamsFromHeaders(): Promise<InsightSearchParams> {
  const raw = (await headers()).get("x-insight-search") ?? "";
  const q = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  return {
    t: q.get("t") ?? undefined,
    demo: q.get("demo") ?? undefined,
    dager: q.get("dager") ?? undefined,
  };
}

/**
 * Layouten og siden laster den samme rapporten i samme request. `cache` gjør
 * det andre kallet gratis; uten den ville hver visning gjort jobben to ganger.
 */
const loadInsightCached = cache(
  (customer: string, projectSlug: string, t?: string, demo?: string, dager?: string) =>
    loadInsight(customer, projectSlug, { t, demo, dager }),
);

/* Nøkkelen må være primitiver: `cache` sammenligner argumenter på identitet, og
   et nytt searchParams-objekt per kall ville aldri truffet. */
export function loadInsightOnce(customer: string, projectSlug: string, sp: InsightSearchParams) {
  return loadInsightCached(customer, projectSlug, sp.t, sp.demo, sp.dager);
}

export async function loadInsight(
  customer: string,
  projectSlug: string,
  sp: InsightSearchParams,
): Promise<LoadedInsight | null> {
  const projectId = `${customer}_${projectSlug}`;
  // Feil token og manglende secret gir samme svar som en ukjent side.
  if (!verifyInsightToken(projectId, sp.t, process.env.INSIGHT_REPORT_SECRET)) return null;

  // Oppslagene ER eksistenssjekken: uten board finnes det ingen rapport.
  const labels = await getCachedInsightLabels(customer, projectSlug);
  if (!labels) return null;

  const days = Math.min(180, Math.max(7, Number.parseInt(sp.dager ?? "", 10) || DEFAULT_DAYS));
  const until = new Date();
  /* Cache-nøkkelens tidsdel. Vinduet selv beholder «nå» — det er NØKKELEN som
     må stå stille en stund, ikke tallene. Se REPORT_CACHE_SECONDS. */
  const hourBucket = until.toISOString().slice(0, 13);
  const since = new Date(until.getTime() - (days - 1) * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);
  // Radene hentes for to perioder (gjeldende + forrige av samme lengde) så
  // endringene har et grunnlag. Aggregeringen splitter på `since`.
  const prevSince = new Date(since.getTime() - days * 86_400_000);

  const demo = sp.demo === "1";

  // Demodata er deterministisk og regnes i minnet på ~0,2 s; det er ekte rader
  // som koster. Bare de cachees, så demo alltid speiler koden slik den står nå.
  const report = demo
    ? aggregateInsight({
        ...generateDemoEvents({ labels, since: prevSince, until, baselineSince: since }),
        labels,
        since,
        until,
      })
    : await unstable_cache(
        async () =>
          aggregateInsight({
            rows: await fetchProjectEvents(projectId, prevSince, until),
            baselineRows: await fetchBaselineCategoryEvents(projectId, since, until),
            labels,
            since,
            until,
          }),
        ["insight-report", projectId, String(days), hourBucket],
        { tags: [`insight:${projectId}`], revalidate: REPORT_CACHE_SECONDS },
      )();

  const customerRow = await getInsightCustomer(customer);
  const projectName = customerRow?.projects.find((p) => p.id === projectId)?.name ?? projectSlug;

  return {
    projectName,
    labels,
    report,
    recommendations: deriveRecommendations(report),
    demo,
    query: insightQuery(sp),
    customer: customerRow,
    switcher: buildSwitcherOptions(customerRow, projectId, { demo, dager: sp.dager }),
  };
}
