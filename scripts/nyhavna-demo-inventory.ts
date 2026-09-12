import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { adaptBoardData } from "@/components/variants/report/board/board-data";
import { transformToReportData } from "@/components/variants/report/report-data";
import { buildLeveProject, LEVE_CUSTOMER, LEVE_PROJECT } from "@/lib/demo/nyhavna-leve/build";
import { buildNyhavnaInventory } from "@/lib/demo/nyhavna-leve/inventory";
import { projectContentHash } from "@/lib/demo/nyhavna-leve/snapshot";
import { getProductAsync } from "@/lib/data-server";
import type { Project } from "@/lib/types";
import { getSchoolZone } from "@/lib/utils/school-zones";

const INTERNAL_FIELDS = new Set(["poiMetadata", "trustFlags", "trustScore", "trustScoreUpdatedAt", "tierEvaluatedAt", "tierReason"]);

export function publicProject(project: Project): Project {
  return JSON.parse(JSON.stringify(project, (key, value) => INTERNAL_FIELDS.has(key) ? undefined : value)) as Project;
}

async function main() {
  const base = await getProductAsync(LEVE_CUSTOMER, LEVE_PROJECT, "report");
  if (!base) throw new Error(`Fant ikke ${LEVE_CUSTOMER}/${LEVE_PROJECT}`);
  const merged = buildLeveProject(base);
  const project = publicProject({
    ...merged,
    schoolZone: getSchoolZone(merged.centerCoordinates.lat, merged.centerCoordinates.lng),
  });
  const projectHash = projectContentHash(project);
  const snapshotId = `nyhavna-${projectHash.slice(0, 16)}`;
  const report = transformToReportData(project);
  const board = adaptBoardData(report);
  const inventory = buildNyhavnaInventory(project, report, board);
  await writeFile(resolve("data/demo/nyhavna-snapshot.json"), `${JSON.stringify({ schemaVersion: 1, snapshotId, projectHash, project, inventory }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ snapshotId, projectHash, inventory }, null, 2)}\n`);
}

void main();
