import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ELEVENLABS_VOICE,
  ELEVENLABS_VOICE_NAME,
  ELEVENLABS_MODEL,
  ELEVENLABS_LANGUAGE_CODE,
  ELEVENLABS_OUTPUT_FORMAT,
  ELEVENLABS_VOICE_SETTINGS,
} from "./elevenlabs-client";

/**
 * Regresjons-vakter for r14.1: den LÅSTE TTS-oppskriften (AC1) og
 * api-nøkkel-i-header-aldri-URL-kontrakten (AC2).
 *
 * Disse maskinifiserer AC-sjekkene som tidligere kun var manuelle (grep +
 * line-references). Oppskriften er bevisst frosset — enhver endring på et av
 * disse tallene krever `reportConfig.audioVersion`-bump for å re-generere alle
 * spor, og skal derfor tvinge denne testen til å feile først.
 */
describe("ElevenLabs locked recipe (AC1 — endring krever audioVersion-bump)", () => {
  it("Erik-stemmen er låst", () => {
    expect(ELEVENLABS_VOICE).toBe("EpYEY8MWJrUGskHBoNMA");
    expect(ELEVENLABS_VOICE_NAME).toBe("Erik");
  });

  it("modell + språk-kode er låst (turbo_v2_5 + 'no' — unngår svensk/dansk-fallback)", () => {
    expect(ELEVENLABS_MODEL).toBe("eleven_turbo_v2_5");
    expect(ELEVENLABS_LANGUAGE_CODE).toBe("no");
    expect(ELEVENLABS_OUTPUT_FORMAT).toBe("mp3_44100_128");
  });

  it("voice-settings er låst (stability 0.75)", () => {
    expect(ELEVENLABS_VOICE_SETTINGS).toEqual({
      stability: 0.75,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true,
    });
  });
});

describe("ElevenLabs key-in-header (AC2 — aldri i URL)", () => {
  // Source-nivå-vakt: les fila som tekst. Bruker process.cwd() (ikke
  // import.meta.url) så vakten er trygg uavhengig av test-environment (jsdom
  // gir ikke file:-URL for import.meta.url).
  const src = readFileSync(
    join(process.cwd(), "lib", "audio-tour", "elevenlabs-client.ts"),
    "utf8",
  );

  it("nøkkelen sendes i xi-api-key-header", () => {
    expect(src).toContain('"xi-api-key": params.apiKey');
  });

  it("ingen api-nøkkel i URL-querystring (mirrors `grep key=`-AC)", () => {
    // Samme grep som bead-AC2 krever tomt: kun `output_format=` skal stå i
    // URL-en, aldri `key=` / `api_key=` / `xi-api-key=`.
    expect(src).not.toMatch(/key=/);
  });
});
