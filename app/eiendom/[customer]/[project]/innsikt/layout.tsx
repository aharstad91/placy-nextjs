// Rammen rundt innsiktssidene — panel, prosjekt-velger og fane-rad.
//
// Den ligger her, og ikke i sidene, for at den skal OVERLEVE navigasjon:
// oversikten og temasidene er ulike ruter, så en ramme inne i dem rives ned og
// bygges opp igjen ved hvert klikk. Som layout står den stille mens bare
// innholdet byttes.
//
// Prisen er at en layout ikke får `searchParams`, og tilgangen til rapporten
// ligger nettopp der (`?t=`). Spørrestrengen kommer derfor inn som header fra
// `proxy.ts`. Rapporten lastes én gang per request og deles med siden under
// via `loadInsightOnce`.

import { notFound } from "next/navigation";
import { insightSearchParamsFromHeaders, loadInsightOnce } from "@/lib/insight/load-report";
import { InsightShell } from "@/components/insight/InsightShell";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ customer: string; project: string }>;
}

export default async function InsightLayout({ children, params }: LayoutProps) {
  const { customer, project: projectSlug } = await params;
  const sp = await insightSearchParamsFromHeaders();
  const loaded = await loadInsightOnce(customer, projectSlug, sp);
  if (!loaded) notFound();

  const { projectName, report, demo, query, customer: customerRow, switcher } = loaded;

  return (
    <InsightShell
      projectName={projectName}
      customer={customerRow}
      switcher={switcher}
      demo={demo}
      since={report.window.since}
      until={report.window.until}
      days={report.window.days}
      basePath={`/eiendom/${customer}/${projectSlug}/innsikt`}
      query={query}
      themes={report.categories.filter((c) => c.icon || c.color || c.opens > 0)}
      reached={report.threshold.reached}
    >
      {children}
    </InsightShell>
  );
}
