import { notFound } from "next/navigation";
import { getProductAsync, getProjectAsync, productExists } from "@/lib/data-server";
import { getProjectTranslations } from "@/lib/supabase/translations";
import { getAreaSlugForProject } from "@/lib/public-queries";
import ReportPage from "@/components/variants/report/ReportPage";
import { eiendomUrl } from "@/lib/urls";
import { hexToHslChannels } from "@/lib/theme-utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function EiendomReportPage({ params, searchParams }: PageProps) {
  const { customer, project: projectSlug } = await params;
  const resolvedSearchParams = await searchParams;

  // Try new hierarchy first
  let projectData = await getProductAsync(customer, projectSlug, "report");

  // Fallback to legacy: try base slug directly
  if (!projectData) {
    const legacyProject = await getProjectAsync(customer, projectSlug);
    if (legacyProject?.productType === "report") {
      projectData = legacyProject;
    }
  }

  if (!projectData) {
    notFound();
  }

  // Load English translations for locale toggle (Norwegian is canonical in project data)
  const poiIds = projectData.pois.map((p) => p.id);
  const themeIds = (projectData.reportConfig?.themes || []).map((t) => t.id);
  const enTranslations = await getProjectTranslations("en", poiIds, themeIds, projectData.id);

  // Check if explorer exists (for CTA link)
  const hasExplorer = await productExists(customer, projectSlug, "explorer");
  const explorerUrl = hasExplorer ? eiendomUrl(customer, projectSlug) : null;

  // Look up area slug for POI detail page links
  const areaSlug = await getAreaSlugForProject(projectData.id);

  // Parse ?themes= param for welcome screen prioritization
  const rawThemes = typeof resolvedSearchParams.themes === "string"
    ? resolvedSearchParams.themes.split(",")
    : undefined;

  // Build inline CSS variable overrides from project theme.
  // Each hex color becomes HSL channel values (matches shadcn token pattern),
  // injected via React's style prop on the wrapper. Scoped to this subtree —
  // no leakage to other routes.
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
  }

  return (
    <div style={themeStyle} className="min-h-screen bg-background text-foreground">
      <ReportPage
        project={projectData}
        explorerBaseUrl={explorerUrl}
        enTranslations={enTranslations}
        areaSlug={areaSlug}
        primaryThemeIds={rawThemes}
      />
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  let projectData = await getProductAsync(customer, projectSlug, "report");
  if (!projectData) {
    projectData = await getProjectAsync(customer, projectSlug);
  }

  if (!projectData) {
    return { title: "Rapport ikke funnet" };
  }

  return {
    title: `${projectData.story.title} – Nabolagsrapport | Placy`,
    description: projectData.story.introText,
    alternates: {
      canonical: eiendomUrl(customer, projectSlug, "rapport"),
    },
  };
}
