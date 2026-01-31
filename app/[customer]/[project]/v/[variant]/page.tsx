import { notFound } from "next/navigation";
import { getProjectAsync } from "@/lib/data-server";
import { getCollectionBySlug } from "@/lib/supabase/queries";
import PortraitPage from "@/components/variants/portrait/PortraitPage";
import ExplorerPage from "@/components/variants/explorer/ExplorerPage";
import ReportPage from "@/components/variants/report/ReportPage";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
    variant: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const VARIANT_COMPONENTS: Record<string, React.ComponentType<{ project: any }>> = {
  portrait: PortraitPage,
  explorer: ExplorerPage,
  report: ReportPage,
};

export default async function VariantPage({ params, searchParams }: PageProps) {
  const { customer, project: projectSlug, variant } = await params;
  const resolvedSearchParams = await searchParams;

  const VariantComponent = VARIANT_COMPONENTS[variant];
  if (!VariantComponent) {
    notFound();
  }

  const projectData = await getProjectAsync(customer, projectSlug);
  if (!projectData) {
    notFound();
  }

  // If ?c=<slug> is present and this is the explorer variant, fetch collection
  if (variant === "explorer" && typeof resolvedSearchParams.c === "string") {
    const collection = await getCollectionBySlug(resolvedSearchParams.c);
    if (collection) {
      return (
        <ExplorerPage
          project={projectData}
          collection={{
            slug: collection.slug,
            poiIds: collection.poi_ids,
          }}
        />
      );
    }
    // Invalid slug — render normal explorer (could add toast later)
  }

  return <VariantComponent project={projectData} />;
}

export async function generateMetadata({ params }: PageProps) {
  const { customer, project: projectSlug, variant } = await params;
  const projectData = await getProjectAsync(customer, projectSlug);

  if (!projectData) {
    return { title: "Prosjekt ikke funnet" };
  }

  return {
    title: `${projectData.story.title} — ${variant} | Placy`,
    description: projectData.story.introText,
  };
}
