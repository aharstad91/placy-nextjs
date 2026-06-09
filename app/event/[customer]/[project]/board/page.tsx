import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductAsync, getProjectAsync } from "@/lib/data-server";
import { getBransjeprofil } from "@/lib/themes";
import { eventToBoardData } from "@/lib/event-board/event-board-data";
import { hexToHslChannels, pickContrastForeground } from "@/lib/theme-utils";
import ReportReelsPage from "@/components/variants/report/reels/ReportReelsPage";

// Event-board er dynamisk på samme måte som event-Explorer-ruten: data hentes
// per request, ingen cache. force-dynamic speiler `app/event/[c]/[p]/page.tsx`.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
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
 * `mapbox-gl.css` er garantert via `ReportReelsPage.tsx` (top-level import), så
 * ingen ekstra layout-import er nødvendig.
 *
 * Events starter i 2D med mindre `has3dAddon` er satt på prosjektet (det er
 * default `false`); `ReportReelsPage` leser `project.has3dAddon`.
 */
export default async function EventBoardPage({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  // Prøv ny hierarki først, fall tilbake til legacy (speiler event-Explorer-ruten).
  let projectData = await getProductAsync(customer, projectSlug, "explorer");
  if (!projectData) {
    const legacyProject = await getProjectAsync(customer, projectSlug);
    if (legacyProject?.productType === "explorer") {
      projectData = legacyProject;
    }
  }

  if (!projectData) {
    notFound();
  }

  // Bransjeprofil-features (Event-tags) — holdes i adapter-signaturen for paritet
  // og fremtidig feature-gating (dayFilter/agendaView i senere units).
  const profil = getBransjeprofil(projectData.tags);
  const boardData = eventToBoardData(projectData, profil.features);

  // Theme-CSS-var-wrapper (speiler rapport-board minimalt). Events har som regel
  // ingen `theme` → themeStyle blir `{}` og skallet bruker default Tailwind-
  // tokens. Når et event-prosjekt har en theme respekteres den.
  const themeStyle: React.CSSProperties = {};
  const t = projectData.theme;
  if (t) {
    const setIf = (cssVar: string, hex?: string) => {
      if (hex) {
        const channels = hexToHslChannels(hex);
        if (channels) (themeStyle as Record<string, string>)[cssVar] = channels;
      }
    };
    setIf("--background", t.backgroundColor);
    setIf("--foreground", t.foregroundColor);
    setIf("--primary", t.primaryColor);
    setIf("--primary-foreground", t.primaryForegroundColor);
    setIf("--card", t.cardColor);
    setIf("--muted", t.mutedColor);
    setIf("--muted-foreground", t.mutedForegroundColor);
    setIf("--border", t.borderColor);
    if (t.fontFamily) {
      (themeStyle as Record<string, string>)["--font-family"] = t.fontFamily;
    }
    if (t.primaryColor && !t.primaryForegroundColor) {
      const autoFg = pickContrastForeground(t.primaryColor);
      if (autoFg) {
        (themeStyle as Record<string, string>)["--primary-foreground"] = autoFg;
      }
    }
  }

  return (
    <div style={themeStyle} className="min-h-screen bg-background text-foreground">
      <ReportReelsPage project={projectData} boardData={boardData} />
    </div>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { customer, project: projectSlug } = await params;

  let projectData = await getProductAsync(customer, projectSlug, "explorer");
  if (!projectData) {
    projectData = await getProjectAsync(customer, projectSlug);
  }

  if (!projectData) {
    return { title: "Event not found" };
  }

  return {
    title: `${projectData.story.title} – Program (Board) | Placy`,
    description: `Utforsk programmet til ${projectData.name} på kartet`,
  };
}
