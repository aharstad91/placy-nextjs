#!/usr/bin/env node
// Skriver ut innsikts-lenken for et prosjekt-board.
//   node scripts/insight-link.mjs broset-utvikling-as wesselslokka [--demo] [--base https://placy.no]
// Leser INSIGHT_REPORT_SECRET fra .env.local (eller miljøet).
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const [customer, slug, ...flags] = process.argv.slice(2);
if (!customer || !slug) {
  console.error("bruk: node scripts/insight-link.mjs <customer> <slug> [--demo] [--base URL]");
  process.exit(1);
}
let secret = process.env.INSIGHT_REPORT_SECRET;
if (!secret) {
  try {
    const m = readFileSync(".env.local", "utf8").match(/^INSIGHT_REPORT_SECRET=(.+)$/m);
    secret = m?.[1]?.trim();
  } catch {}
}
if (!secret) {
  console.error("INSIGHT_REPORT_SECRET mangler");
  process.exit(1);
}
const baseIdx = flags.indexOf("--base");
const base = baseIdx >= 0 ? flags[baseIdx + 1] : "http://localhost:3000";
const token = createHmac("sha256", secret).update(`${customer}_${slug}`).digest("hex").slice(0, 24);
const demo = flags.includes("--demo") ? "&demo=1" : "";
console.log(`${base}/eiendom/${customer}/${slug}/innsikt?t=${token}${demo}`);
