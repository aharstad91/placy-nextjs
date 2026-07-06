import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { getProductAsync } from "@/lib/data-server";
import { getProjectTranslations } from "@/lib/supabase/translations";
import { buildBoardMetadata } from "@/lib/seo/board-metadata";
import ReportReelsPage from "@/components/variants/report/reels/ReportReelsPage";
import { hexToHslChannels, pickContrastForeground } from "@/lib/theme-utils";
import { getSchoolZone } from "@/lib/utils/school-zones";

const getCachedReportProduct = (customer: string, projectSlug: string) =>
  unstable_cache(
    () => getProductAsync(customer, projectSlug, "report"),
    ["report-product", customer, projectSlug],
    {
      tags: [`product:${customer}_${projectSlug}`],
      revalidate: 3600,
    },
  )();

export const revalidate = 3600;

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
  searchParams: Promise<{ embed?: string; from?: string }>;
}

export default async function EiendomReportBoardPage({
  params,
  searchParams,
}: PageProps) {
  const { customer, project: projectSlug } = await params;
  // `?embed=1` (eller bare `?embed`): siden limes inn i en iframe på en ekstern
  // nettside → lett splash-teaser i stedet for full board-opplevelse.
  const { embed: embedParam, from: fromParam } = await searchParams;
  const embed = embedParam === "1" || embedParam === "" || embedParam === "true";
  // `?from=embed`: brukeren klikket seg hit fra embed-teaseren → "Klar"-gate
  // (oppvarming + ett lyd-trykk) i stedet for å gjenta velkomst-splashen.
  const fromEmbed = fromParam === "embed";

  const projectData = await getCachedReportProduct(customer, projectSlug);

  if (!projectData) {
    notFound();
  }

  // Pre-compute skolekrets server-side so the 700kB GeoJSON never enters the
  // client bundle. The result is stored in project.schoolZone and read by
  // applyCategoryFilter() in report-data.ts (client-side, no GeoJSON import).
  const schoolZone = getSchoolZone(
    projectData.centerCoordinates.lat,
    projectData.centerCoordinates.lng,
  );
  const projectDataWithZone = { ...projectData, schoolZone };

  const poiIds = projectData.pois.map((p) => p.id);
  const themeIds = (projectData.reportConfig?.themes || []).map((t) => t.id);
  const enTranslations = await getProjectTranslations("en", poiIds, themeIds, projectData.id);

  const themeStyle: React.CSSProperties = {};
  const t = projectData.theme;
  if (t) {
    const setIf = (cssVar: string, hex?: string) => {
      if (hex) {
        const channels = hexToHslChannels(hex);
        if (channels) (themeStyle as Record<string, string>)[cssVar] = channels;
      }
    };
    setIf("--background", t.backgroundColor);
    setIf("--foreground", t.foregroundColor);
    setIf("--primary", t.primaryColor);
    setIf("--primary-foreground", t.primaryForegroundColor);
    setIf("--card", t.cardColor);
    setIf("--muted", t.mutedColor);
    setIf("--muted-foreground", t.mutedForegroundColor);
    setIf("--border", t.borderColor);
    if (t.fontFamily) {
      (themeStyle as Record<string, string>)["--font-family"] = t.fontFamily;
    }
    if (t.primaryColor && !t.primaryForegroundColor) {
      const autoFg = pickContrastForeground(t.primaryColor);
      if (autoFg) {
        (themeStyle as Record<string, string>)["--primary-foreground"] = autoFg;
      }
    }
  }

  return (
    <div style={themeStyle} className="min-h-screen bg-background text-foreground">
      <ReportReelsPage
        project={projectDataWithZone}
        enTranslations={enTranslations}
        embed={embed}
        fromEmbed={fromEmbed}
      />
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  const projectData = await getCachedReportProduct(customer, projectSlug);

  if (!projectData) {
    return { title: "Rapport ikke funnet" };
  }

  return buildBoardMetadata({
    project: projectData,
    titleSuffix: "Nabolagsrapport (Board)",
    shareSuffix: "Nabolagsrapport",
    path: `/eiendom/${customer}/${projectSlug}/rapport-board`,
  });
}
