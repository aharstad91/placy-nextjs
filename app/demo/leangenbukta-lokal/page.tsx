import { notFound } from "next/navigation";
import { loadDataset } from "@/lib/demo/local-board/dataset";
import { buildLocalBoard, buildLocalProject } from "@/lib/demo/local-board/board";
import { getLocalDemo } from "@/lib/demo/local-board/registry";
import LokalBoardGate from "./lokal-board-gate";

/**
 * Den lokale Leangenbukta-demoen — ren ramme, tomt innhold (2026-09-18).
 *
 * ## Hva denne ruta er
 *
 * Andre gjennomføring av Nyhavna-metoden, på den delte kjernen i
 * `lib/demo/local-board/`. Samme board-komponenter som resten av Placy, men med
 * JSON-filene i `data/demo/leangenbukta-lokal/` som ENESTE kilde til
 * faginnhold. Ingen Supabase, ingen POI-pool, og ingen arv fra det
 * provisjonerte Leangenbukta-boardet — det står uendret.
 *
 * Demoen starter tom med vilje: hvert sted, hvert fakta og hver kilde som
 * dukker opp, har noen lagt inn etter kildekontroll (U5 og U6 i planen). En tom
 * kategori betyr at demogrunnlaget mangler, ikke at tilbudet mangler i
 * virkeligheten.
 *
 * ## Hvorfor ingen ISR
 *
 * `dynamic = "force-dynamic"`: JSON-filene redigeres mens serveren kjører, og en
 * cachet side ville vist gårsdagens innhold ved siden av en guide som svarer ut
 * av dagens.
 *
 * ## Hvorfor bare lokalt
 *
 * Datasettet ligger i repoet og kan inneholde innhold som ikke er kontrollert
 * ennå; ruta skal ikke være en publisert side.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Leangenbukta — lokal demo",
  description: "Placy-board for Leangenbukta, bygd på lokale JSON-filer.",
  robots: { index: false, follow: false },
};

export default async function LeangenbuktaLokalPage() {
  if (process.env.NODE_ENV === "production") notFound();

  // Feilen fra lasteren peker på fil, felt og hva som manglet, og får boble opp
  // som den er. En demo som stille faller tilbake til noe annet er verdiløs.
  const demo = getLocalDemo("leangenbukta-lokal");
  const dataset = await loadDataset(demo);
  const project = buildLocalProject(dataset, demo);
  const board = buildLocalBoard(dataset, demo);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LokalBoardGate project={project} boardData={board} />
    </div>
  );
}
