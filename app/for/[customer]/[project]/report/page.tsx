import { notFound } from "next/navigation";
import { getProductAsync, getProjectAsync, productExists } from "@/lib/data-server";
import { getProjectTranslations } from "@/lib/supabase/translations";
import { getAreaSlugForProject } from "@/lib/public-queries";
import ReportPage from "@/components/variants/report/ReportPage";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
}

export default async function ReportProductPage({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  // Try new hierarchy first
  let projectData = await getProductAsync(customer, projectSlug, "report");

  // Fallback to legacy: try base slug directly
  if (!projectData) {
    const legacyProject = await getProjectAsync(customer, projectSlug);
    if (legacyProject?.productType === "report") {
      projectData = legacyProject;
    }
  }

  if (!projectData) {
    notFound();
  }

  // Load English translations for locale toggle (Norwegian is canonical in project data)
  const poiIds = projectData.pois.map((p) => p.id);
  const themeIds = (projectData.reportConfig?.themes || []).map((t) => t.id);
  const enTranslations = await getProjectTranslations("en", poiIds, themeIds, projectData.id);

  // Check if explorer exists (for CTA link)
  const hasExplorer = await productExists(customer, projectSlug, "explorer");
  const explorerUrl = hasExplorer ? `/${customer}/${projectSlug}/explore` : null;

  // Look up area slug for POI detail page links
  const areaSlug = await getAreaSlugForProject(projectData.id);

  return (
    <ReportPage
      project={projectData}
      explorerBaseUrl={explorerUrl}
      enTranslations={enTranslations}
      areaSlug={areaSlug}
    />
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  let projectData = await getProductAsync(customer, projectSlug, "report");
  if (!projectData) {
    projectData = await getProjectAsync(customer, projectSlug);
  }

  if (!projectData) {
    return { title: "Rapport ikke funnet" };
  }

  return {
    title: `${projectData.story.title} – Nabolagsrapport | Placy`,
    description: projectData.story.introText,
  };
}
