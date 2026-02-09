import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Compass, FileText, Map } from "lucide-react";
import {
  getProjectAsync,
  getBaseSlug,
  projectExists,
  getProjectContainerAsync,
  getProjectProducts,
} from "@/lib/data-server";
import { getCollectionBySlug } from "@/lib/supabase/queries";
import ExplorerPage from "@/components/variants/explorer/ExplorerPage";
import ReportPage from "@/components/variants/report/ReportPage";
import PortraitPage from "@/components/variants/portrait/PortraitPage";
import TripPage from "@/components/variants/trip/TripPage";

export const dynamic = "force-dynamic";
import type { ProductType, ProductSummary } from "@/lib/types";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const PRODUCT_CONFIG: Record<
  ProductType,
  {
    title: string;
    description: string;
    icon: typeof Compass;
    cta: string;
    path: string;
  }
> = {
  explorer: {
    title: "Explorer",
    description: "Utforsk nærområdet fritt. Filtrer etter kategorier og oppdag nye steder.",
    icon: Compass,
    cta: "Utforsk",
    path: "explore",
  },
  report: {
    title: "Nabolagsrapport",
    description: "Redaksjonell oversikt over området med fakta og anbefalinger.",
    icon: FileText,
    cta: "Les rapport",
    path: "report",
  },
  guide: {
    title: "Trip",
    description: "Følg en kuratert tur gjennom de beste stedene i området.",
    icon: Map,
    cta: "Start tur",
    path: "trip",
  },
};

export default async function ProjectPage({ params, searchParams }: PageProps) {
  const { customer, project: projectSlug } = await params;
  const resolvedSearchParams = await searchParams;

  // ===== Try new hierarchy first =====
  const container = await getProjectContainerAsync(customer, projectSlug);

  if (container && container.products.length > 0) {
    // New hierarchy: show landing page
    const products: ProductSummary[] = container.products.map((p) => ({
      type: p.productType,
      poiCount: p.poiIds.length,
      hasStory: !!p.storyTitle,
    }));

    // If only one product, redirect to it
    if (products.length === 1) {
      const product = products[0];
      const config = PRODUCT_CONFIG[product.type];
      redirect(`/${customer}/${projectSlug}/${config.path}`);
    }

    // Show landing page
    return (
      <main className="min-h-screen bg-[#faf9f7]">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <header className="mb-10">
            <p className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-3">
              Velg opplevelse
            </p>
            <h1 className="text-3xl font-semibold text-[#1a1a1a]">
              {container.name}
            </h1>
          </header>

          <ul
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            aria-label="Tilgjengelige produkter"
          >
            {products.map((product) => {
              const config = PRODUCT_CONFIG[product.type];
              const Icon = config.icon;

              return (
                <li key={product.type}>
                  <article className="group relative flex flex-col p-6 bg-white border border-[#eae6e1] rounded-xl hover:shadow-md transition-all">
                    <Icon className="w-8 h-8 text-[#7a7062] mb-3" />
                    <h2 className="font-semibold text-lg mb-2">
                      <Link
                        href={`/${customer}/${projectSlug}/${config.path}`}
                        className="after:absolute after:inset-0"
                      >
                        {config.title}
                      </Link>
                    </h2>
                    <p className="text-sm text-[#6a6a6a] flex-1">
                      {config.description}
                    </p>
                    {product.poiCount > 0 && (
                      <p className="text-xs text-[#a0937d] mt-2">
                        {product.poiCount} steder
                      </p>
                    )}
                    <span
                      className="mt-4 text-sm font-medium group-hover:underline"
                      aria-hidden
                    >
                      {config.cta} →
                    </span>
                  </article>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
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
      description: `Velg mellom Explorer, Report og Trip for ${container.name}`,
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
