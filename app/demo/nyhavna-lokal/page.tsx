import { notFound } from "next/navigation";
import { loadDataset } from "@/lib/demo/local-board/dataset";
import { buildLocalBoard, buildLocalProject } from "@/lib/demo/local-board/board";
import { getLocalDemo } from "@/lib/demo/local-board/registry";
import LokalBoardGate from "./lokal-board-gate";

/**
 * Den lokale Nyhavna-demoen — ren ramme, lokalt innhold (2026-09-13).
 *
 * ## Hva denne ruta er
 *
 * Samme board-komponenter som resten av Placy, men med JSON-filene i
 * `data/demo/nyhavna-lokal/` som ENESTE kilde til faginnhold. Ingen Supabase,
 * ingen POI-pool, ingen arv fra den eksisterende Nyhavna-demoen på
 * `/eiendom/nyhavna-utvikling/nyhavna/leve` — den står uendret.
 *
 * Formålet er å kunne fylle demoen med kontrollert innhold etter hvert som
 * samtaleøvelsene viser hva folk faktisk spør om. Derfor starter den tom: hver
 * markør, hvert fakta og hver kilde som dukker opp, har noen lagt inn med vilje.
 *
 * ## Hvorfor ingen ISR
 *
 * `dynamic = "force-dynamic"`: JSON-filene redigeres mens serveren kjører, og en
 * cachet side ville vist gårsdagens innhold ved siden av en guide som svarer ut
 * av dagens. Én kilde, én sannhet — også mellom to lesinger.
 *
 * ## Hvorfor bare lokalt
 *
 * Ruta finnes for demo og læring. Datasettet ligger i repoet og kan inneholde
 * innhold som ikke er kontrollert ennå; den skal ikke være en publisert side.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nyhavna — lokal demo",
  description: "Placy-board for Nyhavna, bygd på lokale JSON-filer.",
  robots: { index: false, follow: false },
};

export default async function NyhavnaLokalPage() {
  // Bare i utvikling. Datasettet ligger i repoet og kan inneholde innhold som
  // ikke er kontrollert ennå; det skal ikke kunne nås fra et offentlig domene.
  if (process.env.NODE_ENV === "production") notFound();

  // Feilen fra lasteren peker på fil, felt og hva som manglet, og får boble opp
  // som den er. En demo som stille faller tilbake til noe annet er verdiløs.
  const demo = getLocalDemo("nyhavna-lokal");
  const dataset = await loadDataset(demo);
  const project = buildLocalProject(dataset, demo);
  const board = buildLocalBoard(dataset, demo);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LokalBoardGate project={project} boardData={board} />
    </div>
  );
}
