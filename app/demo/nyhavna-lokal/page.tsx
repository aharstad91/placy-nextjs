import { notFound } from "next/navigation";
import { hostedVoiceEnabled } from "@/lib/live/hosted-access";
import { loadDataset } from "@/lib/demo/nyhavna-lokal/dataset";
import { buildLocalBoard, buildLocalProject } from "@/lib/demo/nyhavna-lokal/board";
import LokalBoardGate from "@/app/demo/nyhavna-lokal/lokal-board-gate";

/** Curated Nyhavna demo, shared directly by URL and excluded from search indexing. */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nyhavna — demo",
  description: "Utforsk Nyhavna med kart og samtaleguiden Anja.",
  robots: { index: false, follow: false },
};

export default async function NyhavnaLokalPage() {
  if (process.env.NODE_ENV === "production" && !hostedVoiceEnabled()) notFound();

  // Feilen fra lasteren peker på fil, felt og hva som manglet, og får boble opp
  // som den er. En demo som stille faller tilbake til noe annet er verdiløs.
  const dataset = await loadDataset();
  const project = buildLocalProject(dataset);
  const board = buildLocalBoard(dataset);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LokalBoardGate project={project} boardData={board} />
    </div>
  );
}
