// Innsiktsrapportens oversikt (Moat 2) — hele boardet som samlekategori.
// Temaene har egne sider under `./[tema]`, og rammen rundt begge ligger i
// `layout.tsx`, så sidepanelet ikke bygges på nytt ved navigasjon.
//
// Tilgang: noindex + lenke-token (`?t=`). Ingen innlogging — samme modell som
// en delt dokument-lenke, laget for å videresendes internt hos kunden.
// `?demo=1` bytter ut ekte rader med deterministisk demodata (aldri skrevet
// til basen). `?dager=30` styrer vinduet (7–180).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadInsightOnce, type InsightSearchParams } from "@/lib/insight/load-report";
import { InsightOverview } from "@/components/insight/InsightOverview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Innsikt — Placy",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ customer: string; project: string }>;
  searchParams: Promise<InsightSearchParams>;
}

export default async function InsightPage({ params, searchParams }: PageProps) {
  const { customer, project: projectSlug } = await params;
  const loaded = await loadInsightOnce(customer, projectSlug, await searchParams);
  if (!loaded) notFound();

  const { report, recommendations, query } = loaded;

  return (
    <InsightOverview
      report={report}
      recommendations={recommendations}
      themes={report.categories.filter((c) => c.icon || c.color || c.opens > 0)}
      basePath={`/eiendom/${customer}/${projectSlug}/innsikt`}
      query={query}
    />
  );
}
