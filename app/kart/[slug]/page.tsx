import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/client";
import { getProductAsync } from "@/lib/data-server";
import { getBransjeprofil, getVenueProfile } from "@/lib/themes";
import { applyExplorerCaps } from "@/lib/themes/apply-explorer-caps";
import KartExplorer from "@/components/variants/kart/KartExplorer";
import { MapPin, Clock, AlertTriangle, RefreshCw } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function fetchGenerationRequest(slug: string) {
  const supabase = createServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("generation_requests")
    .select("*")
    .eq("address_slug", slug)
    .single();

  return data;
}

export default async function KartPage({ params }: PageProps) {
  const { slug } = await params;
  const request = await fetchGenerationRequest(slug);

  if (!request) {
    notFound();
  }

  // Pending / processing — show waiting page
  if (request.status === "pending" || request.status === "processing") {
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const staticMapUrl = request.geocoded_lat && request.geocoded_lng && mapboxToken
      ? `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/pin-s+333(${request.geocoded_lng},${request.geocoded_lat})/${request.geocoded_lng},${request.geocoded_lat},13,0/600x300@2x?access_token=${mapboxToken}`
      : null;

    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          {staticMapUrl && (
            <div className="rounded-xl overflow-hidden mb-6 border border-gray-100">
              <img
                src={staticMapUrl}
                alt={`Kart over ${request.address}`}
                className="w-full h-auto"
              />
            </div>
          )}
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Kartet genereres...
          </h1>
          <p className="text-gray-600 mb-2">{request.address}</p>
          <p className="text-sm text-gray-500 mb-6">
            Prosessen tar vanligvis 5-10 minutter.
          </p>
          <a
            href={`/kart/${slug}`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Sjekk igjen
          </a>
        </div>
      </div>
    );
  }

  // Failed — show error page
  if (request.status === "failed") {
    if (request.error_message) {
      console.log("Generation failed:", request.error_message);
    }

    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Noe gikk galt
          </h1>
          <p className="text-gray-600 mb-6">
            Genereringen av nabolagskartet feilet. Prøv igjen med en annen adresse, eller kontakt oss.
          </p>
          <Link
            href="/generer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors"
          >
            Prøv igjen
          </Link>
        </div>
      </div>
    );
  }

  // Completed — load project and render KartExplorer
  if (!request.project_id) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">Prosjektet kunne ikke lastes.</p>
        </div>
      </div>
    );
  }

  const projectData = await getProductAsync("selvbetjent", request.address_slug, "explorer");
  if (!projectData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">Prosjektet kunne ikke lastes.</p>
        </div>
      </div>
    );
  }

  // Resolve themes from bransjeprofil
  const profil = getBransjeprofil(projectData.tags);
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

  const effectiveCaps = hasThemeOverlap
    ? profil.explorerCaps
    : Object.fromEntries(effectiveThemes.map((t) => [t.id, 999]));
  const effectiveTotalCap = hasThemeOverlap ? profil.explorerTotalCap : 999;

  // Apply explorer caps
  const venueProfile = getVenueProfile(projectData.venueType);
  const cappedProject = {
    ...projectData,
    pois: applyExplorerCaps(
      projectData.pois,
      effectiveThemes,
      venueProfile,
      effectiveCaps,
      effectiveTotalCap
    ),
  };

  return <KartExplorer project={cappedProject} themes={effectiveThemes} />;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const request = await fetchGenerationRequest(slug);

  if (!request) {
    return { title: "Kart ikke funnet" };
  }

  return {
    title: request.status === "completed"
      ? `Nabolaget rundt ${request.address}`
      : "Kart genereres...",
    robots: { index: false, follow: false },
  };
}
