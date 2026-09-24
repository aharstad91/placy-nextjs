import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Server-actionen som bytter tilgangskoden mot demo-cookien.
 *
 * `next/headers` og `next/navigation` finnes bare i en Next-runtime, så begge
 * mockes: `cookies()` gir en enkel Map-backet jar, og `redirect()` kaster en
 * sentinel-feil (Next sin egen `redirect()` gjør det samme via en intern
 * NEXT_REDIRECT-feil) slik at testen kan fange målet uten at koden etter
 * kallet faktisk kjører.
 */

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));

const cookieStore = new Map<string, { value: string }>();
const setMock = vi.fn((name: string, value: string, options: Record<string, unknown>) => {
  cookieStore.set(name, { value });
  return { name, value, options };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.get(name),
    set: (name: string, value: string, options: Record<string, unknown>) => setMock(name, value, options),
  }),
}));

import { enterLeangenbuktaDemo } from "@/app/demo/leangenbukta-tilgang/actions";
import { LB_DEMO_COOKIE, verifyLbDemoCookie } from "@/lib/demo/leangenbukta-site/access";

const CODE = "prov-leangenbukta-2026";
const SECRET = "hemmelig-".repeat(5);

function formData(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

beforeEach(() => {
  cookieStore.clear();
  redirectMock.mockClear();
  setMock.mockClear();
  vi.stubEnv("PLACY_LB_DEMO_ACCESS_CODE", CODE);
  vi.stubEnv("PLACY_LB_DEMO_COOKIE_SECRET", SECRET);
});
afterEach(() => vi.unstubAllEnvs());

describe("enterLeangenbuktaDemo", () => {
  it("sender feil kode tilbake med feil=1 og den saniterte neste-stien", async () => {
    await expect(enterLeangenbuktaDemo(formData({ kode: "feil-kode-helt-sikkert", neste: "https://evil.example" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(setMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(
      `/demo/leangenbukta-tilgang?feil=1&neste=${encodeURIComponent("/demo/leangenbukta-nettside")}`,
    );
  });

  it("setter cookien riktig og sender videre til den saniterte neste-stien ved riktig kode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(
      enterLeangenbuktaDemo(formData({ kode: CODE, neste: "/demo/leangenbukta-lokal" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(setMock).toHaveBeenCalledTimes(1);
    const [name, value, options] = setMock.mock.calls[0];
    expect(name).toBe(LB_DEMO_COOKIE);
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
    });
    expect(typeof options.maxAge).toBe("number");
    expect(verifyLbDemoCookie(value)?.via).toBe("code");

    expect(redirectMock).toHaveBeenCalledWith("/demo/leangenbukta-lokal");
  });

  it("bruker usikret cookie utenfor produksjon", async () => {
    await expect(enterLeangenbuktaDemo(formData({ kode: CODE }))).rejects.toThrow("NEXT_REDIRECT");
    const [, , options] = setMock.mock.calls[0];
    expect(options.secure).toBe(false);
  });

  it("gjenbruker besøks-ID-en fra en gyldig eksisterende cookie i stedet for å mint en ny", async () => {
    await expect(enterLeangenbuktaDemo(formData({ kode: CODE }))).rejects.toThrow("NEXT_REDIRECT");
    const firstToken = setMock.mock.calls[0][1] as string;
    const firstVisitorId = verifyLbDemoCookie(firstToken)?.visitorId;
    expect(firstVisitorId).toBeTruthy();

    // Neste innlogging skjer med cookien fra forrige innlogging allerede i jar-en.
    cookieStore.set(LB_DEMO_COOKIE, { value: firstToken });
    setMock.mockClear();
    redirectMock.mockClear();

    await expect(enterLeangenbuktaDemo(formData({ kode: CODE }))).rejects.toThrow("NEXT_REDIRECT");
    const secondToken = setMock.mock.calls[0][1] as string;
    expect(verifyLbDemoCookie(secondToken)?.visitorId).toBe(firstVisitorId);
  });
});
