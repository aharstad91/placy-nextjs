import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { startVoiceHandoff } from "@/lib/demo/site-chat/voice-handoff";
import { verifyTranscript } from "@/lib/demo/site-chat/transcript";
import { issueNhChatCookie, NH_CHAT_COOKIE, verifyNhChatCookie } from "@/lib/demo/nyhavna-chat/access";
import { issueLbDemoCookie, LB_DEMO_COOKIE } from "@/lib/demo/leangenbukta-site/access";
import { transcriptScope } from "@/lib/demo/site-chat/profile";
import { nyhavnaChatProfile } from "@/lib/demo/nyhavna-chat/profile";
import { POST } from "./route";

const NH_SCOPE = transcriptScope(nyhavnaChatProfile);

const SHARED = "https://demo.placy.example";

function handoff(session: string, cookie: string | null) {
  const raw = JSON.stringify({ session });
  return new NextRequest(`${SHARED}/api/prototype/live/handoff`, {
    method: "POST",
    body: raw,
    headers: { "content-type": "application/json", "content-length": String(raw.length), origin: SHARED, ...(cookie ? { cookie } : {}) },
  });
}

beforeEach(() => {
  // Den lokale ruta finnes for Nyhavna-besøkende bare på en utviklingsserver;
  // på den delte stemmen kommer overføringen på kontrollforbindelsen.
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("PLACY_NH_CHAT_ENABLED", "true");
  vi.stubEnv("PLACY_NH_CHAT_COOKIE_SECRET", "n".repeat(40));
  vi.stubEnv("PLACY_NH_CHAT_VOICE", "true");
  vi.stubEnv("PLACY_LB_DEMO_ACCESS_CODE", "leangenbukta-demo-code");
  vi.stubEnv("PLACY_LB_DEMO_COOKIE_SECRET", "s".repeat(40));
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/prototype/live/handoff (tale → tekst)", () => {
  it("gir Nyhavna-besøkende sin egen tale som signert historikk, og ingen andre", async () => {
    const issued = issueNhChatCookie()!;
    const nhCookie = `${NH_CHAT_COOKIE}=${issued.value}`;
    const visitorId = verifyNhChatCookie(issued.value)!.visitorId;
    const sink = startVoiceHandoff("nh-session-token", { scope: NH_SCOPE, visitorId, snapshotId: "nyhavna-lokal-test", baseTurns: [], baseTrimmed: false });
    sink.delta("user", "Hva finnes på Nyhavna i dag?", { startMs: 0, endMs: 900 });
    sink.delta("assistant", "Blant annet Dora Kaffebar.", { startMs: 1000, endMs: 2000 });
    sink.close();

    const own = await POST(handoff("nh-session-token", nhCookie));
    expect(own.status).toBe(200);
    const body = await own.json();
    expect(body.voiceTurns).toBe(2);
    expect(verifyTranscript(body.transcript, visitorId, NH_SCOPE)?.turns.map((turn) => turn.via)).toEqual(["voice", "voice"]);

    const lbCookie = `${LB_DEMO_COOKIE}=${issueLbDemoCookie("leangenbukta-demo-code")}`;
    expect((await POST(handoff("nh-session-token", lbCookie))).status).toBe(404);
    const otherNh = `${NH_CHAT_COOKIE}=${issueNhChatCookie()!.value}`;
    expect((await POST(handoff("nh-session-token", otherNh))).status).toBe(404);
    expect((await POST(handoff("nh-session-token", null))).status).toBe(404);
  });

  it("er stengt for Nyhavna-besøkende i produksjon og på et miljø med delt stemme", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const nhProd = `${NH_CHAT_COOKIE}=${issueNhChatCookie()!.value}`;
    expect((await POST(handoff("nh-session-token", nhProd))).status).toBe(404);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PLACY_HOSTED_VOICE", "true");
    const nhCookie = `${NH_CHAT_COOKIE}=${issueNhChatCookie()!.value}`;
    expect((await POST(handoff("nh-session-token", nhCookie))).status).toBe(404);
  });
});
