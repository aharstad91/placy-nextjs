#!/usr/bin/env node
/**
 * Tuning-harness for norsk uttale i ElevenLabs (voice Erik, dagens prod-oppsett:
 * eleven_turbo_v2_5 + language_code "no"). Genererer ett lydklipp per
 * omstavings-kandidat i scripts/tts/pronunciation-candidates.json, i en naturlig
 * bære-setning, så man kan HØRE hvilken staving Erik uttaler best.
 *
 * Kjør:  set -a; source .env.local; set +a; node scripts/tts/tune-pronunciation.mjs
 * Lytt:  open /tmp/tts-tune   (klipp grupperes per ord)
 *
 * Når en vinner er valgt: legg "ord": "vinner-staving" i scripts/tts/pronunciation-no.json.
 * NB: kun TTS-input omstaves — vist manus/karaoke beholder original staving.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const KEY = process.env.ELEVENLABS_API_KEY;
const OUT = "/tmp/tts-tune";
mkdirSync(OUT, { recursive: true });

if (!KEY) { console.error("ELEVENLABS_API_KEY mangler (source .env.local først)"); process.exit(1); }

// Dagens prod-oppsett — holdes konstant så vi kun tester staving, ikke modell/stemme.
const VOICE = "EpYEY8MWJrUGskHBoNMA"; // Erik
const MODEL = "eleven_turbo_v2_5";
const LANG = "no";
const SETTINGS = { stability: 0.75, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true };

const { tests } = JSON.parse(readFileSync(join(HERE, "pronunciation-candidates.json"), "utf8"));
const safe = (s) => s.replace(/[^a-zA-Z0-9æøåÆØÅ]+/g, "-");

// Valgfrie argumenter: [ord-filter] [antall-takes]. Eks: node ... kajakk 2
const WORD_FILTER = process.argv[2];
const TAKES = Number(process.argv[3]) || 1;
const selected = WORD_FILTER
  ? tests.filter((t) => t.word.toLowerCase() === WORD_FILTER.toLowerCase())
  : tests;

async function gen(text, file) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: MODEL, language_code: LANG, voice_settings: SETTINGS }),
  });
  if (!res.ok) return { ok: false, status: res.status, err: (await res.text()).slice(0, 160) };
  const j = await res.json();
  if (!j.audio_base64) return { ok: false, err: "no audio" };
  writeFileSync(file, Buffer.from(j.audio_base64, "base64"));
  return { ok: true };
}

for (const t of selected) {
  console.log(`\n### ${t.word}  —  "${t.carrier}"`);
  for (let i = 0; i < t.candidates.length; i++) {
    const cand = t.candidates[i];
    const text = t.carrier.replace("{W}", cand);
    for (let k = 1; k <= TAKES; k++) {
      const suffix = TAKES > 1 ? `_take${k}` : "";
      const file = `${OUT}/${safe(t.word)}__${i}_${safe(cand)}${suffix}.mp3`;
      const r = await gen(text, file);
      const tag = (i === 0 ? " (original)" : "") + (TAKES > 1 ? ` take ${k}` : "");
      console.log(r.ok ? `  ✓ "${cand}"${tag}  → ${file}` : `  ✗ "${cand}"${tag}  (${r.status || "ERR"}) ${r.err}`);
    }
  }
}
console.log(`\nLytt: open ${OUT}`);
