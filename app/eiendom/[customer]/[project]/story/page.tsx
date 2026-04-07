import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getProductAsync, getProjectAsync } from "@/lib/data-server";
import { getBransjeprofil } from "@/lib/themes/bransjeprofiler";
import { eiendomUrl } from "@/lib/urls";
import { THEME_MIN_POIS } from "@/lib/story/types";
import StoryPage from "@/components/variants/story/StoryPage";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ customer: string; project: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function StoryRoute({ params, searchParams }: PageProps) {
  const { customer, project: projectSlug } = await params;
  const resolvedSearchParams = await searchParams;

  // Load explorer data (Story Mode reuses explorer's POI set)
  let projectData = await getProductAsync(customer, projectSlug, "explorer");
  if (!projectData) {
    projectData = await getProjectAsync(customer, projectSlug);
  }

  if (!projectData) {
    notFound();
  }

  // Get themes from bransjeprofil
  const profil = getBransjeprofil(projectData.tags);
  const themes = projectData.reportConfig?.themes ?? profil.themes;

  // Check if there's enough data for Story Mode
  const categorySet = new Set(themes.flatMap((t) => t.categories));
  const themePoiCounts: Record<string, number> = {};
  for (const poi of projectData.pois) {
    if (!poi.category?.id) continue;
    for (const theme of themes) {
      if (theme.categories.includes(poi.category.id)) {
        themePoiCounts[theme.id] = (themePoiCounts[theme.id] ?? 0) + 1;
      }
    }
  }
  const qualifyingThemes = themes.filter(
    (t) => (themePoiCounts[t.id] ?? 0) >= THEME_MIN_POIS,
  );

  if (qualifyingThemes.length < 2) {
    redirect(eiendomUrl(customer, projectSlug));
  }

  // Parse ?theme= for deep linking
  const initialTheme =
    typeof resolvedSearchParams.theme === "string"
      ? resolvedSearchParams.theme
      : undefined;

  // Build white-label CSS overrides
  const themeStyle = projectData.theme
    ? `:root {${
        projectData.theme.primaryColor ? ` --placy-primary: ${projectData.theme.primaryColor};` : ""
      }${
        projectData.theme.backgroundColor ? ` --placy-bg: ${projectData.theme.backgroundColor};` : ""
      }${
        projectData.theme.fontFamily ? ` --placy-font: ${projectData.theme.fontFamily};` : ""
      }}`
    : null;

  return (
    <>
      {themeStyle && <style dangerouslySetInnerHTML={{ __html: themeStyle }} />}
      <StoryPage
        project={projectData}
        themes={themes}
        initialTheme={initialTheme}
        explorerUrl={eiendomUrl(customer, projectSlug)}
        reportUrl={eiendomUrl(customer, projectSlug, "rapport")}
      />
    </>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { customer, project: projectSlug } = await params;

  let projectData = await getProductAsync(customer, projectSlug, "explorer");
  if (!projectData) {
    projectData = await getProjectAsync(customer, projectSlug);
  }

  if (!projectData) {
    return { title: "Story ikke funnet" };
  }

  return {
    title: `Utforsk ${projectData.name} — Story | Placy`,
    description: `Oppdag nabolaget rundt ${projectData.name} — interaktiv storytelling`,
    alternates: {
      canonical: eiendomUrl(customer, projectSlug, "story"),
    },
    robots: { index: false, follow: false },
  };
}
