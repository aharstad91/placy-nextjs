import type { BoardData } from "@/components/variants/report/board/board-data";
import type { ReportData } from "@/components/variants/report/report-data";
import type { Project } from "@/lib/types";

export interface NyhavnaInventory {
  project: { poiCount: number; topLevelPoiCount: number; childPoiCount: number; categoryCount: number; themeCount: number; sourceReferenceCount: number; unplacedMentionCount: number };
  report: { themeCount: number; poiReferenceCount: number };
  board: { categoryCount: number; poiReferenceCount: number; uniquePoiCount: number };
  ids: { projectPois: string[]; childPois: string[]; reportPois: string[]; boardPois: string[] };
  duplicateIds: string[];
  duplicateNames: Array<{ name: string; ids: string[] }>;
  missing: { sourcePoiIds: string[]; coordinatePoiIds: string[]; sourceDatePoiIds: string[] };
  unplacedMentions: Array<{ themeId: string; mention: string }>;
}

function duplicates(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].filter(([, count]) => count > 1).map(([value]) => value).sort();
}

export function buildNyhavnaInventory(project: Project, report: ReportData, board: BoardData): NyhavnaInventory {
  const projectPois = project.pois.map((poi) => poi.id);
  const childPois = project.pois.filter((poi) => poi.parentPoiId).map((poi) => poi.id);
  const reportPois = report.themes.flatMap((theme) => theme.allPOIs.map((poi) => poi.id));
  const boardPois = board.categories.flatMap((category) => category.pois.map((poi) => poi.id));
  const names = new Map<string, Array<{ id: string; name: string }>>();
  for (const poi of project.pois) {
    const key = poi.name.trim().toLocaleLowerCase("nb-NO");
    names.set(key, [...(names.get(key) ?? []), { id: poi.id, name: poi.name }]);
  }
  const unplacedMentions = (project.reportConfig?.themes ?? []).flatMap((theme) =>
    (theme.editorial?.unplaced ?? []).map((mention) => ({ themeId: theme.id, mention })),
  );
  return {
    project: {
      poiCount: project.pois.length,
      topLevelPoiCount: project.pois.length - childPois.length,
      childPoiCount: childPois.length,
      categoryCount: project.categories.length,
      themeCount: project.reportConfig?.themes?.length ?? 0,
      sourceReferenceCount: project.pois.reduce((sum, poi) => sum + (poi.editorialSources?.length ?? 0), 0),
      unplacedMentionCount: unplacedMentions.length,
    },
    report: { themeCount: report.themes.length, poiReferenceCount: reportPois.length },
    board: { categoryCount: board.categories.length, poiReferenceCount: boardPois.length, uniquePoiCount: new Set(boardPois).size },
    ids: { projectPois, childPois, reportPois, boardPois },
    duplicateIds: duplicates(projectPois),
    duplicateNames: [...names.values()].filter((group) => group.length > 1)
      .map((group) => ({ name: group[0].name, ids: group.map(({ id }) => id).sort() }))
      .sort((a, b) => a.name.localeCompare(b.name, "nb-NO")),
    missing: {
      sourcePoiIds: project.pois.filter((poi) => !poi.editorialSources?.length).map((poi) => poi.id),
      coordinatePoiIds: project.pois.filter((poi) => !Number.isFinite(poi.coordinates?.lat) || !Number.isFinite(poi.coordinates?.lng)).map((poi) => poi.id),
      sourceDatePoiIds: project.pois.map((poi) => poi.id),
    },
    unplacedMentions,
  };
}
