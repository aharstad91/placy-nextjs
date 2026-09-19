import { readFile, writeFile } from "node:fs/promises";

import { finalizePlaceMappings } from "@/lib/pipeline/finalize-place-mappings";

function options() {
  const values = process.argv.slice(2);
  const value = (flag: string) => {
    const index = values.indexOf(flag);
    return index >= 0 ? values[index + 1] : undefined;
  };
  const reviewPath = value("--review");
  const overridesPath = value("--overrides");
  const mappingsPath = value("--mappings-output");
  const receiptPath = value("--receipt-output");
  if (!reviewPath || !overridesPath || !mappingsPath || !receiptPath) {
    throw new Error("--review, --overrides, --mappings-output og --receipt-output er påkrevd");
  }
  return { reviewPath, overridesPath, mappingsPath, receiptPath };
}

async function main() {
  const args = options();
  const [review, overrides] = await Promise.all([
    readFile(args.reviewPath, "utf8").then(JSON.parse),
    readFile(args.overridesPath, "utf8").then(JSON.parse),
  ]);
  const result = finalizePlaceMappings(review, overrides);
  await Promise.all([
    writeFile(args.mappingsPath, `${JSON.stringify(result.mappings, null, 2)}\n`),
    writeFile(args.receiptPath, `${JSON.stringify(result.receipt, null, 2)}\n`),
  ]);
  process.stdout.write(`${JSON.stringify({
    mappingsPath: args.mappingsPath,
    receiptPath: args.receiptPath,
    totalPlaces: result.receipt.totalPlaces,
    ...result.receipt.counts,
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
