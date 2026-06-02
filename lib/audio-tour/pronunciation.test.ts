import { describe, it, expect } from "vitest";
import {
  applyPronunciation,
  remapTimingsToOriginal,
} from "./pronunciation";
import { mapCharTimingsToWords } from "@/components/variants/report/board/audio-tour/karaoke-tokens";

/** Syntetisk ElevenLabs-alignment for en tekst: hvert tegn får 0.1s. */
function fakeAlignment(ttsText: string) {
  const characters = ttsText.split("");
  const starts = characters.map((_, i) => i / 10);
  const ends = characters.map((_, i) => (i + 1) / 10);
  return { characters, starts, ends };
}

describe("applyPronunciation", () => {
  it("ingen aliaser → uendret tekst, changed=false", () => {
    const r = applyPronunciation("Du leier kajakk her.", {});
    expect(r.ttsText).toBe("Du leier kajakk her.");
    expect(r.changed).toBe(false);
  });

  it("ingen treff → uendret, changed=false", () => {
    const r = applyPronunciation("En helt vanlig setning.", { kajakk: "kaják" });
    expect(r.changed).toBe(false);
    expect(r.ttsText).toBe("En helt vanlig setning.");
  });

  it("bytter helt ord (kortere alias)", () => {
    const r = applyPronunciation("Du leier kajakk her.", { kajakk: "kaják" });
    expect(r.ttsText).toBe("Du leier kaják her.");
    expect(r.changed).toBe(true);
  });

  it("bytter helt ord (lengre alias) + bevarer stor forbokstav", () => {
    const r = applyPronunciation("Kajakk langs Nidelva.", { kajakk: "kaják", Nidelva: "Nid-elva" });
    expect(r.ttsText).toBe("Kaják langs Nid-elva."); // setningsstart → stor K
    expect(r.changed).toBe(true);
  });

  it("matcher hele ord, ikke delstrenger", () => {
    const r = applyPronunciation("kajakker og kajakk", { kajakk: "kaják" });
    // "kajakker" skal IKKE byttes; "kajakk" skal byttes
    expect(r.ttsText).toBe("kajakker og kaják");
  });
});

describe("remapTimingsToOriginal", () => {
  it("remapper kortere alias tilbake til original-tekst, riktig lengde + spans", () => {
    const text = "Du leier kajakk her.";
    const { ttsText, segments } = applyPronunciation(text, { kajakk: "kaják" });
    const { characters, starts, ends } = fakeAlignment(ttsText);

    const out = remapTimingsToOriginal(text, ttsText, characters, starts, ends, segments);
    expect(out).not.toBeNull();
    if (!out) return;

    // Karaoke krever lik lengde på alle tre + characters === original-tekst
    expect(out.characters.join("")).toBe(text);
    expect(out.characters.length).toBe(text.length);
    expect(out.characterStartTimesSeconds.length).toBe(text.length);
    expect(out.characterEndTimesSeconds.length).toBe(text.length);

    // Prefiks (uendret) kopieres 1:1
    expect(out.characterStartTimesSeconds[0]).toBeCloseTo(0);

    // "kajakk" starter på index 9; alias-spanet er tts 9..13 (kaják) =
    // start 0.9, slutt 1.4. Original-ordets første/siste tegn skal arve spanet.
    expect(out.characterStartTimesSeconds[9]).toBeCloseTo(0.9);
    expect(out.characterEndTimesSeconds[14]).toBeCloseTo(1.4); // 6. tegn i "kajakk"
  });

  it("guard: alignment som ikke matcher TTS-tekst → null (fallback)", () => {
    const text = "Du leier kajakk her.";
    const { ttsText, segments } = applyPronunciation(text, { kajakk: "kaják" });
    // Feil alignment (for original-teksten, ikke ttsText) → lengde/innhold avviker
    const wrong = fakeAlignment(text);
    const out = remapTimingsToOriginal(text, ttsText, wrong.characters, wrong.starts, wrong.ends, segments);
    expect(out).toBeNull();
  });

  it("karaoke-tokenizer gjenkjenner original-ordet med alias-ens tidsspan", () => {
    const text = "Tur langs Nidelva her.";
    const { ttsText, segments } = applyPronunciation(text, { Nidelva: "Nid-elva" });
    const { characters, starts, ends } = fakeAlignment(ttsText);
    const out = remapTimingsToOriginal(text, ttsText, characters, starts, ends, segments)!;

    const tokens = mapCharTimingsToWords({
      characters: out.characters,
      characterStartTimesSeconds: out.characterStartTimesSeconds,
      characterEndTimesSeconds: out.characterEndTimesSeconds,
    });
    const words = tokens.map((t) => t.text);
    expect(words).toContain("Nidelva"); // vist staving = original, ikke "Nid-elva"
    const tok = tokens.find((t) => t.text === "Nidelva")!;
    expect(tok.endMs).toBeGreaterThan(tok.startMs); // gyldig tidsspan
  });
});
