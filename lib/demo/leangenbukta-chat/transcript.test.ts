import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { issueTranscript, MAX_TOTAL_CHARS, MAX_TURNS, verifyTranscript, windowTurns, type TranscriptTurn } from "@/lib/demo/leangenbukta-chat/transcript";

describe("leangenbukta-chat/transcript", () => {
  beforeEach(() => {
    process.env.PLACY_LB_DEMO_COOKIE_SECRET = "a".repeat(32);
  });
  afterEach(() => {
    delete process.env.PLACY_LB_DEMO_COOKIE_SECRET;
  });

  it("bygger og verifiserer et token for samme besøkende, med talte turer merket", () => {
    const token = issueTranscript({
      visitorId: "visitor-1",
      snapshotId: "snap-1",
      previousTurns: [],
      newTurns: [
        { role: "user", text: "Hva er Leangenbukta?" },
        { role: "assistant", text: "Et boligområde mellom Lade og Leangen.", via: "voice" },
      ],
    });
    const verified = verifyTranscript(token, "visitor-1");
    expect(verified).toEqual({
      snapshotId: "snap-1",
      trimmed: false,
      turns: [
        { role: "user", text: "Hva er Leangenbukta?" },
        { role: "assistant", text: "Et boligområde mellom Lade og Leangen.", via: "voice" },
      ],
    });
  });

  it("holder et glidende vindu på antall turer og samlet lengde, og merker at eldre turer er borte", () => {
    let previousTurns: TranscriptTurn[] = [];
    let token = "";
    for (let i = 0; i < 30; i += 1) {
      token = issueTranscript({
        visitorId: "visitor-1",
        snapshotId: "snap-1",
        previousTurns,
        newTurns: [{ role: "user", text: `spørsmål ${i}` }, { role: "assistant", text: `svar ${i}` }],
      });
      previousTurns = verifyTranscript(token, "visitor-1")!.turns;
    }
    const byCount = verifyTranscript(token, "visitor-1")!;
    expect(byCount.turns).toHaveLength(MAX_TURNS);
    expect(byCount.turns.at(-1)).toEqual({ role: "assistant", text: "svar 29" });
    expect(byCount.trimmed).toBe(true);

    const long = Array.from({ length: 10 }, (_, i) => ({ role: "assistant" as const, text: `${i}`.padEnd(1900, "x") }));
    const byChars = windowTurns([], long);
    expect(byChars.turns.reduce((sum, turn) => sum + turn.text.length, 0)).toBeLessThanOrEqual(MAX_TOTAL_CHARS);
    expect(byChars.turns.at(-1)!.text.startsWith("9")).toBe(true);
    expect(byChars.trimmed).toBe(true);
    expect(windowTurns([], long.slice(0, 2)).trimmed).toBe(false);
  });

  it("avviser et token utstedt til en annen besøkende", () => {
    const token = issueTranscript({ visitorId: "visitor-1", snapshotId: "snap-1", previousTurns: [], newTurns: [{ role: "user", text: "a" }, { role: "assistant", text: "b" }] });
    expect(verifyTranscript(token, "visitor-2")).toBeNull();
  });

  it("avviser et forfalsket token", () => {
    const token = issueTranscript({ visitorId: "visitor-1", snapshotId: "snap-1", previousTurns: [], newTurns: [{ role: "user", text: "a" }, { role: "assistant", text: "b" }] });
    const [body] = token.split(".");
    const tampered = `${body}.forfalsket-signatur`;
    expect(verifyTranscript(tampered, "visitor-1")).toBeNull();
  });

  it("avviser ugyldig form og for langt token", () => {
    expect(verifyTranscript("ikke-et-token", "visitor-1")).toBeNull();
    expect(verifyTranscript(undefined, "visitor-1")).toBeNull();
    expect(verifyTranscript("a.".repeat(13000), "visitor-1")).toBeNull();
  });

  it("bruker en tilfeldig prosess-hemmelighet uten konfigurert secret, og skiller besøkende likt", () => {
    delete process.env.PLACY_LB_DEMO_COOKIE_SECRET;
    const token = issueTranscript({ visitorId: "visitor-1", snapshotId: "snap-1", previousTurns: [], newTurns: [{ role: "user", text: "a" }, { role: "assistant", text: "b" }] });
    expect(verifyTranscript(token, "visitor-1")).not.toBeNull();
    expect(verifyTranscript(token, "visitor-2")).toBeNull();
  });
});
