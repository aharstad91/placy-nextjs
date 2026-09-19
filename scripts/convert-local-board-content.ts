import { readFile, writeFile } from "node:fs/promises";

import { boardContentInputSchema } from "@/lib/admin/board-content";
import { buildLocalBoardContent } from "@/lib/pipeline/local-board-content";

function options() {
  const values = process.argv.slice(2);
  const value = (flag: string) => {
    const index = values.indexOf(flag);
    return index >= 0 ? values[index + 1] : undefined;
  };
  const boardPath = value("--board");
  const faqPath = value("--faq");
  const mappingsPath = value("--mappings");
  const optionsPath = value("--options");
  const outputPath = value("--output");
  if (!boardPath || !faqPath || !mappingsPath || !optionsPath || !outputPath) {
    throw new Error("--board, --faq, --mappings, --options og --output er påkrevd");
  }
  return { boardPath, faqPath, mappingsPath, optionsPath, outputPath, receiptPath: value("--receipt") };
}

async function json(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const args = options();
  const content = boardContentInputSchema.parse(buildLocalBoardContent(
    await json(args.boardPath),
    await json(args.faqPath),
    await json(args.mappingsPath),
    await json(args.optionsPath),
  ));
  await writeFile(args.outputPath, `${JSON.stringify(content, null, 2)}\n`);
  const faqCounts = Object.fromEntries(content.themes.map((theme) => [theme.id, theme.faq?.length ?? 0]));
  const receipt = {
    schemaVersion: 1,
    convertedAt: new Date().toISOString(),
    outputPath: args.outputPath,
    themeCount: content.themes.length,
    themeFaqCounts: faqCounts,
    globalFaqCount: content.globalFaq.length,
    totalFaqCount: Object.values(faqCounts).reduce((sum, count) => sum + count, 0) + content.globalFaq.length,
  };
  if (args.receiptPath) {
    await writeFile(args.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
