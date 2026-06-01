import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { getProductAsync, getProjectAsync } from "@/lib/data-server";
import { getProjectTranslations } from "@/lib/supabase/translations";
import ReportReelsPage from "@/components/variants/report/reels/ReportReelsPage";
import { hexToHslChannels, pickContrastForeground } from "@/lib/theme-utils";

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
}

export default async function EiendomReportReelsPage({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  let projectData = await getCachedReportProduct(customer, projectSlug);

  if (!projectData) {
    const legacyProject = await getProjectAsync(customer, projectSlug);
    if (legacyProject?.productType === "report") {
      projectData = legacyProject;
    }
  }

  if (!projectData) {
    notFound();
  }

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
        project={projectData}
        enTranslations={enTranslations}
      />
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  let projectData = await getCachedReportProduct(customer, projectSlug);
  if (!projectData) {
    projectData = await getProjectAsync(customer, projectSlug);
  }

  if (!projectData) {
    return { title: "Reels ikke funnet" };
  }

  return {
    title: `${projectData.story.title} – Reels | Placy`,
    description: projectData.story.introText,
    alternates: {
      canonical: `/eiendom/${customer}/${projectSlug}/rapport-reels`,
    },
  };
}
