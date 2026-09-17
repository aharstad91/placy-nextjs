import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { hostedVoiceEnabled } from "@/lib/live/hosted-access";
import { resolveVoiceProject, VoiceProjectError } from "@/lib/live/projects";
import NyhavnaLayout from "@/app/demo/nyhavna-lokal/layout";
import LokalBoardGate from "@/app/demo/nyhavna-lokal/lokal-board-gate";
import ReportReelsPage from "@/components/variants/report/reels/ReportReelsPage";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

// Deduplicate metadata/page reads within this request, never across requests.
const getProject = cache(async (slug: string) => {
  if (!hostedVoiceEnabled()) notFound();
  try {
    return await resolveVoiceProject({ project: slug });
  } catch (error) {
    if (error instanceof VoiceProjectError && error.kind === 'not_found') notFound();
    throw error;
  }
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { project, demo } = await getProject((await params).slug);
  return {
    title: `${project.name} — Placy`,
    description: `Utforsk ${project.name} med kart og samtaleguiden Anja.`,
    robots: { index: false, follow: false },
    ...(demo.id === "nyhavna-lokal" ? { icons: { icon: "/demo/nyhavna-nettside/symbol.svg" } } : {}),
  };
}

export default async function ProjectPage({ params }: PageProps) {
  const { slug, project, demo } = await getProject((await params).slug);
  const board = { ...demo.board, demoDataset: demo.id, voiceProjectSlug: slug };

  if (demo.id === "nyhavna-lokal") {
    return (
      <NyhavnaLayout>
        <div className="min-h-screen bg-background text-foreground">
          <LokalBoardGate project={project} boardData={board} />
        </div>
      </NyhavnaLayout>
    );
  }

  return (
    <>
      <link href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css" rel="stylesheet" />
      <ReportReelsPage project={project} boardData={board} boardMode="report" />
    </>
  );
}
