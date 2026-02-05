import { notFound } from "next/navigation";
import { getProductAsync, getProjectAsync, productExists } from "@/lib/data-server";
import ReportPage from "@/components/variants/report/ReportPage";

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

  // Check if explorer exists (for CTA link)
  const hasExplorer = await productExists(customer, projectSlug, "explorer");
  const explorerUrl = hasExplorer ? `/${customer}/${projectSlug}/explore` : null;

  return <ReportPage project={projectData} explorerBaseUrl={explorerUrl} />;
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
