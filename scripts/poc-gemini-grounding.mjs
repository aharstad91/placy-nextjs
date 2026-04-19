#!/usr/bin/env node
/**
 * POC: Gemini API grounding for generate-rapport Steg 2.5
 *
 * Henter readMoreQuery × 7 fra Supabase for et gitt prosjekt og kjører
 * Gemini API med google_search-tool for hver kategori.
 *
 * Usage: node scripts/poc-gemini-grounding.mjs <project_id>
 * Example: node scripts/poc-gemini-grounding.mjs banenor-eiendom_stasjonskvartalet
 */

import fs from "node:fs";

const API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!API_KEY) {
  console.error("GEMINI_API_KEY mangler. set -a && source .env.local && set +a");
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Supabase-env mangler.");
  process.exit(1);
}

const projectId = process.argv[2];
if (!projectId) {
  console.error("Usage: node scripts/poc-gemini-grounding.mjs <project_id>");
  process.exit(1);
}

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

async function fetchQueries(pid) {
  const url = `${SUPABASE_URL}/rest/v1/products?select=config&project_id=eq.${pid}&product_type=eq.report`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  const data = await res.json();
  if (!data.length) throw new Error(`No report product found for project_id=${pid}`);
  const themes = data[0].config?.reportConfig?.themes ?? [];
  return themes
    .filter((t) => t.readMoreQuery)
    .map((t) => ({ id: t.id, query: t.readMoreQuery }));
}

async function groundedQuery(query) {
  const body = {
    contents: [{ parts: [{ text: query }] }],
    tools: [{ google_search: {} }],
  };
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function renderResult(id, query, json) {
  const candidate = json.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text).join("") ?? "(intet svar)";
  const grounding = candidate?.groundingMetadata ?? {};
  const chunks = grounding.groundingChunks ?? [];
  const searchQueries = grounding.webSearchQueries ?? [];

  let out = `\n## ${id}\n\n**Query:** \`${query}\`\n\n`;
  if (searchQueries.length) {
    out += `**Gemini sine søk:**\n`;
    searchQueries.forEach((q) => (out += `- ${q}\n`));
    out += `\n`;
  }
  out += `**Svar:**\n\n${text}\n\n`;
  if (chunks.length) {
    out += `**Kilder (${chunks.length}):**\n`;
    chunks.forEach((c, i) => {
      const web = c.web;
      if (web) out += `${i + 1}. [${web.title ?? web.uri}](${web.uri})\n`;
    });
    out += `\n`;
  }
  out += `---\n`;
  return out;
}

async function main() {
  process.stderr.write(`Henter queries for ${projectId}...\n`);
  const queries = await fetchQueries(projectId);
  process.stderr.write(`Fant ${queries.length} kategorier.\n`);

  const out = [`# Gemini Grounding POC — ${projectId}\n`];
  out.push(`Modell: \`${MODEL}\`  \nKjørt: ${new Date().toISOString()}\n`);

  for (const { id, query } of queries) {
    process.stderr.write(`  [${id}] ${query}\n`);
    try {
      const json = await groundedQuery(query);
      out.push(renderResult(id, query, json));
      process.stderr.write(`    OK\n`);
    } catch (err) {
      out.push(`\n## ${id}\n\n**Query:** \`${query}\`\n\n**FEIL:** ${err.message}\n\n---\n`);
      process.stderr.write(`    FEILET: ${err.message}\n`);
    }
  }

  const outPath = `/tmp/gemini-poc-${projectId}.md`;
  fs.writeFileSync(outPath, out.join(""));
  process.stderr.write(`\nSkrevet til ${outPath}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
