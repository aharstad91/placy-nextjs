import { readFile, writeFile } from "node:fs/promises";

import { convertLegacyResearchPackage } from "@/lib/pipeline/legacy-research-package";
import {
  claimPublicationState,
  researchPackageHash,
} from "@/lib/pipeline/research-package";

const SOURCE_PATH =
  "docs/research/leangenbukta-lokal-demo/audited/2026-09-18-project-facts-package.json";
const OUTPUT_PATH =
  "docs/research/leangenbukta-lokal-demo/audited/2026-09-18-ledger-package.json";
const RECEIPT_PATH =
  "docs/research/leangenbukta-lokal-demo/audited/2026-09-18-ledger-conversion-receipt.json";

async function main() {
  const input = JSON.parse(await readFile(SOURCE_PATH, "utf8"));
  const researchPackage = convertLegacyResearchPackage(input, {
    packageId: "leangenbukta-project-facts-2026-09-18",
    projectId: "placy-demo_leangenbukta",
    projectName: "Leangenbukta",
    reviewedAt: "2026-09-18",
    scopeKey: "project-facts",
    sourcePath: SOURCE_PATH,
  });
  const publicationStates = Object.groupBy(researchPackage.claims, (claim) =>
    claimPublicationState(claim, new Date("2026-09-19T12:00:00Z")),
  );
  const reviewStatuses = Object.groupBy(
    researchPackage.claims,
    (claim) => claim.reviewStatus,
  );
  const receipt = {
    schemaVersion: 1,
    packageId: researchPackage.packageId,
    packageHash: researchPackageHash(researchPackage),
    projectId: researchPackage.projectId,
    sourcePath: SOURCE_PATH,
    outputPath: OUTPUT_PATH,
    reviewedAt: researchPackage.reviewedAt,
    entityCount: researchPackage.entities.length,
    claimCount: researchPackage.claims.length,
    reviewStatusCounts: Object.fromEntries(
      Object.entries(reviewStatuses).map(([status, claims]) => [status, claims?.length ?? 0]),
    ),
    publicationStateCounts: Object.fromEntries(
      Object.entries(publicationStates).map(([status, claims]) => [status, claims?.length ?? 0]),
    ),
    mappingPolicy: "No POI mapping without an authoritative identifier in the audited package.",
  };

  await Promise.all([
    writeFile(OUTPUT_PATH, `${JSON.stringify(researchPackage, null, 2)}\n`),
    writeFile(RECEIPT_PATH, `${JSON.stringify(receipt, null, 2)}\n`),
  ]);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
