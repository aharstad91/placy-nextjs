import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import { createServerClient } from "@/lib/supabase/client";
import { getProductFromSupabaseV2 } from "@/lib/supabase/v2-queries";
import { eiendomUrl, eiendomGenererUrl } from "@/lib/urls";
import { Clock, AlertTriangle, MapPin, RefreshCw } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Container-landing for et eiendomsprosjekt. Explorer-varianten (gammel
 * default her) døde ved cutover-trimmen 2026-07-06 — boardet
 * (`rapport-board`) er produktflaten, så landingen redirecter dit.
 *
 * Unntak: pågående/feilet generering (generer-flyten skriver
 * `v2.generation_requests` med `address_slug` = prosjekt-slug) viser
 * vente-/feil-UI i stedet for å 404-e på et board som ikke finnes ennå.
 */

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
}

export default async function EiendomProjectLanding({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  const project = await getProductFromSupabaseV2(customer, projectSlug, "report");
  if (project) {
    redirect(`${eiendomUrl(customer, projectSlug)}/rapport-board`);
  }

  // Ikke i v2 → sjekk om en generering er underveis/feilet
  const supabase = createServerClient();
  const { data: genRequest } = await supabase
    .schema("v2")
    .from("generation_requests")
    .select("status, address, geocoded_lat, geocoded_lng")
    .eq("address_slug", projectSlug)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (genRequest?.status === "pending" || genRequest?.status === "processing") {
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const staticMapUrl =
      genRequest.geocoded_lat && genRequest.geocoded_lng && mapboxToken
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

  if (genRequest?.status === "failed") {
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

  notFound();
}

export async function generateMetadata({ params }: PageProps) {
  const { project: projectSlug } = await params;
  const title = projectSlug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return {
    title: `${title} | Placy`,
    description: `Utforsk nabolaget rundt ${title}`,
  };
}
