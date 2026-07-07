import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  getCachedReportProduct,
  getCachedProjectTranslations,
} from "@/lib/supabase/cached-board-reads";
import { buildBoardMetadata } from "@/lib/seo/board-metadata";
import ParaformThemeGate from "./paraform-theme-gate";
import { getSchoolZone } from "@/lib/utils/school-zones";

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

export default async function EiendomReportParaformPage({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;
  // `?themes=` leses i ParaformThemeGate (klient) — searchParams her ville
  // tvunget ruten til dynamisk rendering og skrudd av ISR-en.

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
  const enTranslations = await getCachedProjectTranslations(
    customer,
    projectSlug,
    "en",
    poiIds,
    themeIds,
    projectData.id,
  );

  return (
    <div className="paraform min-h-screen flex flex-col" style={{ backgroundColor: "#fafaf7", color: "#1a1a1a" }}>
      <main className="flex-1">
        <Suspense fallback={null}>
          <ParaformThemeGate
            project={projectDataWithZone}
            enTranslations={enTranslations}
          />
        </Suspense>
      </main>
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
    titleSuffix: "Nabolagsrapport (Paraform-prototype)",
    shareSuffix: "Nabolagsrapport",
    path: `/eiendom/${customer}/${projectSlug}/rapport-paraform`,
  });
}
