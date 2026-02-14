import { notFound } from "next/navigation";
import { getProductAsync, getProjectAsync } from "@/lib/data-server";
import { getCollectionBySlug } from "@/lib/supabase/queries";
import { getAreaSlugForProject } from "@/lib/public-queries";
import ExplorerPage from "@/components/variants/explorer/ExplorerPage";
import { applyExplorerCaps } from "@/lib/themes/apply-explorer-caps";
import { DEFAULT_THEMES, getVenueProfile } from "@/lib/themes";

// Revalidate on every request — import API calls revalidatePath() after import,
// but we also want a baseline of no stale data for Supabase-backed pages.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ExplorePage({ params, searchParams }: PageProps) {
  const { customer, project: projectSlug } = await params;
  const resolvedSearchParams = await searchParams;

  // Try new hierarchy first
  let projectData = await getProductAsync(customer, projectSlug, "explorer");

  // Fallback to legacy: try {slug}-explore
  if (!projectData) {
    projectData = await getProjectAsync(customer, `${projectSlug}-explore`);
  }

  // Final fallback: check if slug itself is an explorer
  if (!projectData) {
    const legacyProject = await getProjectAsync(customer, projectSlug);
    if (legacyProject?.productType === "explorer") {
      projectData = legacyProject;
    }
  }

  if (!projectData) {
    notFound();
  }

  // Look up area slug for public POI page links
  const areaSlug = await getAreaSlugForProject(projectData.id);

  // Apply Explorer caps (skip for collection views — they show a curated subset)
  const isCollectionView = typeof resolvedSearchParams.c === "string";
  if (!isCollectionView) {
    const profile = getVenueProfile(projectData.venueType);
    projectData = {
      ...projectData,
      pois: applyExplorerCaps(projectData.pois, DEFAULT_THEMES, profile),
    };
  }

  // Collection mode
  if (typeof resolvedSearchParams.c === "string") {
    const collection = await getCollectionBySlug(resolvedSearchParams.c);
    if (collection) {
      return (
        <ExplorerPage
          project={projectData}
          areaSlug={areaSlug}
          collection={{
            slug: collection.slug,
            poiIds: collection.poi_ids,
            createdAt: collection.created_at,
            email: collection.email,
          }}
          initialPOI={
            typeof resolvedSearchParams.poi === "string"
              ? resolvedSearchParams.poi
              : undefined
          }
          initialCategories={
            typeof resolvedSearchParams.categories === "string"
              ? resolvedSearchParams.categories.split(",")
              : undefined
          }
        />
      );
    }
  }

  return (
    <ExplorerPage
      project={projectData}
      areaSlug={areaSlug}
      initialPOI={
        typeof resolvedSearchParams.poi === "string"
          ? resolvedSearchParams.poi
          : undefined
      }
      initialCategories={
        typeof resolvedSearchParams.categories === "string"
          ? resolvedSearchParams.categories.split(",")
          : undefined
      }
    />
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  let projectData = await getProductAsync(customer, projectSlug, "explorer");
  if (!projectData) {
    projectData = await getProjectAsync(customer, `${projectSlug}-explore`);
  }

  if (!projectData) {
    return { title: "Explorer ikke funnet" };
  }

  return {
    title: `${projectData.story.title} – Explorer | Placy`,
    description: `Utforsk nærområdet rundt ${projectData.name}`,
  };
}
