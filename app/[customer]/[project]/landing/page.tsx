import { notFound } from "next/navigation";
import Link from "next/link";
import { Compass, FileText, Map } from "lucide-react";
import { getProjectContainerAsync, getProjectProducts } from "@/lib/data-server";
import type { ProductType, ProductSummary } from "@/lib/types";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
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
    title: "Guide",
    description: "Følg en kuratert tur gjennom de beste stedene i området.",
    icon: Map,
    cta: "Start tur",
    path: "guide",
  },
};

export default async function ProjectLandingPage({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  // Try new hierarchy first, then fall back to legacy
  let projectName: string;
  let products: ProductSummary[];

  const container = await getProjectContainerAsync(customer, projectSlug);
  if (container) {
    projectName = container.name;
    products = container.products.map((p) => ({
      type: p.productType,
      poiCount: p.poiIds.length,
      hasStory: !!p.storyTitle,
    }));
  } else {
    // Fallback: get products from legacy structure
    products = await getProjectProducts(customer, projectSlug);
    if (products.length === 0) {
      notFound();
    }
    // Use first product's project data for name (they share the same base name)
    projectName = projectSlug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  // If only one product, redirect to it
  if (products.length === 1) {
    const product = products[0];
    const config = PRODUCT_CONFIG[product.type];
    // Note: In real implementation, this would use redirect()
    // For now, we show the landing page anyway
  }

  return (
    <main className="min-h-screen bg-[#faf9f7]">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-3">
            Velg opplevelse
          </p>
          <h1 className="text-3xl font-semibold text-[#1a1a1a]">{projectName}</h1>
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
                  <p className="text-sm text-[#6a6a6a] flex-1">{config.description}</p>
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

export async function generateMetadata({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  const container = await getProjectContainerAsync(customer, projectSlug);
  const projectName = container?.name ?? projectSlug;

  return {
    title: `${projectName} | Placy`,
    description: `Velg mellom Explorer, Report og Guide for ${projectName}`,
  };
}
