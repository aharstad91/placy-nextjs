import { readFile, writeFile } from "node:fs/promises";

import { createServerClient } from "@/lib/supabase/client";
import {
  claimPublicationState,
  parseResearchPackage,
  researchPackageHash,
} from "@/lib/pipeline/research-package";

interface Options {
  packagePath: string;
  receiptPath: string | null;
  requiredPoiIds: string[];
}

function options(): Options {
  const values = process.argv.slice(2);
  const value = (flag: string) => {
    const index = values.indexOf(flag);
    return index >= 0 ? values[index + 1] ?? null : null;
  };
  const packagePath = value("--package");
  if (!packagePath) throw new Error("--package <fil> er påkrevd");
  return {
    packagePath,
    receiptPath: value("--receipt"),
    requiredPoiIds: values.flatMap((value, index) =>
      value === "--required-poi" && values[index + 1]
        ? [values[index + 1]!]
        : [],
    ),
  };
}

async function allRows<T>(
  query: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

async function main() {
  const args = options();
  const researchPackage = parseResearchPackage(
    JSON.parse(await readFile(args.packagePath, "utf8")),
  );
  const packageHash = researchPackageHash(researchPackage);
  const db = createServerClient().schema("v2");
  const [claims, projectPois, packageResult] = await Promise.all([
    allRows((from, to) => db
      .from("research_claims")
      .select("claim_id,package_hash,publication_eligible,superseded_at,mapped_poi_id")
      .eq("project_id", researchPackage.projectId)
      .eq("scope_key", researchPackage.scopeKey)
      .order("claim_id")
      .range(from, to)),
    allRows((from, to) => db
      .from("project_pois")
      .select("poi_id")
      .eq("project_id", researchPackage.projectId)
      .order("poi_id")
      .range(from, to)),
    db
      .from("research_packages")
      .select("package_hash,package_id,imported_at")
      .eq("package_hash", packageHash)
      .maybeSingle(),
  ]);
  if (packageResult.error) throw new Error(packageResult.error.message);
  if (!packageResult.data) throw new Error(`Pakken ${packageHash} finnes ikke i ledgeren`);

  const expectedClaims = new Map(
    researchPackage.claims.map((claim) => [claim.claimId, claim]),
  );
  const currentClaims = claims.filter((claim) => claim.superseded_at === null);
  const currentById = new Map(currentClaims.map((claim) => [claim.claim_id, claim]));
  const missingClaims = [...expectedClaims.keys()].filter((id) => !currentById.has(id));
  const wrongPackageClaims = currentClaims
    .filter((claim) => claim.package_hash !== packageHash)
    .map((claim) => claim.claim_id);
  const eligibleExpected = researchPackage.claims.filter((claim) =>
    claimPublicationState(claim, new Date()) === "publishable",
  );
  const eligibleActual = currentClaims.filter((claim) => claim.publication_eligible);
  const poolIds = new Set(projectPois.map((row) => row.poi_id));
  const mappedIds = new Set(
    researchPackage.entities.flatMap((entity) => entity.poiId ? [entity.poiId] : []),
  );
  const missingMappedPois = [...mappedIds].filter((id) => !poolIds.has(id));
  const missingRequiredPois = args.requiredPoiIds.filter((id) => !poolIds.has(id));

  const receipt = {
    schemaVersion: 1,
    verifiedAt: new Date().toISOString(),
    packagePath: args.packagePath,
    packageHash,
    packageId: researchPackage.packageId,
    projectId: researchPackage.projectId,
    scopeKey: researchPackage.scopeKey,
    expectedClaims: researchPackage.claims.length,
    currentClaims: currentClaims.length,
    expectedPublishable: eligibleExpected.length,
    actualPublicationEligible: eligibleActual.length,
    mappedEntities: mappedIds.size,
    projectPoolPois: projectPois.length,
    missingClaims,
    wrongPackageClaims,
    missingMappedPois,
    missingRequiredPois,
    passed:
      currentClaims.length === researchPackage.claims.length &&
      eligibleActual.length === eligibleExpected.length &&
      missingClaims.length === 0 &&
      wrongPackageClaims.length === 0 &&
      missingMappedPois.length === 0 &&
      missingRequiredPois.length === 0,
  };
  if (args.receiptPath) {
    await writeFile(args.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (!receipt.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
