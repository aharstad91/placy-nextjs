import { notFound } from "next/navigation";
import {
  getProjectAsync,
  getBaseSlug,
  projectExists,
  getProjectContainerAsync,
} from "@/lib/data-server";
import { getCollectionBySlug } from "@/lib/supabase/queries";
import ExplorerPage from "@/components/variants/explorer/ExplorerPage";
import ReportPage from "@/components/variants/report/ReportPage";
import PortraitPage from "@/components/variants/portrait/PortraitPage";
import TripPage from "@/components/variants/trip/TripPage";
import WelcomeScreen from "@/components/shared/WelcomeScreen";
import { DEFAULT_THEMES } from "@/lib/themes";
import type { ProductType } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/** Map ProductType to URL path segment */
const PRODUCT_PATH: Record<ProductType, string> = {
  explorer: "explore",
  report: "report",
  guide: "trip",
};

export default async function ProjectPage({ params, searchParams }: PageProps) {
  const { customer, project: projectSlug } = await params;
  const resolvedSearchParams = await searchParams;

  // ===== Try new hierarchy first =====
  const container = await getProjectContainerAsync(customer, projectSlug);

  if (container && container.products.length > 0) {
    const defaultProduct = container.defaultProduct ?? "report";
    const productPath = PRODUCT_PATH[defaultProduct];
    const showThemeSelector = defaultProduct !== "guide";

    // Enrich themes with POI counts from container data
    const themesWithStats = DEFAULT_THEMES.map((theme) => {
      const catSet = new Set(theme.categories);
      const poiCount = container.pois.filter((p) => catSet.has(p.category.id)).length;
      return { ...theme, poiCount };
    });

    return (
      <WelcomeScreen
        projectName={container.name}
        heroTitle={container.welcomeTitle}
        tagline={container.welcomeTagline}
        heroImage={container.welcomeImage}
        defaultProductPath={productPath}
        basePath={`/for/${customer}/${projectSlug}`}
        themes={themesWithStats}
        showThemeSelector={showThemeSelector}
      />
    );
  }

  // ===== Fallback: Legacy behavior =====
  const projectData = await getProjectAsync(customer, projectSlug);

  if (!projectData) {
    notFound();
  }

  // === Explorer ===
  if (projectData.productType === "explorer") {
    // Collection mode
    if (typeof resolvedSearchParams.c === "string") {
      const collection = await getCollectionBySlug(resolvedSearchParams.c);
      if (collection) {
        return (
          <ExplorerPage
            project={projectData}
            collection={{
              slug: collection.slug,
              poiIds: collection.poi_ids,
              createdAt: collection.created_at,
              email: collection.email,
            }}
            initialPOI={
              typeof resolvedSearchParams.poi === "string"
                ? resolvedSearchParams.poi
                : undefined
            }
            initialCategories={
              typeof resolvedSearchParams.categories === "string"
                ? resolvedSearchParams.categories.split(",")
                : undefined
            }
          />
        );
      }
    }

    return (
      <ExplorerPage
        project={projectData}
        initialPOI={
          typeof resolvedSearchParams.poi === "string"
            ? resolvedSearchParams.poi
            : undefined
        }
        initialCategories={
          typeof resolvedSearchParams.categories === "string"
            ? resolvedSearchParams.categories.split(",")
            : undefined
        }
      />
    );
  }

  // === Report ===
  if (projectData.productType === "report") {
    const base = getBaseSlug(projectSlug);
    const explorerSlug = `${base}-explore`;
    const hasExplorer = await projectExists(customer, explorerSlug);

    return (
      <ReportPage
        project={projectData}
        explorerBaseUrl={hasExplorer ? `/${customer}/${explorerSlug}` : null}
      />
    );
  }

  // === Guide ===
  if (projectData.productType === "guide") {
    return <TripPage project={projectData} />;
  }

  // === Portrait ===
  return <PortraitPage project={projectData} />;
}

export async function generateMetadata({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  // Try new hierarchy first
  const container = await getProjectContainerAsync(customer, projectSlug);
  if (container) {
    return {
      title: `${container.name} | Placy`,
      description: container.welcomeTagline ?? `Utforsk nabolaget rundt ${container.name}`,
      alternates: {
        canonical: `https://placy.no/for/${customer}/${projectSlug}`,
      },
    };
  }

  // Fallback to legacy
  const projectData = await getProjectAsync(customer, projectSlug);

  if (!projectData) {
    return { title: "Prosjekt ikke funnet" };
  }

  return {
    title: `${projectData.story.title} | Placy`,
    description: projectData.story.introText,
  };
}
