import { createHmac } from "node:crypto";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { issueTranscript, MAX_TOTAL_CHARS, MAX_TURNS, verifyTranscript, windowTurns, type TranscriptScope, type TranscriptTurn } from "@/lib/demo/site-chat/transcript";

const SCOPE: TranscriptScope = { customerId: "kunde-a", dataset: "kunde-a-lokal", secretEnv: "TEST_KUNDE_A_SECRET" };
const OTHER: TranscriptScope = { customerId: "kunde-b", dataset: "kunde-b-lokal", secretEnv: "TEST_KUNDE_B_SECRET" };

describe("site-chat/transcript", () => {
  beforeEach(() => {
    vi.stubEnv("TEST_KUNDE_A_SECRET", "a".repeat(32));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("bygger og verifiserer et token for samme besøkende, med talte turer merket", () => {
    const token = issueTranscript({
      scope: SCOPE,
      visitorId: "visitor-1",
      snapshotId: "snap-1",
      previousTurns: [],
      newTurns: [
        { role: "user", text: "Hva er Leangenbukta?" },
        { role: "assistant", text: "Et boligområde mellom Lade og Leangen.", via: "voice" },
      ],
    });
    const verified = verifyTranscript(token, "visitor-1", SCOPE);
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
      scope: SCOPE,
        visitorId: "visitor-1",
        snapshotId: "snap-1",
        previousTurns,
        newTurns: [{ role: "user", text: `spørsmål ${i}` }, { role: "assistant", text: `svar ${i}` }],
      });
      previousTurns = verifyTranscript(token, "visitor-1", SCOPE)!.turns;
    }
    const byCount = verifyTranscript(token, "visitor-1", SCOPE)!;
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
    const token = issueTranscript({ scope: SCOPE, visitorId: "visitor-1", snapshotId: "snap-1", previousTurns: [], newTurns: [{ role: "user", text: "a" }, { role: "assistant", text: "b" }] });
    expect(verifyTranscript(token, "visitor-2", SCOPE)).toBeNull();
  });

  it("avviser et forfalsket token", () => {
    const token = issueTranscript({ scope: SCOPE, visitorId: "visitor-1", snapshotId: "snap-1", previousTurns: [], newTurns: [{ role: "user", text: "a" }, { role: "assistant", text: "b" }] });
    const [body] = token.split(".");
    const tampered = `${body}.forfalsket-signatur`;
    expect(verifyTranscript(tampered, "visitor-1", SCOPE)).toBeNull();
  });

  it("avviser ugyldig form og for langt token", () => {
    expect(verifyTranscript("ikke-et-token", "visitor-1", SCOPE)).toBeNull();
    expect(verifyTranscript(undefined, "visitor-1", SCOPE)).toBeNull();
    expect(verifyTranscript("a.".repeat(13000), "visitor-1", SCOPE)).toBeNull();
  });

  it("bruker en tilfeldig prosess-hemmelighet uten konfigurert secret, og skiller besøkende likt", () => {
    delete process.env.PLACY_LB_DEMO_COOKIE_SECRET;
    const token = issueTranscript({ scope: SCOPE, visitorId: "visitor-1", snapshotId: "snap-1", previousTurns: [], newTurns: [{ role: "user", text: "a" }, { role: "assistant", text: "b" }] });
    expect(verifyTranscript(token, "visitor-1", SCOPE)).not.toBeNull();
    expect(verifyTranscript(token, "visitor-2", SCOPE)).toBeNull();
  });

  describe("kundens omfang (2026-09-24)", () => {
    const turns: TranscriptTurn[] = [{ role: "user", text: "Hei" }, { role: "assistant", text: "Hei! Hva lurer du på?" }];
    const issue = (scope: TranscriptScope) => issueTranscript({ scope, visitorId: "visitor-1", snapshotId: "snap-1", previousTurns: [], newTurns: turns });

    it("bruker hver kundes egen nøkkel når begge er satt, og kundens nøkkel endrer seg ikke av den andres", () => {
      vi.stubEnv("TEST_KUNDE_B_SECRET", "b".repeat(32));
      const a = issue(SCOPE);
      const b = issue(OTHER);
      expect(verifyTranscript(a, "visitor-1", SCOPE)?.turns).toEqual(turns);
      expect(verifyTranscript(b, "visitor-1", OTHER)?.turns).toEqual(turns);
      // Kunde A sin nøkkel roteres: A sine tokens dør, B sine lever videre.
      vi.stubEnv("TEST_KUNDE_A_SECRET", "c".repeat(32));
      expect(verifyTranscript(a, "visitor-1", SCOPE)).toBeNull();
      expect(verifyTranscript(b, "visitor-1", OTHER)?.turns).toEqual(turns);
    });

    it("avviser gjenbruk hos en annen kunde, også med samme hemmelighet og samme besøkende", () => {
      vi.stubEnv("TEST_KUNDE_B_SECRET", "a".repeat(32));
      const a = issue(SCOPE);
      expect(verifyTranscript(a, "visitor-1", OTHER)).toBeNull();
      // Samme kunde, annet datasett: også avvist.
      expect(verifyTranscript(a, "visitor-1", { ...SCOPE, dataset: "annet-datasett" })).toBeNull();
      // Selv om nøkkelen skulle lekke mellom kundene, bærer payloaden kunden.
      const [body] = a.split(".");
      const payload = JSON.parse(Buffer.from(body, "base64url").toString());
      expect(payload).toMatchObject({ v: 2, c: "kunde-a", d: "kunde-a-lokal" });
    });

    it("godtar ikke lenger et v1-token signert med den rå nøkkelen (bevisst overgang: ingen historikk)", () => {
      const body = Buffer.from(JSON.stringify({ v: 1, visitorId: "visitor-1", snapshotId: "snap-1", turns })).toString("base64url");
      const legacy = `${body}.${createHmac("sha256", "a".repeat(32)).update(body).digest("base64url")}`;
      expect(verifyTranscript(legacy, "visitor-1", SCOPE)).toBeNull();
    });
  });
});
