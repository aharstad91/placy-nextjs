import type { Metadata } from "next";
import { getProjectAsync, getSiblingProducts } from "@/lib/data-server";
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

  const [projectData, siblings] = await Promise.all([
    getProjectAsync(customer, projectSlug),
    getSiblingProducts(customer, projectSlug),
  ]);

  if (!projectData) {
    return <>{children}</>;
  }

  // Build product links from sibling data
  const currentPath = `/${customer}/${projectSlug}`;
  const products: ProductLink[] = [];

  if (siblings.explore) {
    products.push({
      label: "Explore",
      href: siblings.explore,
      active: siblings.explore === currentPath,
    });
  }
  if (siblings.guide) {
    products.push({
      label: "Guides",
      href: siblings.guide,
      active: siblings.guide === currentPath,
    });
  }
  if (siblings.report) {
    products.push({
      label: "Report",
      href: siblings.report,
      active: siblings.report === currentPath,
    });
  }

  return (
    <>
      <ProductNav projectName={projectData.name} products={products} />
      <div className="pt-12">{children}</div>
    </>
  );
}
