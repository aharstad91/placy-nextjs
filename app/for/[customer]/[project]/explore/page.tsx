import { notFound } from "next/navigation";
import { getProductAsync, getProjectAsync } from "@/lib/data-server";
import { getCollectionBySlug } from "@/lib/supabase/queries";
import { getAreaSlugForProject } from "@/lib/public-queries";
import ExplorerPage from "@/components/variants/explorer/ExplorerPage";
import { applyExplorerCaps } from "@/lib/themes/apply-explorer-caps";
import { getVenueProfile, getBransjeprofil, resolveThemeId } from "@/lib/themes";

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

  // Get bransjeprofil themes based on project tags
  const profil = getBransjeprofil(projectData.tags);

  // Auto-generate themes from project categories when bransjeprofil themes don't match any POIs
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

  // Apply Explorer caps (skip for collection views — they show a curated subset)
  // When using auto-generated themes, build uncapped per-theme caps so all POIs pass through
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

  // Parse ?themes= param from welcome screen → translate to category IDs
  // Apply theme ID aliases for backward compatibility with old URLs
  const selectedThemes = typeof resolvedSearchParams.themes === "string"
    ? resolvedSearchParams.themes.split(",").map(resolveThemeId)
    : undefined;
  const themeDerivedCategories = selectedThemes
    ? effectiveThemes
        .filter((t) => selectedThemes.includes(t.id))
        .flatMap((t) => t.categories)
    : undefined;

  // Collection mode
  if (typeof resolvedSearchParams.c === "string") {
    const collection = await getCollectionBySlug(resolvedSearchParams.c);
    if (collection) {
      return (
        <ExplorerPage
          project={projectData}
          themes={effectiveThemes}
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

  // ?themes= has precedence over ?categories=
  const initialCategories = themeDerivedCategories
    ?? (typeof resolvedSearchParams.categories === "string"
      ? resolvedSearchParams.categories.split(",")
      : undefined);

  return (
    <ExplorerPage
      project={projectData}
      themes={effectiveThemes}
      areaSlug={areaSlug}
      initialPOI={
        typeof resolvedSearchParams.poi === "string"
          ? resolvedSearchParams.poi
          : undefined
      }
      initialCategories={initialCategories}
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
    alternates: {
      canonical: `https://placy.no/for/${customer}/${projectSlug}/explore`,
    },
  };
}
