import { buildLeveProject, LEVE_CUSTOMER, LEVE_PROJECT } from "@/lib/demo/nyhavna-leve/build";
import { getProductAsync } from "@/lib/data-server";
import type { Project } from "@/lib/types";
import { getSchoolZone } from "@/lib/utils/school-zones";

import { writeNyhavnaSnapshot } from "@/lib/demo/nyhavna-leve/write-snapshot";

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
  process.stdout.write(`${JSON.stringify(await writeNyhavnaSnapshot(project), null, 2)}\n`);
}

void main();
