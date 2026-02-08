import type { Metadata } from "next";
import { getProjectAsync, getProjectProducts, getProjectShortId } from "@/lib/data-server";
import ProductNav from "@/components/shared/ProductNav";
import type { ProductLink } from "@/components/shared/ProductNav";

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

export default async function ProjectLayout({ params, children }: LayoutProps) {
  const { customer, project: projectSlug } = await params;

  const [projectData, availableProducts, shortId] = await Promise.all([
    getProjectAsync(customer, projectSlug),
    getProjectProducts(customer, projectSlug),
    getProjectShortId(customer, projectSlug),
  ]);

  if (!projectData) {
    return <>{children}</>;
  }

  // Build product links from available products in the hierarchy
  const basePath = `/${customer}/${projectSlug}`;
  const productTypeToLink: Record<string, { label: string; subPath: string }> = {
    explorer: { label: "Explore", subPath: "/explore" },
    guide: { label: "Guides", subPath: "/guide" },
    report: { label: "Report", subPath: "/report" },
  };

  const products: ProductLink[] = availableProducts
    .filter((p) => productTypeToLink[p.type])
    .map((p) => ({
      label: productTypeToLink[p.type].label,
      href: `${basePath}${productTypeToLink[p.type].subPath}`,
    }));

  return (
    <>
      <ProductNav
        projectName={projectData.name}
        products={products}
        adminEditUrl={shortId ? `/admin/projects/${shortId}` : null}
      />
      <div className="pt-12">{children}</div>
    </>
  );
}
