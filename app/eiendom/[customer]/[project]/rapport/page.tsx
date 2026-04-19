import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { getProductAsync, getProjectAsync } from "@/lib/data-server";
import { getProjectTranslations } from "@/lib/supabase/translations";
import { getAreaSlugForProject } from "@/lib/public-queries";
import ReportPage from "@/components/variants/report/ReportPage";
import PlacyReportHeader from "@/components/public/PlacyReportHeader";
import PlacyReportFooter from "@/components/public/PlacyReportFooter";
import { eiendomUrl } from "@/lib/urls";
import { hexToHslChannels, pickContrastForeground } from "@/lib/theme-utils";

/**
 * Cached product-fetch. Tag matcher `scripts/gemini-grounding.ts`-revalidate:
 * `product:${customer}_${slug}` hvor projectId er CLI-arg i scriptet. Tagget
 * cache bustes når grounding-scriptet PATCH'er og kaller `/api/revalidate`.
 */
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
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function EiendomReportPage({ params, searchParams }: PageProps) {
  const { customer, project: projectSlug } = await params;
  const resolvedSearchParams = await searchParams;

  // Try new hierarchy first (tagged cache — bustes av gemini-grounding-script via revalidateTag)
  let projectData = await getCachedReportProduct(customer, projectSlug);

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

    // Precedence: eksplisitt primaryForegroundColor (satt via setIf over)
    // vinner. Kun hvis den IKKE er satt, auto-computer vi basert på
    // luminance av primaryColor for å sikre lesbar tekst i header.
    if (t.primaryColor && !t.primaryForegroundColor) {
      const autoFg = pickContrastForeground(t.primaryColor);
      if (autoFg) {
        (themeStyle as Record<string, string>)["--primary-foreground"] = autoFg;
      }
    }
  }

  return (
    <div style={themeStyle} className="min-h-screen bg-background text-foreground flex flex-col">
      <PlacyReportHeader
        projectName={projectData.name}
        homepageUrl={projectData.homepageUrl}
      />
      <main className="flex-1">
        <ReportPage
          project={projectData}
          enTranslations={enTranslations}
          areaSlug={areaSlug}
          primaryThemeIds={rawThemes}
        />
      </main>
      <PlacyReportFooter
        projectName={projectData.name}
        homepageUrl={projectData.homepageUrl}
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
