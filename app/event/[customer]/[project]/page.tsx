import { notFound } from "next/navigation";
import { getProductAsync, getProjectAsync } from "@/lib/data-server";
import ExplorerPage from "@/components/variants/explorer/ExplorerPage";
import { applyExplorerCaps } from "@/lib/themes/apply-explorer-caps";
import { getVenueProfile, getBransjeprofil, resolveThemeId } from "@/lib/themes";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function EventExplorerPage({ params, searchParams }: PageProps) {
  const { customer, project: projectSlug } = await params;
  const resolvedSearchParams = await searchParams;

  // Try new hierarchy first
  let projectData = await getProductAsync(customer, projectSlug, "explorer");

  // Fallback to legacy
  if (!projectData) {
    const legacyProject = await getProjectAsync(customer, projectSlug);
    if (legacyProject?.productType === "explorer") {
      projectData = legacyProject;
    }
  }

  if (!projectData) {
    notFound();
  }

  // Get bransjeprofil themes based on project tags
  const profil = getBransjeprofil(projectData.tags);

  // Check if bransjeprofil themes match any POI categories
  const profilCatIds = new Set(profil.themes.flatMap((t: { categories: string[] }) => t.categories));
  const hasThemeOverlap = projectData.pois.some((p) => profilCatIds.has(p.category.id));

  const effectiveThemes = hasThemeOverlap
    ? profil.themes
    : projectData.categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        categories: [cat.id],
        color: cat.color,
      }));

  // Apply Explorer caps
  const effectiveCaps = hasThemeOverlap
    ? profil.explorerCaps
    : Object.fromEntries(effectiveThemes.map((t) => [t.id, 999]));
  const effectiveTotalCap = hasThemeOverlap
    ? profil.explorerTotalCap
    : 999;

  const isCollectionView = typeof resolvedSearchParams.c === "string";
  if (!isCollectionView) {
    const venueProfile = getVenueProfile(projectData.venueType);
    projectData = {
      ...projectData,
      pois: applyExplorerCaps(
        projectData.pois,
        effectiveThemes,
        venueProfile,
        effectiveCaps,
        effectiveTotalCap
      ),
    };
  }

  // Parse ?themes= param
  const selectedThemes = typeof resolvedSearchParams.themes === "string"
    ? resolvedSearchParams.themes.split(",").map(resolveThemeId)
    : undefined;
  const themeDerivedCategories = selectedThemes
    ? effectiveThemes
        .filter((t) => selectedThemes.includes(t.id))
        .flatMap((t) => t.categories)
    : undefined;

  const initialCategories = themeDerivedCategories
    ?? (typeof resolvedSearchParams.categories === "string"
      ? resolvedSearchParams.categories.split(",")
      : undefined);

  return (
    <ExplorerPage
      project={projectData}
      themes={effectiveThemes}
      initialPOI={
        typeof resolvedSearchParams.poi === "string"
          ? resolvedSearchParams.poi
          : undefined
      }
      initialCategories={initialCategories}
      features={profil.features}
      locale="en"
      useDirectDistance
    />
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { customer, project: projectSlug } = await params;

  let projectData = await getProductAsync(customer, projectSlug, "explorer");
  if (!projectData) {
    projectData = await getProjectAsync(customer, projectSlug);
  }

  if (!projectData) {
    return { title: "Event not found" };
  }

  return {
    title: `${projectData.story.title} | Placy`,
    description: `Explore ${projectData.name} — interactive festival map`,
  };
}
