// Ett temas innsiktsside. Samme tilgang og laster som oversikten; `[tema]` er
// boardets kanoniske tema-id (f.eks. `barn-oppvekst`). Ukjent tema → 404.
// Rammen ligger i `../layout.tsx`.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadInsightOnce, type InsightSearchParams } from "@/lib/insight/load-report";
import { InsightThemeView } from "@/components/insight/InsightThemeView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Innsikt — Placy",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ customer: string; project: string; tema: string }>;
  searchParams: Promise<InsightSearchParams>;
}

export default async function InsightThemePage({ params, searchParams }: PageProps) {
  const { customer, project: projectSlug, tema } = await params;
  const loaded = await loadInsightOnce(customer, projectSlug, await searchParams);
  if (!loaded) notFound();

  const { report, recommendations } = loaded;
  const theme = report.categories.find((c) => c.id === tema && (c.icon || c.color || c.opens > 0));
  if (!theme) notFound();

  return (
    <InsightThemeView
      report={report}
      theme={theme}
      pois={report.pois.filter((p) => p.categoryId === theme.id)}
      faq={report.faq.filter((f) => f.categoryId === theme.id)}
      recommendations={recommendations.filter((x) => x.themeId === theme.id)}
    />
  );
}
