import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { getProductAsync } from "@/lib/data-server";
import { getProjectTranslations } from "@/lib/supabase/translations";
import { buildBoardMetadata } from "@/lib/seo/board-metadata";
import ReportPageParaform from "@/components/variants/report/paraform/ReportPageParaform";
import { getSchoolZone } from "@/lib/utils/school-zones";

const getCachedReportProduct = (customer: string, projectSlug: string) =>
  unstable_cache(
    () => getProductAsync(customer, projectSlug, "report"),
    ["report-product", customer, projectSlug],
    {
      tags: [`product:${customer}_${projectSlug}`],
      revalidate: 3600,
    },
  )();

export const revalidate = 3600;

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function EiendomReportParaformPage({ params, searchParams }: PageProps) {
  const { customer, project: projectSlug } = await params;
  const resolvedSearchParams = await searchParams;

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
  const enTranslations = await getProjectTranslations("en", poiIds, themeIds, projectData.id);

  const rawThemes = typeof resolvedSearchParams.themes === "string"
    ? resolvedSearchParams.themes.split(",")
    : undefined;

  return (
    <div className="paraform min-h-screen flex flex-col" style={{ backgroundColor: "#fafaf7", color: "#1a1a1a" }}>
      <main className="flex-1">
        <ReportPageParaform
          project={projectDataWithZone}
          enTranslations={enTranslations}
          primaryThemeIds={rawThemes}
        />
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
