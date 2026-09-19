import { readFile, writeFile } from "node:fs/promises";

import { buildAuditedPlacePackage } from "@/lib/pipeline/audited-place-package";
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
const SOURCE_PATH = "data/demo/leangenbukta-lokal/places-audited.json";
const OUTPUT_PATH =
  "docs/research/leangenbukta-lokal-demo/audited/2026-09-18-audited-places-ledger-package.json";
const RECEIPT_PATH =
  "docs/research/leangenbukta-lokal-demo/audited/2026-09-18-audited-places-conversion-receipt.json";

async function json(path: string) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const researchPackage = buildAuditedPlacePackage({
    places: await json(SOURCE_PATH),
    sources: await json("data/demo/leangenbukta-lokal/sources.json"),
    categoryReviews: await Promise.all(CATEGORIES.map((category) =>
      json(`docs/research/leangenbukta-lokal-demo/categories/${category}.json`),
    )),
    poiMappings: await json(
      "docs/research/leangenbukta-lokal-demo/audited/2026-09-18-production-poi-mappings.json",
    ),
  }, {
    packageId: "leangenbukta-audited-places-2026-09-18-r2",
    projectId: "placy-demo_leangenbukta",
    projectName: "Leangenbukta",
    reviewedAt: "2026-09-18",
    scopeKey: "audited-places",
    sourcePath: SOURCE_PATH,
    timeSensitiveValidUntil: "2026-09-25",
  });
  const publicationStates = Object.groupBy(researchPackage.claims, (claim) =>
    claimPublicationState(claim, new Date("2026-09-19T12:00:00Z")),
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
    mappedEntities: researchPackage.entities.filter((entity) => entity.mappingStatus === "mapped").length,
    unmappedEntities: researchPackage.entities.filter((entity) => entity.mappingStatus === "unmapped").length,
    publicationStateCounts: Object.fromEntries(
      Object.entries(publicationStates).map(([state, claims]) => [state, claims?.length ?? 0]),
    ),
    freshnessPolicy: "Facts marked refresh-required expire after 2026-09-25 unless revalidated.",
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
