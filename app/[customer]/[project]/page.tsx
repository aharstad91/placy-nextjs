import { notFound } from "next/navigation";
import { getProjectAsync } from "@/lib/data-server";
import ProjectPageClient from "./ProjectPageClient";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
}

export default async function ProjectPage({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  // Hent prosjektdata fra Supabase (eller JSON fallback)
  const projectData = await getProjectAsync(customer, projectSlug);

  if (!projectData) {
    notFound();
  }

  return <ProjectPageClient project={projectData} />;
}

// Generer metadata for SEO
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
