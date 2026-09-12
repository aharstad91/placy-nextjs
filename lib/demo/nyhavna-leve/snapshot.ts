import "server-only";

import { createHash } from "node:crypto";
import { adaptBoardData, type BoardData } from "@/components/variants/report/board/board-data";
import { transformToReportData } from "@/components/variants/report/report-data";
import snapshot from "@/data/demo/nyhavna-snapshot.json";
import type { Project } from "@/lib/types";

interface NyhavnaSnapshotFile { schemaVersion: 1; snapshotId: string; projectHash: string; project: Project }
const frozen = snapshot as unknown as NyhavnaSnapshotFile;

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function projectContentHash(project: Project): string {
  return createHash("sha256").update(stableJson(project)).digest("hex");
}

export async function getNyhavnaSnapshot(): Promise<{ project: Project; board: BoardData; snapshotId: string }> {
  const actualHash = projectContentHash(frozen.project);
  if (actualHash !== frozen.projectHash || frozen.snapshotId !== `nyhavna-${actualHash.slice(0, 16)}`) {
    throw new Error("Nyhavna-snapshotet har ulik ID og innholdshash. Kjør inventory-scriptet på nytt.");
  }
  return { project: frozen.project, board: adaptBoardData(transformToReportData(frozen.project)), snapshotId: frozen.snapshotId };
}
