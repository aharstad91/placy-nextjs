import type { Metadata } from "next";

// Dynamisk metadata basert på prosjekt
export async function generateMetadata({
  params,
}: {
  params: Promise<{ customer: string; project: string }>;
}): Promise<Metadata> {
  const { customer, project } = await params;

  // Konverter slug til lesbar tittel
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

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
