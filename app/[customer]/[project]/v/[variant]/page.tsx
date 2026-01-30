import { notFound } from "next/navigation";
import { getProjectAsync } from "@/lib/data-server";
import MagazinePage from "@/components/variants/magazine/MagazinePage";
import PortraitPage from "@/components/variants/portrait/PortraitPage";
import ExplorerPage from "@/components/variants/explorer/ExplorerPage";
import ReportPage from "@/components/variants/report/ReportPage";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
    variant: string;
  }>;
}

const VARIANT_COMPONENTS: Record<string, React.ComponentType<{ project: any }>> = {
  magazine: MagazinePage,
  portrait: PortraitPage,
  explorer: ExplorerPage,
  report: ReportPage,
};

export default async function VariantPage({ params }: PageProps) {
  const { customer, project: projectSlug, variant } = await params;

  const VariantComponent = VARIANT_COMPONENTS[variant];
  if (!VariantComponent) {
    notFound();
  }

  const projectData = await getProjectAsync(customer, projectSlug);
  if (!projectData) {
    notFound();
  }

  return <VariantComponent project={projectData} />;
}

export async function generateMetadata({ params }: PageProps) {
  const { customer, project: projectSlug, variant } = await params;
  const projectData = await getProjectAsync(customer, projectSlug);

  if (!projectData) {
    return { title: "Prosjekt ikke funnet" };
  }

  return {
    title: `${projectData.story.title} — ${variant} | Placy`,
    description: projectData.story.introText,
  };
}
