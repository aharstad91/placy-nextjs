/**
 * Azure Speech Service Norsk-stemme-validering.
 *
 * ElevenLabs ga inkonsistent norsk uttale (svensk/dansk-fallback,
 * problemord som "Brattørkaia"/"Munkegata" feilet). Azure TTS har
 * native nb-NO Neural-stemmer trent fra grunnen av på norsk —
 * vi tester om de leverer konsistent kvalitet på samme Hjem-manus.
 *
 * Kjøres: npx tsx scripts/azure-norsk-validation.ts
 */

import { config } from "dotenv";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

const KEY = process.env.AZURE_SPEECH_KEY;
const REGION = process.env.AZURE_SPEECH_REGION;
if (!KEY || !REGION) {
  console.error(
    "[fail] AZURE_SPEECH_KEY eller AZURE_SPEECH_REGION mangler i .env.local",
  );
  process.exit(1);
}

const MANUS_PATH = resolve(
  process.cwd(),
  ".audio-staging/banenor-eiendom_stasjonskvartalet/home.manus.md",
);
const PITCH_TEXT = readFileSync(MANUS_PATH, "utf8").trim();

const VOICES = [
  { name: "pernille", id: "nb-NO-PernilleNeural", description: "Default kvinne, varm" },
  { name: "iselin", id: "nb-NO-IselinNeural", description: "Kvinne, profesjonell" },
  { name: "finn", id: "nb-NO-FinnNeural", description: "Mann, voksen" },
  { name: "isak", id: "nb-NO-IsakNeural", description: "Mann, ung/energisk" },
  { name: "sofie", id: "nb-NO-SofieNeural", description: "Kvinne, multilingual" },
];

const ENDPOINT = `https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

function buildSsml(voiceId: string, text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<speak version="1.0" xml:lang="nb-NO"><voice name="${voiceId}">${escaped}</voice></speak>`;
}

async function generateVoice(
  voice: (typeof VOICES)[number],
  outDir: string,
) {
  const ssml = buildSsml(voice.id, PITCH_TEXT);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": KEY!,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-160kbitrate-mono-mp3",
      "User-Agent": "placy-tts-validation",
    },
    body: ssml,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `[${voice.name}] Azure ${res.status}: ${body.slice(0, 300)}`,
    );
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const outPath = resolve(outDir, `${voice.name}.mp3`);
  writeFileSync(outPath, buf);
  return { path: outPath, bytes: buf.length };
}

async function main() {
  const outDir = resolve(process.cwd(), "tmp/azure-norsk-validation");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  console.log("[info] Faktisk Hjem-manus for StasjonsKvartalet:");
  console.log(`  "${PITCH_TEXT.slice(0, 140)}..."`);
  console.log();
  console.log(`[info] Region:   ${REGION}`);
  console.log(`[info] Lagring:  ${outDir}/`);
  console.log();

  for (const voice of VOICES) {
    process.stdout.write(`[gen] ${voice.name.padEnd(12)} (${voice.description}) ... `);
    try {
      const { bytes } = await generateVoice(voice, outDir);
      console.log(`✓ ${(bytes / 1024).toFixed(0)} KB`);
    } catch (err) {
      console.log(`✗ ${(err as Error).message}`);
    }
  }

  console.log();
  console.log("[done] Lytt og sammenlign med Mia Starset (ElevenLabs):");
  console.log(`  open ${outDir}`);
  console.log();
  console.log("Kritiske ord å verifisere:");
  console.log("  - StasjonsKvartalet, Brattørkaia, TMV-kaia, Munkegata, Midtbyen, Trondheim");
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
