import { readFile, writeFile } from "node:fs/promises";

import { buildAuditedTopicPackage } from "@/lib/pipeline/audited-topic-package";
import {
  claimPublicationState,
  researchPackageHash,
} from "@/lib/pipeline/research-package";

const CATEGORIES = [
  "hverdag",
  "natur",
  "opplevelser",
  "oppvekst",
  "servering",
  "transport",
  "trening",
];
const SOURCE_PATH =
  "docs/research/leangenbukta-lokal-demo/categories/*.json";
const OUTPUT_PATH =
  "docs/research/leangenbukta-lokal-demo/audited/2026-09-19-audited-topics-ledger-package.json";
const RECEIPT_PATH =
  "docs/research/leangenbukta-lokal-demo/audited/2026-09-19-audited-topics-conversion-receipt.json";

async function json(path: string) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const researchPackage = buildAuditedTopicPackage(
    await Promise.all(
      CATEGORIES.map((category) =>
        json(
          `docs/research/leangenbukta-lokal-demo/categories/${category}.json`,
        ),
      ),
    ),
    {
      packageId: "leangenbukta-audited-topics-2026-09-19",
      projectId: "placy-demo_leangenbukta",
      projectName: "Leangenbukta",
      reviewedAt: "2026-09-18",
      scopeKey: "audited-topics",
      sourcePath: SOURCE_PATH,
      timeSensitiveValidUntil: "2026-09-25",
    },
  );
  const publicationStates = Object.groupBy(
    researchPackage.claims,
    (claim) => claimPublicationState(claim, new Date("2026-09-19T12:00:00Z")),
  );
  const receipt = {
    schemaVersion: 1,
    packageId: researchPackage.packageId,
    packageHash: researchPackageHash(researchPackage),
    projectId: researchPackage.projectId,
    sourcePath: SOURCE_PATH,
    outputPath: OUTPUT_PATH,
    entityCount: researchPackage.entities.length,
    claimCount: researchPackage.claims.length,
    publicationStateCounts: Object.fromEntries(
      Object.entries(publicationStates).map(([state, claims]) => [
        state,
        claims?.length ?? 0,
      ]),
    ),
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
