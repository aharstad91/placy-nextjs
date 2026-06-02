#!/usr/bin/env node
/**
 * Konsistens-sjekk av den LÅSTE uttale-ordlista (scripts/tts/pronunciation-no.json).
 * Genererer N takes (default 5) per alias, i ordets bære-setning fra
 * pronunciation-candidates.json, på dagens prod-oppsett (Erik / turbo_v2_5 / no).
 * Brukes til å verifisere at en valgt omstaving holder HVER gang (stokastisitet),
 * og som regresjons-sjekk hvis vi senere endrer modell/voice.
 *
 * Kjør:  set -a; source .env.local; set +a; node scripts/tts/confirm-pronunciation.mjs [antall-takes]
 * Lytt:  open /tmp/tts-confirm
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const KEY = process.env.ELEVENLABS_API_KEY;
const OUT = "/tmp/tts-confirm";
mkdirSync(OUT, { recursive: true });
if (!KEY) { console.error("ELEVENLABS_API_KEY mangler (source .env.local)"); process.exit(1); }

const TAKES = Number(process.argv[2]) || 5;
const VOICE = "EpYEY8MWJrUGskHBoNMA", MODEL = "eleven_turbo_v2_5", LANG = "no";
const SETTINGS = { stability: 0.75, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true };

const { aliases } = JSON.parse(readFileSync(join(HERE, "pronunciation-no.json"), "utf8"));
const { tests } = JSON.parse(readFileSync(join(HERE, "pronunciation-candidates.json"), "utf8"));
const carrierFor = (word) => tests.find((t) => t.word.toLowerCase() === word.toLowerCase())?.carrier || "{W}";
const safe = (s) => s.replace(/[^a-zA-Z0-9æøåÆØÅ]+/g, "-");

async function gen(text, file) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`;
  const res = await fetch(url, { method: "POST", headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: MODEL, language_code: LANG, voice_settings: SETTINGS }) });
  if (!res.ok) return { ok: false, status: res.status };
  const j = await res.json();
  if (!j.audio_base64) return { ok: false };
  writeFileSync(file, Buffer.from(j.audio_base64, "base64"));
  return { ok: true };
}

for (const [word, alias] of Object.entries(aliases)) {
  const carrier = carrierFor(word);
  console.log(`\n### ${word} → "${alias}"   —  "${carrier}"`);
  for (let k = 1; k <= TAKES; k++) {
    const file = `${OUT}/${safe(word)}__${safe(alias)}_take${k}.mp3`;
    const r = await gen(carrier.replace("{W}", alias), file);
    console.log(r.ok ? `  ✓ take ${k}  → ${file}` : `  ✗ take ${k} (${r.status || "ERR"})`);
  }
}
console.log(`\nLytt: open ${OUT}  —  alle takes per ord bør være like bra (grønne).`);
