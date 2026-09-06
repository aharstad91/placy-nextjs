// Kundens andre boards — det dropdownen i sidepanelet bytter mellom.
//
// ## Hva lenke-tokenet gir tilgang til
//
// Tokenet er HMAC over ÉN prosjekt-id, og en bytter kan ikke gjette naboens.
// Skal dropdownen virke, må sidene derfor stemple lenkene selv. Det utvider
// hva én lenke rekker, og utvidelsen er bevisst: den stopper ved KUNDEN.
// Har du en gyldig lenke til `broset-utvikling-as_wesselslokka`, ser du
// Brøsets andre rapport-boards og ingen andres. Kunden er kontoen — det er
// megleren eller utbyggeren som eier prosjektene og som rapporten er skrevet
// til — og en portefølje-velger som bare kan vise ett prosjekt er ingen
// velger. Skal dette snevres inn igjen, er svaret ekte innlogging per bruker,
// ikke et smalere token.
//
// Bare prosjekter som FAKTISK har et rapport-produkt listes: et prosjekt uten
// board har ingen hendelser, og et valg som fører til 404 er verre enn et
// valg som ikke finnes.

import { unstable_cache } from "next/cache";
import { createServerClient } from "@/lib/supabase/client";
import { chunkIds } from "@/lib/supabase/chunk-ids";
import { insightToken } from "./token";

export interface InsightProjectRef {
  /** `<kunde>_<slug>` — prosjektets id i v2. */
  id: string;
  customerId: string;
  slug: string;
  name: string;
}

export interface InsightCustomer {
  id: string;
  /** Visningsnavnet fra v2.customers; faller tilbake til slug-en. */
  name: string;
  projects: InsightProjectRef[];
}

const REVALIDATE_SECONDS = 300;

async function readCustomer(customerId: string): Promise<InsightCustomer | null> {
  const db = createServerClient().schema("v2");

  const [{ data: customer }, { data: projects, error }] = await Promise.all([
    db.from("customers").select("id, name").eq("id", customerId).maybeSingle(),
    db.from("projects").select("id, url_slug, name").eq("customer_id", customerId),
  ]);

  if (error) {
    console.error("[insight/projects] prosjektliste feilet:", error.message);
    return null;
  }

  const ids = (projects ?? []).map((p) => p.id);
  // Egen spørring i stedet for en innebygget join: de genererte typene kjenner
  // ikke relasjonen projects→products, og et prosjekt uten rapport-produkt
  // skal ikke stå i menyen. `chunkIds` fordi id-lista vokser med kundens
  // portefølje og PostgREST tar imot filteret i URL-en.
  const withReport = new Set<string>();
  for (const chunk of chunkIds(ids)) {
    const { data, error: prodError } = await db
      .from("products")
      .select("project_id")
      .eq("product_type", "report")
      .in("project_id", chunk);
    if (prodError) {
      console.error("[insight/projects] produkt-oppslag feilet:", prodError.message);
      return null;
    }
    for (const row of data ?? []) withReport.add(row.project_id);
  }

  const refs: InsightProjectRef[] = (projects ?? [])
    .filter((p) => withReport.has(p.id))
    .map((p) => ({ id: p.id, customerId, slug: p.url_slug, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "nb"));

  return { id: customerId, name: customer?.name ?? customerId, projects: refs };
}

/** Kundens rapport-boards. Cachet kort: nye boards skal dukke opp av seg selv. */
export function getInsightCustomer(customerId: string): Promise<InsightCustomer | null> {
  return unstable_cache(() => readCustomer(customerId), ["insight-customer", customerId], {
    tags: [`insight-customer:${customerId}`],
    revalidate: REVALIDATE_SECONDS,
  })();
}

/**
 * Lenke til et annet boards innsiktsside, stemplet med DETS eget token.
 * Vinduet (`dager`) og demo-modus følger med, så et bytte beholder konteksten
 * du sto i. Uten secret returneres null, og velgeren utelater raden.
 */
export function insightHrefFor(
  p: InsightProjectRef,
  opts: { demo: boolean; dager?: string },
): string | null {
  const secret = process.env.INSIGHT_REPORT_SECRET;
  if (!secret) return null;
  const q = new URLSearchParams({ t: insightToken(p.id, secret) });
  if (opts.demo) q.set("demo", "1");
  if (opts.dager) q.set("dager", opts.dager);
  return `/eiendom/${p.customerId}/${p.slug}/innsikt?${q}`;
}

export interface InsightSwitcherOption {
  project: InsightProjectRef;
  href: string;
  current: boolean;
}

/**
 * Radene i velgeren. Prosjekter uten stemplet lenke (manglende secret) faller
 * ut — bortsett fra det du står på, som alltid skal kunne leses i menyen.
 */
export function buildSwitcherOptions(
  customer: InsightCustomer | null,
  currentId: string,
  opts: { demo: boolean; dager?: string },
): InsightSwitcherOption[] {
  if (!customer) return [];
  return customer.projects.flatMap((p) => {
    const current = p.id === currentId;
    const href = insightHrefFor(p, opts);
    if (!href) return current ? [{ project: p, href: "#", current }] : [];
    return [{ project: p, href, current }];
  });
}
