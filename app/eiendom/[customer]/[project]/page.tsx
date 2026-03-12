import { notFound } from "next/navigation";
import Image from "next/image";
import { getProductAsync, getProjectAsync } from "@/lib/data-server";
import { getCollectionBySlug } from "@/lib/supabase/queries";
import { getAreaSlugForProject } from "@/lib/public-queries";
import { createServerClient } from "@/lib/supabase/client";
import ExplorerPage from "@/components/variants/explorer/ExplorerPage";
import { applyExplorerCaps } from "@/lib/themes/apply-explorer-caps";
import { getVenueProfile, getBransjeprofil, resolveThemeId } from "@/lib/themes";
import { eiendomUrl, eiendomGenererUrl } from "@/lib/urls";
import { Clock, AlertTriangle, MapPin, RefreshCw } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function EiendomExplorerPage({ params, searchParams }: PageProps) {
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
    // Check if there's a generation request pending for this slug
    const supabase = createServerClient();
    if (supabase) {
      const { data: genRequest } = await supabase
        .from("generation_requests")
        .select("status, address, geocoded_lat, geocoded_lng, error_message")
        .eq("address_slug", projectSlug)
        .single();

      if (genRequest) {
        if (genRequest.status === "pending" || genRequest.status === "processing") {
          const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
          const staticMapUrl = genRequest.geocoded_lat && genRequest.geocoded_lng && mapboxToken
            ? `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/pin-s+333(${genRequest.geocoded_lng},${genRequest.geocoded_lat})/${genRequest.geocoded_lng},${genRequest.geocoded_lat},13,0/600x300@2x?access_token=${mapboxToken}`
            : null;

          return (
            <div className="min-h-screen bg-white flex items-center justify-center px-4">
              <div className="max-w-md w-full text-center">
                {staticMapUrl && (
                  <div className="rounded-xl overflow-hidden mb-6 border border-gray-100">
                    <Image
                      src={staticMapUrl}
                      alt={`Kart over ${genRequest.address}`}
                      width={600}
                      height={300}
                      className="w-full h-auto"
                      unoptimized
                    />
                  </div>
                )}
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h1 className="text-xl font-bold text-gray-900 mb-2">Kartet genereres...</h1>
                <p className="text-gray-600 mb-2">{genRequest.address}</p>
                <p className="text-sm text-gray-500 mb-6">Prosessen tar vanligvis 5-10 minutter.</p>
                <a
                  href={eiendomUrl(customer, projectSlug)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Sjekk igjen
                </a>
              </div>
            </div>
          );
        }

        if (genRequest.status === "failed") {
          return (
            <div className="min-h-screen bg-white flex items-center justify-center px-4">
              <div className="max-w-md w-full text-center">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h1 className="text-xl font-bold text-gray-900 mb-2">Noe gikk galt</h1>
                <p className="text-gray-600 mb-6">
                  Genereringen av nabolagskartet feilet. Prøv igjen med en annen adresse.
                </p>
                <a
                  href={eiendomGenererUrl()}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  Prøv igjen
                </a>
              </div>
            </div>
          );
        }
      }
    }

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
      features={profil.features}
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
      canonical: eiendomUrl(customer, projectSlug),
    },
  };
}
