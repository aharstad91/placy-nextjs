import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductAsync } from "@/lib/data-server";
import { getBransjeprofil } from "@/lib/themes";
import { getCollectionBySlug } from "@/lib/supabase/collections";
import { eventToBoardData } from "@/lib/event-board/event-board-data";
import { buildReportBoardStyle } from "@/lib/board/report-board-style";
import { buildBoardMetadata } from "@/lib/seo/board-metadata";
import ReportReelsPage from "@/components/variants/report/reels/ReportReelsPage";

// Event-board er dynamisk på samme måte som event-Explorer-ruten: data hentes
// per request, ingen cache. force-dynamic speiler `app/event/[c]/[p]/page.tsx`.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Event-board-rute (D1). Ny subrute i `/event/`-namespacet som rendrer board-
 * skallet (sidebar + persistent 2D/3D-kart) fra event-data — uten å gå via
 * report-productType-gating under `/eiendom/`.
 *
 * Datalast speiler event-Explorer-ruten (`getProductAsync(..., "explorer")` +
 * `getBransjeprofil(tags)`), men i stedet for `ExplorerPage` bygges `BoardData`
 * via `eventToBoardData` (event-native adapter, Unit 2) og mates til
 * `ReportReelsPage` som ferdig `boardData` (D2). Event-modus (D3) trer i kraft
 * automatisk fordi `boardData` er en eksplisitt prop → ingen megler/eiendoms-
 * chrome.
 *
 * `enTranslations` utelates (default `{}`) — events har ikke kuratert oversettelse.
 * `mapbox-gl.css` lastes av event-layouten (`app/event/layout.tsx`, CDN-<link>),
 * så ingen komponent-import er nødvendig (den døde top-level-importen i
 * `ReportReelsPage.tsx` er fjernet — PRD 9 Unit 2).
 *
 * Events starter i 2D med mindre `has3dAddon` er satt på prosjektet (det er
 * default `false`); `ReportReelsPage` leser `project.has3dAddon`.
 *
 * "Min samling" (Unit 5, R6): `?c=<slug>` → `getCollectionBySlug` →
 * preselekterte POI-IDer som rehydreres i board-ruten. Presedensen er
 * `app/eiendom/[customer]/[project]/page.tsx` (faktisk `getCollectionBySlug`-
 * oppslag), IKKE event-Explorer-rutens boolske `c`-sjekk. Ugyldig/utløpt slug
 * → `getCollectionBySlug` returnerer `null` → ingen collection-prop (tom
 * samling, ingen krasj).
 */
export default async function EventBoardPage({ params, searchParams }: PageProps) {
  const { customer, project: projectSlug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};

  // v2 er eneste datakilde (JSON-fallbacken døde ved legacy-oppryddingen
  // 2026-07-06). Event-prosjekter provisjoneres inn i v2 når sporet gjenåpnes.
  const projectData = await getProductAsync(customer, projectSlug, "explorer");

  if (!projectData) {
    notFound();
  }

  // Bransjeprofil-features (Event-tags) — holdes i adapter-signaturen for paritet
  // og fremtidig feature-gating (dayFilter/agendaView i senere units).
  const profil = getBransjeprofil(projectData.tags);
  const boardData = eventToBoardData(projectData, profil.features);

  // ?c=<slug> → rehydrer delt samling (eiendom-presedens). Ugyldig/utløpt slug
  // → getCollectionBySlug returnerer null → collection forblir undefined.
  //
  // Prosjekt-scoping: samlingen lagrer `project_id` (= `project.id` ved
  // opprettelse, se /api/collections + BoardCollectionDrawer). En slug fra
  // prosjekt A åpnet på prosjekt B ville ellers seede A-sine POI-IDer inn i B
  // (som ikke finnes der → forvirrende tom highlight). Krever match mot
  // `projectData.id`; mismatch behandles som ingen samling.
  const collectionSlug =
    typeof resolvedSearchParams.c === "string" ? resolvedSearchParams.c : undefined;
  const collectionRow = collectionSlug
    ? await getCollectionBySlug(collectionSlug)
    : null;
  const collection =
    collectionRow && collectionRow.project_id === projectData.id
      ? { slug: collectionRow.slug, poiIds: collectionRow.poi_ids }
      : undefined;

  // Theme-CSS-var-wrapper (speiler rapport-board minimalt). Events har som regel
  // ingen `theme` → themeStyle blir `{}` og skallet bruker default Tailwind-
  // tokens. Når et event-prosjekt har en theme respekteres den.
  const themeStyle = buildReportBoardStyle(projectData);

  return (
    <div style={themeStyle} className="min-h-screen bg-background text-foreground">
      <ReportReelsPage
        project={projectData}
        boardData={boardData}
        collection={collection}
      />
    </div>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { customer, project: projectSlug } = await params;

  const projectData = await getProductAsync(customer, projectSlug, "explorer");

  if (!projectData) {
    return { title: "Event not found" };
  }

  return buildBoardMetadata({
    project: projectData,
    titleSuffix: "Program (Board)",
    shareSuffix: "Program",
    path: `/event/${customer}/${projectSlug}/board`,
    description: `Utforsk programmet til ${projectData.name} på kartet`,
  });
}
