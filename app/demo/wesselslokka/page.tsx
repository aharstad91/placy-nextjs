import { notFound } from "next/navigation";
import { getProductAsync, getProjectAsync, productExists } from "@/lib/data-server";
import { getProjectTranslations } from "@/lib/supabase/translations";
import { getAreaSlugForProject } from "@/lib/public-queries";
import ReportPage from "@/components/variants/report/ReportPage";
import { eiendomUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

const CUSTOMER = "broset-utvikling-as";
const PROJECT = "wesselslokka";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function WesselsloekaDemoPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;

  let projectData = await getProductAsync(CUSTOMER, PROJECT, "report");
  if (!projectData) {
    const legacy = await getProjectAsync(CUSTOMER, PROJECT);
    if (legacy?.productType === "report") {
      projectData = legacy;
    }
  }

  if (!projectData) {
    notFound();
  }

  const poiIds = projectData.pois.map((p) => p.id);
  const themeIds = (projectData.reportConfig?.themes || []).map((t) => t.id);
  const enTranslations = await getProjectTranslations(
    "en",
    poiIds,
    themeIds,
    projectData.id
  );

  const hasExplorer = await productExists(CUSTOMER, PROJECT, "explorer");
  const explorerUrl = hasExplorer ? eiendomUrl(CUSTOMER, PROJECT) : null;

  const areaSlug = await getAreaSlugForProject(projectData.id);

  const rawThemes =
    typeof resolvedSearchParams.themes === "string"
      ? resolvedSearchParams.themes.split(",")
      : undefined;

  return (
    <ReportPage
      project={projectData}
      explorerBaseUrl={explorerUrl}
      enTranslations={enTranslations}
      areaSlug={areaSlug}
      primaryThemeIds={rawThemes}
    />
  );
}
