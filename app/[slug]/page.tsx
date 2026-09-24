import type { Metadata } from "next";
import { Suspense, cache } from "react";
import { notFound } from "next/navigation";

import BoardEmbedGate from "@/app/eiendom/[customer]/[project]/rapport-board/board-embed-gate";
import { buildReportBoardStyle } from "@/lib/board/report-board-style";
import { PublicProjectError, resolvePublicProjectRoute } from "@/lib/public-projects";
import { getCachedProjectTranslations, getCachedReportProduct } from "@/lib/supabase/cached-board-reads";
import { getSchoolZone } from "@/lib/utils/school-zones";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

// Resolve the public alias once per request. The board itself still comes from
// the ordinary report product, never from a demo snapshot.
const getPublicBoard = cache(async (slug: string) => {
  try {
    const route = await resolvePublicProjectRoute(slug);
    const project = await getCachedReportProduct(route.customer, route.projectSlug);
    // The voice registry stores the project ID (`customer_slug`), while the
    // loaded report product has its own UUID. Compare the project identity.
    if (!project || project.customer !== route.customer || project.urlSlug !== route.projectSlug || project.productType !== "report") notFound();
    return { route, project };
  } catch (error) {
    if (error instanceof PublicProjectError && error.kind === "not_found") notFound();
    throw error;
  }
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { project } = await getPublicBoard(slug);
  return {
    title: `${project.name} — Placy`,
    description: `Utforsk ${project.name} med kart og samtaleguiden Anja.`,
    robots: { index: false, follow: false },
    alternates: { canonical: `https://placy.no/${slug}` },
    ...(project.reportConfig?.assets?.logoUrl
      ? { icons: { icon: project.reportConfig.assets.logoUrl } }
      : {}),
  };
}

export default async function ProjectPage({ params }: PageProps) {
  const { slug } = await params;
  const { route, project } = await getPublicBoard(slug);
  const schoolZone = getSchoolZone(project.centerCoordinates.lat, project.centerCoordinates.lng);
  const projectWithZone = { ...project, schoolZone };
  const poiIds = project.pois.map((poi) => poi.id);
  const themeIds = (project.reportConfig?.themes ?? []).map((theme) => theme.id);
  const enTranslations = await getCachedProjectTranslations(
    route.customer,
    route.projectSlug,
    "en",
    poiIds,
    themeIds,
    project.id,
  );

  return (
    <div style={buildReportBoardStyle(project)} className="min-h-screen bg-background text-foreground">
      <Suspense fallback={null}>
        <BoardEmbedGate project={projectWithZone} enTranslations={enTranslations} />
      </Suspense>
    </div>
  );
}
