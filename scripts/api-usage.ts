#!/usr/bin/env npx tsx
/**
 * Hva har vi brukt av betalte API-kall i dag?
 *
 * Usage:
 *   npx tsx scripts/api-usage.ts              # i dag
 *   npx tsx scripts/api-usage.ts 2026-08-14   # en bestemt dato
 *
 * Read-only. Regnskapet føres av `lib/api-budget.ts`, som belaster hvert kall
 * FØR det sendes — tallene her er derfor kall vi faktisk har gjort, ikke et
 * estimat i etterkant.
 */

import "./load-env";
import { forbruksrapport, idag, USD_PER_1000 } from "@/lib/api-budget";

const dato = process.argv[2] ?? idag();
const rader = forbruksrapport(dato);

console.log(`\n═══ Betalte API-kall ${dato} ═══\n`);
console.log(
  `  ${"SKU".padEnd(28)}${"brukt".padStart(7)}${"tak".padStart(7)}${"USD/1k".padStart(9)}${"est. USD".padStart(10)}`,
);
console.log(`  ${"─".repeat(61)}`);

let sumUsd = 0;
for (const rad of rader) {
  sumUsd += rad.usd;
  const nesten = rad.tak > 0 && rad.brukt / rad.tak >= 0.8;
  const merke = rad.brukt >= rad.tak && rad.brukt > 0 ? " ← TAK NÅDD" : nesten ? " ← nærmer seg" : "";
  console.log(
    `  ${rad.sku.padEnd(28)}${String(rad.brukt).padStart(7)}${String(rad.tak).padStart(7)}` +
      `${String(USD_PER_1000[rad.sku]).padStart(9)}${rad.usd.toFixed(2).padStart(10)}${merke}`,
  );
}

console.log(`  ${"─".repeat(61)}`);
console.log(`  ${"SUM".padEnd(28)}${" ".repeat(23)}${sumUsd.toFixed(2).padStart(10)} USD\n`);
console.log(`  Takene er døgnbaserte og gjelder alle scripts. Hev ett tak for én`);
console.log(`  kjøring med PLACY_CAP_<SKU>=<antall> — se lib/api-budget.ts.\n`);
