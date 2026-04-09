import type { Metadata } from "next";
import { getProjectAsync, getProjectProducts, getProjectShortId } from "@/lib/data-server";
import ProductNav from "@/components/shared/ProductNav";
import type { ProductLink } from "@/components/shared/ProductNav";
import { PageTransition } from "@/components/transitions";
import { eiendomUrl } from "@/lib/urls";

interface LayoutProps {
  params: Promise<{ customer: string; project: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ customer: string; project: string }>;
}): Promise<Metadata> {
  const { customer, project } = await params;

  const formatTitle = (slug: string) =>
    slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  return {
    title: `${formatTitle(project)} | Placy`,
    description: `Oppdag nabolaget rundt ${formatTitle(project)} - lokasjonsbasert storytelling`,
    openGraph: {
      title: `${formatTitle(project)} | Placy`,
      description: `Oppdag nabolaget rundt ${formatTitle(project)}`,
      type: "website",
    },
  };
}

/** Map product type from DB to eiendom route labels and paths */
const PRODUCT_TYPE_MAP: Record<string, { label: string; mode?: "rapport" | "visning" }> = {
  explorer: { label: "Explorer" },
  report: { label: "Rapport", mode: "rapport" },
  // Visning is always available for eiendom projects (uses explorer data)
};

/** Modes that are always shown in eiendom projects, regardless of DB products */
const ALWAYS_AVAILABLE_MODES: { label: string; mode: "visning" }[] = [
  { label: "Visning", mode: "visning" },
];

export default async function EiendomProjectLayout({ params, children }: LayoutProps) {
  const { customer, project: projectSlug } = await params;

  const [projectData, availableProducts, shortId] = await Promise.all([
    getProjectAsync(customer, projectSlug),
    getProjectProducts(customer, projectSlug),
    getProjectShortId(customer, projectSlug),
  ]);

  if (!projectData) {
    return <>{children}</>;
  }

  const basePath = eiendomUrl(customer, projectSlug);

  // Build tabs dynamically from available products
  const products: ProductLink[] = availableProducts
    .filter((p) => PRODUCT_TYPE_MAP[p.type])
    .map((p) => {
      const config = PRODUCT_TYPE_MAP[p.type];
      return {
        label: config.label,
        href: config.mode ? `${basePath}/${config.mode}` : basePath,
        // Explorer is the root path — use exact match to avoid double-highlight
        exact: !config.mode,
      };
    });

  // Add always-available modes (Visning)
  for (const mode of ALWAYS_AVAILABLE_MODES) {
    products.push({
      label: mode.label,
      href: `${basePath}/${mode.mode}`,
    });
  }

  return (
    <>
      <ProductNav
        projectName={projectData.name}
        products={products}
        adminEditUrl={shortId ? `/admin/projects/${shortId}` : null}
        homeHref={basePath}
      />
      <PageTransition className="pt-12">
        {children}
      </PageTransition>
    </>
  );
}
