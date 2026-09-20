import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  getCachedReportProduct,
  getCachedProjectTranslations,
} from "@/lib/supabase/cached-board-reads";
import { buildBoardMetadata } from "@/lib/seo/board-metadata";
import BoardEmbedGate from "./board-embed-gate";
import { buildReportBoardStyle } from "@/lib/board/report-board-style";
import { getSchoolZone } from "@/lib/utils/school-zones";
import { findHostedVoiceProjectSlug } from "@/lib/public-projects";

export const revalidate = 3600;

// Uten generateStaticParams server-rendres dynamiske segmenter per request —
// med den (tom liste) ISR-es hver board-URL on-demand og caches etter
// førstetreff (dynamicParams er default true).
export function generateStaticParams(): Array<{ customer: string; project: string }> {
  return [];
}

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
}

export default async function EiendomReportBoardPage({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;
  // `?embed`/`?from` leses i BoardEmbedGate (klient) — å lese searchParams her
  // ville tvunget ruten til dynamisk rendering og skrudd av ISR-en.

  const projectData = await getCachedReportProduct(customer, projectSlug);

  if (!projectData) {
    notFound();
  }

  // Pre-compute skolekrets server-side so the 700kB GeoJSON never enters the
  // client bundle. The result is stored in project.schoolZone and read by
  // applyCategoryFilter() in report-data.ts (client-side, no GeoJSON import).
  const schoolZone = getSchoolZone(
    projectData.centerCoordinates.lat,
    projectData.centerCoordinates.lng,
  );
  const projectDataWithZone = { ...projectData, schoolZone };

  const poiIds = projectData.pois.map((p) => p.id);
  const themeIds = (projectData.reportConfig?.themes || []).map((t) => t.id);
  const themeStyle = buildReportBoardStyle(projectData);
  const [enTranslations, voiceProjectSlug] = await Promise.all([
    getCachedProjectTranslations(
      customer,
      projectSlug,
      "en",
      poiIds,
      themeIds,
      projectData.id,
    ),
    projectData.reportConfig?.assistant?.enabled
      ? findHostedVoiceProjectSlug(customer, projectSlug)
      : undefined,
  ]);

  return (
    <div style={themeStyle} className="min-h-screen bg-background text-foreground">
      <Suspense fallback={null}>
        <BoardEmbedGate
          project={projectDataWithZone}
          enTranslations={enTranslations}
          voiceProjectSlug={voiceProjectSlug}
        />
      </Suspense>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  const projectData = await getCachedReportProduct(customer, projectSlug);

  if (!projectData) {
    return { title: "Rapport ikke funnet" };
  }

  return buildBoardMetadata({
    project: projectData,
    titleSuffix: "Nabolagsrapport (Board)",
    shareSuffix: "Nabolagsrapport",
    path: `/eiendom/${customer}/${projectSlug}/rapport-board`,
  });
}
