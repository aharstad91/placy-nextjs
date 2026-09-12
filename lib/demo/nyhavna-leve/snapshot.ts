import "server-only";

import { createHash } from "node:crypto";
import { adaptBoardData, type BoardData } from "@/components/variants/report/board/board-data";
import { transformToReportData } from "@/components/variants/report/report-data";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { nyhavnaKnowledge } from "@/lib/demo/nyhavna-leve/knowledge";
import type { Project } from "@/lib/types";

interface NyhavnaSnapshotFile { schemaVersion: 1; snapshotId: string; projectHash: string; project: Project }


export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function projectContentHash(project: Project): string {
  const content = { ...project };
  delete content.demoSnapshotId;
  return createHash("sha256").update(stableJson({ project: content, knowledge: nyhavnaKnowledge })).digest("hex");
}

export async function getNyhavnaSnapshot(): Promise<{ project: Project; board: BoardData; snapshotId: string }> {
  // Parse original JSON: bundlers can round long decimal literals differently from JSON.parse.
  const frozen = JSON.parse(await readFile(join(process.cwd(), "data/demo/nyhavna-snapshot.json"), "utf8")) as NyhavnaSnapshotFile;
  const ledger = JSON.parse(await readFile(join(process.cwd(), "data/demo/nyhavna-review-ledger.json"), "utf8")) as { snapshotId: string };
  const actualHash = projectContentHash(frozen.project);
  if (ledger.snapshotId !== frozen.snapshotId || actualHash !== frozen.projectHash || frozen.snapshotId !== `nyhavna-${actualHash.slice(0, 16)}`) {
    throw new Error("Nyhavna-snapshotet har ulik ID og innholdshash. Kjør inventory-scriptet på nytt.");
  }
  const project = { ...frozen.project, demoSnapshotId: frozen.snapshotId };
  return { project, board: adaptBoardData(transformToReportData(project)), snapshotId: frozen.snapshotId };
}
