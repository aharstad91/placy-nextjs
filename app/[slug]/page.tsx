import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";

import LokalBoardGate from "@/app/demo/nyhavna-lokal/lokal-board-gate";
import { resolveVoiceProject, VoiceProjectError } from "@/lib/live/projects";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

// The public alias renders the exact registered board source that hosted voice
// resolves. Local preview and production therefore cannot drift in facts,
// instructions, IDs, greeting or feature flags.
const getPublicBoard = cache(async (slug: string) => {
  try {
    const resolved = await resolveVoiceProject({ project: slug }, "public");
    return { project: resolved.project, board: resolved.demo.board };
  } catch (error) {
    if (error instanceof VoiceProjectError && error.kind === "not_found") notFound();
    throw error;
  }
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { project, board } = await getPublicBoard(slug);
  return {
    title: `${project.name} — Placy`,
    description: `Utforsk ${project.name} med kart og samtaleguiden Anja.`,
    robots: { index: false, follow: false },
    alternates: { canonical: `https://placy.no/${slug}` },
    ...(board.home.pinImage
      ? { icons: { icon: board.home.pinImage } }
      : {}),
  };
}

export default async function ProjectPage({ params }: PageProps) {
  const { slug } = await params;
  const { project, board } = await getPublicBoard(slug);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LokalBoardGate project={project} boardData={board} voiceProjectSlug={slug} />
    </div>
  );
}
