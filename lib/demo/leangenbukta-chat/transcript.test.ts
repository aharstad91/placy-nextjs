import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { issueTranscript, verifyTranscript, type TranscriptTurn } from "@/lib/demo/leangenbukta-chat/transcript";

describe("leangenbukta-chat/transcript", () => {
  beforeEach(() => {
    process.env.PLACY_LB_DEMO_COOKIE_SECRET = "a".repeat(32);
  });
  afterEach(() => {
    delete process.env.PLACY_LB_DEMO_COOKIE_SECRET;
  });

  it("bygger og verifiserer et token for samme besøkende", () => {
    const token = issueTranscript({
      visitorId: "visitor-1",
      snapshotId: "snap-1",
      previousTurns: [],
      userText: "Hva er Leangenbukta?",
      assistantText: "Et boligområde mellom Lade og Leangen.",
    });
    const verified = verifyTranscript(token, "visitor-1");
    expect(verified).not.toBeNull();
    expect(verified?.snapshotId).toBe("snap-1");
    expect(verified?.turns).toEqual([
      { role: "user", text: "Hva er Leangenbukta?" },
      { role: "assistant", text: "Et boligområde mellom Lade og Leangen." },
    ]);
  });

  it("klipper til de siste 6 turene", () => {
    let token: string | undefined;
    let previousTurns: TranscriptTurn[] = [];
    for (let i = 0; i < 5; i += 1) {
      token = issueTranscript({
        visitorId: "visitor-1",
        snapshotId: "snap-1",
        previousTurns,
        userText: `spørsmål ${i}`,
        assistantText: `svar ${i}`,
      });
      previousTurns = verifyTranscript(token, "visitor-1")!.turns;
    }
    const verified = verifyTranscript(token, "visitor-1");
    expect(verified?.turns).toHaveLength(6);
    expect(verified?.turns[0]).toEqual({ role: "user", text: "spørsmål 2" });
  });

  it("avviser et token utstedt til en annen besøkende", () => {
    const token = issueTranscript({ visitorId: "visitor-1", snapshotId: "snap-1", previousTurns: [], userText: "a", assistantText: "b" });
    expect(verifyTranscript(token, "visitor-2")).toBeNull();
  });

  it("avviser et forfalsket token", () => {
    const token = issueTranscript({ visitorId: "visitor-1", snapshotId: "snap-1", previousTurns: [], userText: "a", assistantText: "b" });
    const [body] = token.split(".");
    const tampered = `${body}.forfalsket-signatur`;
    expect(verifyTranscript(tampered, "visitor-1")).toBeNull();
  });

  it("avviser ugyldig form og for langt token", () => {
    expect(verifyTranscript("ikke-et-token", "visitor-1")).toBeNull();
    expect(verifyTranscript(undefined, "visitor-1")).toBeNull();
    expect(verifyTranscript("a.".repeat(5000), "visitor-1")).toBeNull();
  });

  it("bruker en tilfeldig prosess-hemmelighet uten konfigurert secret, og skiller besøkende likt", () => {
    delete process.env.PLACY_LB_DEMO_COOKIE_SECRET;
    const token = issueTranscript({ visitorId: "visitor-1", snapshotId: "snap-1", previousTurns: [], userText: "a", assistantText: "b" });
    expect(verifyTranscript(token, "visitor-1")).not.toBeNull();
    expect(verifyTranscript(token, "visitor-2")).toBeNull();
  });
});
