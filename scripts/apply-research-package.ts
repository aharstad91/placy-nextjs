import { readFile, writeFile } from "node:fs/promises";

import { applyResearchPackage } from "@/lib/pipeline/apply-research-package";
import {
  claimPublicationState,
  parseResearchPackage,
  researchPackageHash,
} from "@/lib/pipeline/research-package";

interface Options {
  packagePath: string;
  receiptPath: string | null;
  write: boolean;
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
    write: values.includes("--write"),
  };
}

async function main() {
  const args = options();
  const input = JSON.parse(await readFile(args.packagePath, "utf8"));
  const researchPackage = parseResearchPackage(input);
  const publicationStates = Object.groupBy(researchPackage.claims, (claim) =>
    claimPublicationState(claim, new Date()),
  );
  const preview = {
    packageId: researchPackage.packageId,
    packageHash: researchPackageHash(researchPackage),
    projectId: researchPackage.projectId,
    mode: researchPackage.mode,
    scopeKey: researchPackage.scopeKey,
    entities: researchPackage.entities.length,
    claims: researchPackage.claims.length,
    publicationStates: Object.fromEntries(
      Object.entries(publicationStates).map(([state, claims]) => [
        state,
        claims?.length ?? 0,
      ]),
    ),
  };

  if (!args.write) {
    process.stdout.write(`${JSON.stringify({ status: "dry_run", ...preview }, null, 2)}\n`);
    return;
  }

  const result = await applyResearchPackage(researchPackage);
  const receipt = {
    schemaVersion: 1,
    appliedAt: new Date().toISOString(),
    packagePath: args.packagePath,
    ...preview,
    import: result,
  };
  if (args.receiptPath) {
    await writeFile(
      args.receiptPath,
      `${JSON.stringify(receipt, null, 2)}\n`,
    );
  }
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
