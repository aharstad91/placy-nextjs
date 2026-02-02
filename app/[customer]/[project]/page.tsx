import { notFound } from "next/navigation";
import { getProjectAsync, getBaseSlug, projectExists } from "@/lib/data-server";
import { getCollectionBySlug } from "@/lib/supabase/queries";
import ExplorerPage from "@/components/variants/explorer/ExplorerPage";
import ReportPage from "@/components/variants/report/ReportPage";
import PortraitPage from "@/components/variants/portrait/PortraitPage";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ProjectPage({ params, searchParams }: PageProps) {
  const { customer, project: projectSlug } = await params;
  const resolvedSearchParams = await searchParams;

  const projectData = await getProjectAsync(customer, projectSlug);

  if (!projectData) {
    notFound();
  }

  // === Explorer ===
  if (projectData.productType === "explorer") {
    // Collection mode
    if (typeof resolvedSearchParams.c === "string") {
      const collection = await getCollectionBySlug(resolvedSearchParams.c);
      if (collection) {
        return (
          <ExplorerPage
            project={projectData}
            collection={{
              slug: collection.slug,
              poiIds: collection.poi_ids,
              createdAt: collection.created_at,
              email: collection.email,
            }}
            initialPOI={typeof resolvedSearchParams.poi === "string" ? resolvedSearchParams.poi : undefined}
            initialCategories={typeof resolvedSearchParams.categories === "string" ? resolvedSearchParams.categories.split(",") : undefined}
          />
        );
      }
    }

    return (
      <ExplorerPage
        project={projectData}
        initialPOI={typeof resolvedSearchParams.poi === "string" ? resolvedSearchParams.poi : undefined}
        initialCategories={typeof resolvedSearchParams.categories === "string" ? resolvedSearchParams.categories.split(",") : undefined}
      />
    );
  }

  // === Report ===
  if (projectData.productType === "report") {
    const base = getBaseSlug(projectSlug);
    const explorerSlug = `${base}-explore`;
    const hasExplorer = await projectExists(customer, explorerSlug);

    return (
      <ReportPage
        project={projectData}
        explorerBaseUrl={hasExplorer ? `/${customer}/${explorerSlug}` : null}
      />
    );
  }

  // === Portrait ===
  return <PortraitPage project={projectData} />;
}

export async function generateMetadata({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;
  const projectData = await getProjectAsync(customer, projectSlug);

  if (!projectData) {
    return { title: "Prosjekt ikke funnet" };
  }

  return {
    title: `${projectData.story.title} | Placy`,
    description: projectData.story.introText,
  };
}
