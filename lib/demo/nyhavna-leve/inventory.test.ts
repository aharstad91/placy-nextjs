import { describe, expect, it } from "vitest";
import { adaptBoardData } from "@/components/variants/report/board/board-data";
import { transformToReportData } from "@/components/variants/report/report-data";
import { LEVE_POIS } from "@/lib/demo/nyhavna-leve/content";
import { buildNyhavnaInventory } from "@/lib/demo/nyhavna-leve/inventory";
import { getNyhavnaSnapshot, projectContentHash } from "@/lib/demo/nyhavna-leve/snapshot";

describe("Nyhavna Leve inventory", () => {
  it("binds the frozen project and final board to one content-derived snapshot id", async () => {
    const snapshot = await getNyhavnaSnapshot();
    const hash = projectContentHash(snapshot.project);
    expect(snapshot.snapshotId).toBe(`nyhavna-${hash.slice(0, 16)}`);
    expect(snapshot.board.categories).toEqual(
      adaptBoardData(transformToReportData(snapshot.project)).categories,
    );
  });

  it("accounts for the complete merged input, nested children and demo POIs", async () => {
    const { project, board } = await getNyhavnaSnapshot();
    const report = transformToReportData(project);
    const inventory = buildNyhavnaInventory(project, report, board);

    expect(inventory.project.poiCount).toBe(inventory.ids.projectPois.length);
    expect(inventory.project.childPoiCount).toBe(inventory.ids.childPois.length);
    expect(inventory.project.childPoiCount).toBeGreaterThan(0);
    expect(new Set(inventory.ids.projectPois).size).toBe(project.pois.length);
    expect(LEVE_POIS.every((poi) => inventory.ids.projectPois.includes(poi.id))).toBe(true);
    expect(LEVE_POIS.every((poi) => inventory.ids.reportPois.includes(poi.id))).toBe(true);
    expect(LEVE_POIS.every((poi) => inventory.ids.boardPois.includes(poi.id))).toBe(true);
  });

  it("keeps audit candidates and data gaps explicit", async () => {
    const { project, board } = await getNyhavnaSnapshot();
    const inventory = buildNyhavnaInventory(project, transformToReportData(project), board);

    expect(inventory.project.unplacedMentionCount).toBe(8);
    expect(inventory.unplacedMentions).toHaveLength(8);
    expect(inventory.duplicateNames.length).toBeGreaterThan(0);
    expect(inventory.duplicateIds).toEqual([]);
    expect(inventory.missing.sourcePoiIds.length).toBeGreaterThan(0);
    expect(inventory.missing.coordinatePoiIds).toEqual([]);
    expect(inventory.missing.sourceDatePoiIds).toHaveLength(project.pois.length);
  });
});

it('keeps curated content fresh and records canonical merges in the ledger', async () => {
  const { buildLeveProject } = await import('@/lib/demo/nyhavna-leve/build');
  const { LEVE_CATEGORIES, LEVE_THEMES } = await import('@/lib/demo/nyhavna-leve/content');
  const { readFile } = await import('node:fs/promises');
  const snapshot = await getNyhavnaSnapshot();
  const poiIds = new Set(LEVE_POIS.map(p => p.id));
  const cats = new Set(LEVE_CATEGORIES.map(c => c.id));
  const themes = new Set(LEVE_THEMES.map(t => t.id));
  const project = snapshot.project;
  const rebuilt = buildLeveProject({ ...project, pois: project.pois.filter(p => !poiIds.has(p.id)), categories: project.categories.filter(c => !cats.has(c.id)), reportConfig: { ...project.reportConfig, themes: project.reportConfig?.themes?.filter(t => !themes.has(t.id)) } });
  expect(projectContentHash(JSON.parse(JSON.stringify(rebuilt)))).toBe(projectContentHash(project));
  const ledger = JSON.parse(await readFile('data/demo/nyhavna-review-ledger.json', 'utf8'));
  expect(ledger.snapshotId).toBe(snapshot.snapshotId);
  expect(ledger.records.map((r: { id: string }) => r.id).sort()).toEqual(project.pois.map(p => p.id).sort());
  for (const merge of ledger.mergedRecords) {
    expect(project.pois.some(p => p.id === merge.id)).toBe(false);
    expect(project.pois.some(p => p.id === merge.canonicalId)).toBe(true);
  }
});
