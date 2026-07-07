import { notFound } from "next/navigation";
import {
  getCachedReportProduct,
  getCachedProjectTranslations,
} from "@/lib/supabase/cached-board-reads";
import { buildBoardMetadata } from "@/lib/seo/board-metadata";
import ReportReelsPage from "@/components/variants/report/reels/ReportReelsPage";
import { hexToHslChannels, pickContrastForeground } from "@/lib/theme-utils";
import { getSchoolZone } from "@/lib/utils/school-zones";

export const revalidate = 3600;

// Uten generateStaticParams server-rendres dynamiske segmenter per request —
// med den (tom liste) ISR-es hver board-URL on-demand og caches etter
// førstetreff (dynamicParams er default true).
export function generateStaticParams(): Array<{ customer: string; project: string }> {
  return [];
}

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
}

export default async function EiendomReportReelsPage({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

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
  const enTranslations = await getCachedProjectTranslations(
    customer,
    projectSlug,
    "en",
    poiIds,
    themeIds,
    projectData.id,
  );

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
      />
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  const projectData = await getCachedReportProduct(customer, projectSlug);

  if (!projectData) {
    return { title: "Reels ikke funnet" };
  }

  return buildBoardMetadata({
    project: projectData,
    titleSuffix: "Reels",
    path: `/eiendom/${customer}/${projectSlug}/rapport-reels`,
  });
}
