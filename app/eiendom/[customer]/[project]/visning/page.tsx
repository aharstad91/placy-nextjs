import { notFound } from "next/navigation";
import { getProductAsync, getProjectAsync } from "@/lib/data-server";
import { getBransjeprofil } from "@/lib/themes";
import { eiendomUrl } from "@/lib/urls";
import VisningPage from "@/components/variants/visning/VisningPage";
import type { ThemeDefinition } from "@/lib/themes";
import type { POI } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
}

interface ThemeGroup {
  theme: ThemeDefinition;
  pois: POI[];
}

function groupPoisByTheme(pois: POI[], themes: ThemeDefinition[]): ThemeGroup[] {
  const groups: ThemeGroup[] = [];

  for (const theme of themes) {
    const cats = new Set(theme.categories);
    const themePOIs = pois
      .filter((p) => cats.has(p.category.id))
      .sort((a, b) => {
        // Sort by walk time (nearest first), fallback to name
        const aWalk = a.travelTime?.walk ?? Infinity;
        const bWalk = b.travelTime?.walk ?? Infinity;
        if (aWalk !== bWalk) return aWalk - bWalk;
        return a.name.localeCompare(b.name, "nb");
      });

    if (themePOIs.length > 0) {
      groups.push({ theme, pois: themePOIs });
    }
  }

  return groups;
}

export default async function VisningRoute({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  let projectData = await getProductAsync(customer, projectSlug, "explorer");

  if (!projectData) {
    const legacyProject = await getProjectAsync(customer, projectSlug);
    if (legacyProject?.productType === "explorer") {
      projectData = legacyProject;
    }
  }

  if (!projectData) {
    notFound();
  }

  const profil = getBransjeprofil(projectData.tags);

  // Use bransjeprofil themes, or fall back to project categories
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

  const themeGroups = groupPoisByTheme(projectData.pois, effectiveThemes);
  const explorerUrl = `https://placy.no${eiendomUrl(customer, projectSlug)}`;

  return (
    <VisningPage
      projectName={projectData.name}
      address={projectData.pois[0]?.address ?? projectData.name}
      themeGroups={themeGroups.map((g) => ({
        id: g.theme.id,
        name: g.theme.name,
        icon: g.theme.icon,
        color: g.theme.color,
        pois: g.pois.map((p) => ({
          id: p.id,
          name: p.name,
          categoryColor: p.category.color,
          walkMinutes: p.travelTime?.walk
            ? Math.round(p.travelTime.walk / 60)
            : null,
        })),
      }))}
      explorerUrl={explorerUrl}
    />
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  let projectData = await getProductAsync(customer, projectSlug, "explorer");
  if (!projectData) {
    projectData = await getProjectAsync(customer, projectSlug);
  }

  if (!projectData) {
    return { title: "Visningsassistent ikke funnet" };
  }

  return {
    title: `Visningsassistent — ${projectData.name} | Placy`,
    description: `Nabolagsoversikt for visning: ${projectData.name}`,
    alternates: {
      canonical: eiendomUrl(customer, projectSlug, "visning"),
    },
    robots: { index: false, follow: false },
  };
}
