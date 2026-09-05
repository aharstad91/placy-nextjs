// Innsiktsrapporten (Moat 2) for ett prosjekt-board.
//
// Tilgang: noindex + lenke-token (`?t=`). Ingen innlogging — samme modell som
// en delt dokument-lenke, laget for å videresendes internt hos kunden.
// `?demo=1` bytter ut ekte rader med deterministisk demodata (aldri skrevet
// til basen). `?dager=30` styrer vinduet (7–180).
//
// Dynamisk rendering: siden leser searchParams og tallene skal være ferske
// «per døgn» — aggregeringen er billig på dagens volum.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCachedReportProduct } from "@/lib/supabase/cached-board-reads";
import { verifyInsightToken } from "@/lib/insight/token";
import { buildInsightLabels } from "@/lib/insight/labels";
import { aggregateInsight } from "@/lib/insight/aggregate";
import { generateDemoEvents } from "@/lib/insight/demo-data";
import { fetchBaselineCategoryEvents, fetchProjectEvents } from "@/lib/insight/fetch-events";
import { InsightReportView } from "@/components/insight/InsightReportView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Innsikt — Placy",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ customer: string; project: string }>;
  searchParams: Promise<{ t?: string; demo?: string; dager?: string }>;
}

const DEFAULT_DAYS = 30;

export default async function InsightPage({ params, searchParams }: PageProps) {
  const { customer, project: projectSlug } = await params;
  const { t, demo: demoParam, dager } = await searchParams;
  const projectId = `${customer}_${projectSlug}`;

  // Feil token og manglende secret gir samme svar som en ukjent side.
  if (!verifyInsightToken(projectId, t, process.env.INSIGHT_REPORT_SECRET)) notFound();

  const project = await getCachedReportProduct(customer, projectSlug);
  if (!project) notFound();

  const days = Math.min(180, Math.max(7, Number.parseInt(dager ?? "", 10) || DEFAULT_DAYS));
  const until = new Date();
  const since = new Date(until.getTime() - (days - 1) * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);

  // Radene hentes for to perioder (gjeldende + forrige av samme lengde) så
  // endrings-pilene har et grunnlag. Aggregeringen splitter på `since`.
  const prevSince = new Date(since.getTime() - days * 86_400_000);

  const labels = buildInsightLabels(project);
  const demo = demoParam === "1";
  const { rows, baselineRows } = demo
    ? generateDemoEvents({ labels, since: prevSince, until, baselineSince: since })
    : {
        rows: await fetchProjectEvents(projectId, prevSince, until),
        baselineRows: await fetchBaselineCategoryEvents(projectId, since, until),
      };

  const report = aggregateInsight({ rows, baselineRows, labels, since, until });

  return (
    <div className="min-h-screen bg-[#f5f5f4]">
      <InsightReportView
        report={report}
        projectName={project.name}
        customerName={project.customer}
        demo={demo}
      />
    </div>
  );
}
