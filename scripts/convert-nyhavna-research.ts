import { readFile, writeFile } from "node:fs/promises";

import { buildAuditedPlacePackage } from "@/lib/pipeline/audited-place-package";
import { buildLocalTopicPackage } from "@/lib/pipeline/local-topic-package";
import {
  claimPublicationState,
  researchPackageHash,
  type ResearchPackage,
} from "@/lib/pipeline/research-package";

const ROOT = "docs/research/nyhavna-lokal-demo/audited";
const VALID_UNTIL = "2026-10-19";

async function json(path: string) {
  return JSON.parse(await readFile(path, "utf8"));
}

function receipt(researchPackage: ResearchPackage, outputPath: string) {
  const publicationStates = Object.groupBy(researchPackage.claims, (claim) =>
    claimPublicationState(claim, new Date("2026-09-19T12:00:00Z")),
  );
  return {
    schemaVersion: 1,
    packageId: researchPackage.packageId,
    packageHash: researchPackageHash(researchPackage),
    projectId: researchPackage.projectId,
    sourcePath: researchPackage.sourcePath,
    outputPath,
    entityCount: researchPackage.entities.length,
    claimCount: researchPackage.claims.length,
    mappedEntities: researchPackage.entities.filter((entity) => entity.mappingStatus === "mapped").length,
    unmappedEntities: researchPackage.entities.filter((entity) => entity.mappingStatus === "unmapped").length,
    publicationStateCounts: Object.fromEntries(
      Object.entries(publicationStates).map(([state, claims]) => [state, claims?.length ?? 0]),
    ),
    freshnessPolicy: `Migrated claims expire after ${VALID_UNTIL} unless revalidated.`,
  };
}

async function main() {
  const [places, topics, sources, mappings] = await Promise.all([
    json("data/demo/nyhavna-lokal/places.json"),
    json("data/demo/nyhavna-lokal/topics.json"),
    json("data/demo/nyhavna-lokal/sources.json"),
    json(`${ROOT}/2026-09-19-production-poi-mappings.json`),
  ]);
  const placePackage = buildAuditedPlacePackage({
    places,
    sources,
    categoryReviews: [],
    poiMappings: mappings,
  }, {
    packageId: "nyhavna-audited-places-2026-09-19",
    projectId: "nyhavna-utvikling_nyhavna",
    projectName: "Nyhavna",
    reviewedAt: "2026-09-19",
    scopeKey: "audited-places",
    sourcePath: "data/demo/nyhavna-lokal/places.json",
    timeSensitiveValidUntil: VALID_UNTIL,
    claimIdPrefix: "NYH-PLACE",
  });
  const topicPackage = buildLocalTopicPackage(topics, sources, {
    packageId: "nyhavna-audited-topics-2026-09-19",
    projectId: "nyhavna-utvikling_nyhavna",
    projectName: "Nyhavna",
    reviewedAt: "2026-09-19",
    scopeKey: "audited-topics",
    sourcePath: "data/demo/nyhavna-lokal/topics.json",
    validUntil: VALID_UNTIL,
    claimIdPrefix: "NYH-TOPIC",
  });
  const outputs = [
    {
      researchPackage: placePackage,
      output: `${ROOT}/2026-09-19-audited-places-ledger-package.json`,
      receipt: `${ROOT}/2026-09-19-audited-places-conversion-receipt.json`,
    },
    {
      researchPackage: topicPackage,
      output: `${ROOT}/2026-09-19-audited-topics-ledger-package.json`,
      receipt: `${ROOT}/2026-09-19-audited-topics-conversion-receipt.json`,
    },
  ];
  await Promise.all(outputs.flatMap((entry) => [
    writeFile(entry.output, `${JSON.stringify(entry.researchPackage, null, 2)}\n`),
    writeFile(entry.receipt, `${JSON.stringify(receipt(entry.researchPackage, entry.output), null, 2)}\n`),
  ]));
  process.stdout.write(`${JSON.stringify(outputs.map((entry) =>
    receipt(entry.researchPackage, entry.output)
  ), null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
