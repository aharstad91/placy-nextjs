import type { Metadata } from "next";
import { PageTransition } from "@/components/transitions";

interface LayoutProps {
  params: Promise<{ customer: string; project: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ customer: string; project: string }>;
}): Promise<Metadata> {
  const { project } = await params;

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

export default async function EiendomProjectLayout({ children }: LayoutProps) {
  return <PageTransition>{children}</PageTransition>;
}
