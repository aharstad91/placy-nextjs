import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { getProductAsync, getProjectAsync } from "@/lib/data-server";
import { getProjectTranslations } from "@/lib/supabase/translations";
import { getAreaSlugForProject } from "@/lib/public-queries";
import ReportPageParaform from "@/components/variants/report/paraform/ReportPageParaform";

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

  let projectData = await getCachedReportProduct(customer, projectSlug);

  if (!projectData) {
    const legacyProject = await getProjectAsync(customer, projectSlug);
    if (legacyProject?.productType === "report") {
      projectData = legacyProject;
    }
  }

  if (!projectData) {
    notFound();
  }

  const poiIds = projectData.pois.map((p) => p.id);
  const themeIds = (projectData.reportConfig?.themes || []).map((t) => t.id);
  const enTranslations = await getProjectTranslations("en", poiIds, themeIds, projectData.id);

  const areaSlug = await getAreaSlugForProject(projectData.id);

  const rawThemes = typeof resolvedSearchParams.themes === "string"
    ? resolvedSearchParams.themes.split(",")
    : undefined;

  return (
    <div className="paraform min-h-screen flex flex-col" style={{ backgroundColor: "#fafaf7", color: "#1a1a1a" }}>
      <main className="flex-1">
        <ReportPageParaform
          project={projectData}
          enTranslations={enTranslations}
          areaSlug={areaSlug}
          primaryThemeIds={rawThemes}
        />
      </main>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  let projectData = await getCachedReportProduct(customer, projectSlug);
  if (!projectData) {
    projectData = await getProjectAsync(customer, projectSlug);
  }

  if (!projectData) {
    return { title: "Rapport ikke funnet" };
  }

  return {
    title: `${projectData.story.title} – Nabolagsrapport (Paraform-prototype) | Placy`,
    description: projectData.story.introText,
    alternates: {
      canonical: `/eiendom/${customer}/${projectSlug}/rapport-paraform`,
    },
  };
}
