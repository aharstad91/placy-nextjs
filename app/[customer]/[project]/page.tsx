import { notFound } from "next/navigation";
import { getProjectAsync } from "@/lib/data-server";
import { getCollectionBySlug } from "@/lib/supabase/queries";
import ExplorerPage from "@/components/variants/explorer/ExplorerPage";
import ReportPage from "@/components/variants/report/ReportPage";
import PortraitPage from "@/components/variants/portrait/PortraitPage";
import type { ProductType } from "@/lib/types";
import type { ComponentType } from "react";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const PRODUCT_COMPONENTS: Record<ProductType, ComponentType<{ project: any }>> = {
  explorer: ExplorerPage,
  report: ReportPage,
  portrait: PortraitPage,
};

export default async function ProjectPage({ params, searchParams }: PageProps) {
  const { customer, project: projectSlug } = await params;
  const resolvedSearchParams = await searchParams;

  const projectData = await getProjectAsync(customer, projectSlug);

  if (!projectData) {
    notFound();
  }

  // If ?c=<slug> is present and this is an explorer project, fetch collection
  if (projectData.productType === "explorer" && typeof resolvedSearchParams.c === "string") {
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
        />
      );
    }
  }

  const ProductComponent = PRODUCT_COMPONENTS[projectData.productType];
  return <ProductComponent project={projectData} />;
}

export async function generateMetadata({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;
  const projectData = await getProjectAsync(customer, projectSlug);

  if (!projectData) {
    return { title: "Prosjekt ikke funnet" };
  }

  return {
    title: `${projectData.story.title} | Placy`,
    description: projectData.story.introText,
  };
}
