import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBoard3DCamera } from "./use-board-3d-camera";
import {
  CUT_FADE_MS,
  CUT_SETTLE_MS,
  ORBIT_TILT,
  REAIM_FLY_MS,
  SAT_TRANSITION_MS,
} from "./board-3d-camera-director";
import type { CategoryCameraConfig } from "@/lib/types";

const poseA = { lat: 63.43, lng: 10.39, range: 500, tilt: 60, heading: 200 };
const poseB = { lat: 63.432, lng: 10.395, range: 450, tilt: 62, heading: 240 };
const config: CategoryCameraConfig = { a: poseA, b: poseB };

function makeMap(camera?: { lat: number; lng: number; range: number; tilt: number; heading: number }) {
  return {
    flyCameraTo: vi.fn(),
    flyCameraAround: vi.fn(),
    stopCameraAnimation: vi.fn(),
    // Lesbare kamera-props (Map3DElement-flaten) — Satelitt-overgangene leser
    // gjeldende positur for å beholde brukerens senter/range.
    center: camera ? { lat: camera.lat, lng: camera.lng, altitude: 0 } : undefined,
    range: camera?.range,
    tilt: camera?.tilt,
    heading: camera?.heading,
  };
}

type Props = Parameters<typeof useBoard3DCamera>[0];
const props = (map: unknown, overrides: Partial<Props> = {}): Props => ({
  map3dInstance: map,
  cameraMode: "auto",
  introActive: false,
  home: { lat: 63.435, lng: 10.398 },
  activePOI: null,
  activeCategoryId: "mat-drikke",
  categoryConfig: config,
  audioDurationMs: 20000,
  audioPaused: false,
  reducedMotion: false,
  ...overrides,
});

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useBoard3DCamera — cut-transition", () => {
  it("kjører fade → instant hopp til A → settle → fade ut + A→B", () => {
    const map = makeMap();
    const { result } = renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: props(map),
    });

    // Cut starter: overlay synlig, hopp ennå ikke fyrt (venter på fade-in).
    expect(result.current.cutVisible).toBe(true);
    expect(map.flyCameraTo).not.toHaveBeenCalled();

    // Etter fade-in: instant hopp til A (durationMillis 0), fortsatt svart.
    act(() => vi.advanceTimersByTime(CUT_FADE_MS));
    expect(map.flyCameraTo).toHaveBeenCalledTimes(1);
    expect(map.flyCameraTo.mock.calls[0][0].durationMillis).toBe(0);
    expect(map.flyCameraTo.mock.calls[0][0].endCamera.center.lat).toBe(poseA.lat);
    expect(result.current.cutVisible).toBe(true);

    // Etter settle: fade tilbake + start A→B over voice-over-lengden.
    act(() => vi.advanceTimersByTime(CUT_SETTLE_MS));
    expect(result.current.cutVisible).toBe(false);
    expect(map.flyCameraTo).toHaveBeenCalledTimes(2);
    expect(map.flyCameraTo.mock.calls[1][0].endCamera.center.lat).toBe(poseB.lat);
    expect(map.flyCameraTo.mock.calls[1][0].durationMillis).toBe(20000);
  });

  it("kategori-skifte i settle-vinduet kansellerer gammel A→B (token-guard)", () => {
    const map = makeMap();
    const { result, rerender } = renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: props(map, { activeCategoryId: "mat-drikke" }),
    });

    act(() => vi.advanceTimersByTime(CUT_FADE_MS)); // gammelt hopp til A fyrt
    map.flyCameraTo.mockClear();

    // Bytt kategori MENS vi er i settle-vinduet → ny intent, token bumpes,
    // gammel settle-timer (→ gammel A→B mot poseB) ryddes.
    const poseA2 = { ...poseA, lat: 63.5 };
    const poseB2 = { ...poseB, lat: 63.433 };
    act(() =>
      rerender(
        props(map, {
          activeCategoryId: "transport",
          categoryConfig: { a: poseA2, b: poseB2 },
        }),
      ),
    );

    // Kjør HELE den nye cut-en (fade + settle).
    act(() => vi.advanceTimersByTime(CUT_FADE_MS + CUT_SETTLE_MS));

    // Kun den nye sekvensens to kall skal finnes: hopp til A2 + A→B til B2.
    // Den GAMLE A→B-en (mot poseB) skal aldri ha fyrt.
    const targets = map.flyCameraTo.mock.calls.map((c) => c[0].endCamera.center.lat);
    expect(targets).toEqual([poseA2.lat, poseB2.lat]);
    expect(targets).not.toContain(poseB.lat); // ingen stale A→B
    expect(result.current.cutVisible).toBe(false);
  });

  it("redusert bevegelse: instant hopp til A, ingen cut-overlay, ingen A→B", () => {
    const map = makeMap();
    const { result } = renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: props(map, { reducedMotion: true }),
    });

    expect(result.current.cutVisible).toBe(false);
    expect(map.flyCameraTo).toHaveBeenCalledTimes(1);
    expect(map.flyCameraTo.mock.calls[0][0].durationMillis).toBe(0);

    act(() => vi.advanceTimersByTime(CUT_FADE_MS + CUT_SETTLE_MS));
    expect(map.flyCameraTo).toHaveBeenCalledTimes(1); // ingen videre bevegelse
    expect(map.flyCameraAround).not.toHaveBeenCalled();
  });

  it("pauset audio fryser bevegelsen (ingen fly-kall, ingen cut)", () => {
    const map = makeMap();
    const { result } = renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: props(map, { audioPaused: true }),
    });

    expect(result.current.cutVisible).toBe(false);
    act(() => vi.advanceTimersByTime(CUT_FADE_MS + CUT_SETTLE_MS));
    expect(map.flyCameraTo).not.toHaveBeenCalled();
    expect(map.flyCameraAround).not.toHaveBeenCalled();
  });

  it("introActive: director yield-er — ingen fly-kall selv med aktiv kategori", () => {
    const map = makeMap();
    // Intro-flythrough-en eier kameraet; director-en skal ikke røre det selv om
    // en kategori er aktiv (ellers kjemper orbit/cinematic mot innflyvningen).
    const { result } = renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: props(map, { introActive: true, activeCategoryId: "mat-drikke" }),
    });

    expect(result.current.cutVisible).toBe(false);
    act(() => vi.advanceTimersByTime(CUT_FADE_MS + CUT_SETTLE_MS));
    expect(map.flyCameraTo).not.toHaveBeenCalled();
    expect(map.flyCameraAround).not.toHaveBeenCalled();
  });

  it("A-only config: cut → orbit ved A (ingen B-fly)", () => {
    const map = makeMap();
    renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: props(map, { categoryConfig: { a: poseA } }),
    });

    act(() => vi.advanceTimersByTime(CUT_FADE_MS)); // hopp til A
    act(() => vi.advanceTimersByTime(CUT_SETTLE_MS)); // settle → startMove
    expect(map.flyCameraAround).toHaveBeenCalledTimes(1);
    expect(map.flyCameraAround.mock.calls[0][0].camera.center.lat).toBe(poseA.lat);
  });
});

describe("useBoard3DCamera — orbit/free uten config", () => {
  it("ingen config → orbit-fallback (fly inn + orbit), ingen cut-overlay", () => {
    const map = makeMap();
    const { result } = renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: props(map, { categoryConfig: undefined }),
    });

    expect(result.current.cutVisible).toBe(false);
    expect(map.flyCameraTo).toHaveBeenCalledTimes(1); // fly inn til orbit-hero
    act(() => vi.advanceTimersByTime(2000));
    expect(map.flyCameraAround).toHaveBeenCalledTimes(1); // orbit startet
  });

  it("inn i orbit fra innflyvning (free) → cut-overlay maskerer fly-overen", () => {
    const map = makeMap();
    // Start i intro: introActive → director yield-er (free), ingen bevegelse.
    const { result, rerender } = renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: props(map, {
        introActive: true,
        activeCategoryId: null,
        categoryConfig: undefined,
      }),
    });
    expect(result.current.cutVisible).toBe(false);
    expect(map.flyCameraTo).not.toHaveBeenCalled();

    // Innflyvningen er ferdig → nabolaget (uten waypoints) overtar = orbit + cut.
    act(() =>
      rerender(
        props(map, {
          introActive: false,
          activeCategoryId: "nabolaget",
          categoryConfig: undefined,
        }),
      ),
    );
    expect(result.current.cutVisible).toBe(true); // cream-fade inn
    expect(map.flyCameraTo).not.toHaveBeenCalled(); // hopp venter på fade-in

    // Etter fade-in: instant hopp til orbit-hero (skjult bak cream).
    act(() => vi.advanceTimersByTime(CUT_FADE_MS));
    expect(map.flyCameraTo).toHaveBeenCalledTimes(1);
    expect(map.flyCameraTo.mock.calls[0][0].durationMillis).toBe(0);

    // Etter settle: fade ut + start orbit.
    act(() => vi.advanceTimersByTime(CUT_SETTLE_MS));
    expect(result.current.cutVisible).toBe(false);
    expect(map.flyCameraAround).toHaveBeenCalledTimes(1);
  });

  it("free-modus → stopper, ingen fly", () => {
    const map = makeMap();
    renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: props(map, { cameraMode: "free", categoryConfig: undefined }),
    });
    expect(map.stopCameraAnimation).toHaveBeenCalled();
    expect(map.flyCameraTo).not.toHaveBeenCalled();
    expect(map.flyCameraAround).not.toHaveBeenCalled();
  });
});

// ── Satelitt (overhead): ovenfra↔skrå som ÉN myk flyvning, aldri cut ────────
describe("useBoard3DCamera — Satelitt-overganger (overhead)", () => {
  const idle = (map: unknown, overrides: Partial<Props> = {}): Props =>
    props(map, { activeCategoryId: null, categoryConfig: undefined, ...overrides });

  it("3D→sat (idle auto): ÉN flyvning som beholder senter/range og legger kameraet ned", () => {
    const map = makeMap({ lat: 63.44, lng: 10.41, range: 820, tilt: 50, heading: 137 });
    const { result, rerender } = renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: idle(map), // orbit i 3D
    });
    map.flyCameraTo.mockClear();
    map.flyCameraAround.mockClear();

    act(() => rerender(idle(map, { overhead: true })));

    expect(map.flyCameraTo).toHaveBeenCalledTimes(1);
    const call = map.flyCameraTo.mock.calls[0][0];
    // Brukerens senter/range beholdes — aldri hjem-teleport (63.435/10.398 er hjem).
    expect(call.endCamera.center.lat).toBe(63.44);
    expect(call.endCamera.center.lng).toBe(10.41);
    expect(call.endCamera.range).toBe(820);
    expect(call.endCamera.tilt).toBe(0);
    expect(call.endCamera.heading).toBe(0);
    expect(call.durationMillis).toBe(SAT_TRANSITION_MS);
    // Aldri cut på ovenfra↔skrå.
    expect(result.current.cutVisible).toBe(false);
    expect(map.flyCameraAround).not.toHaveBeenCalled();
  });

  it("sat→3d (idle auto): orbit gjenopptas med myk fly-inn, cutVisible fyrer ALDRI", () => {
    const map = makeMap({ lat: 63.44, lng: 10.41, range: 820, tilt: 0, heading: 0 });
    const { result, rerender } = renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: idle(map, { overhead: true }),
    });
    map.flyCameraTo.mockClear();

    act(() => rerender(idle(map, { overhead: false })));

    // Orbit-intents fly-inn (REAIM) — uten cut (prev var overheadRest).
    expect(result.current.cutVisible).toBe(false);
    expect(map.flyCameraTo).toHaveBeenCalledTimes(1);
    expect(map.flyCameraTo.mock.calls[0][0].durationMillis).toBe(REAIM_FLY_MS);
    act(() => vi.advanceTimersByTime(REAIM_FLY_MS + CUT_FADE_MS + CUT_SETTLE_MS));
    expect(result.current.cutVisible).toBe(false);
    expect(map.flyCameraAround).toHaveBeenCalledTimes(1);
  });

  it("hvile i sat: kameraet står alt ovenfra → HOLD (pan flytter aldri tilbake)", () => {
    const map = makeMap({ lat: 63.5, lng: 10.6, range: 900, tilt: 0, heading: 0 });
    const { rerender } = renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: idle(map, { overhead: true }),
    });
    map.flyCameraTo.mockClear();

    // En dep-endring (audio-pause) mens brukeren har panorert vekk fra hjemmet:
    // ingen skriver skal flytte kameraet.
    act(() => rerender(idle(map, { overhead: true, audioPaused: true })));

    expect(map.flyCameraTo).not.toHaveBeenCalled();
    expect(map.flyCameraAround).not.toHaveBeenCalled();
  });

  it("welcome-beat-slutt i sat: kameraet står skrått → fly tilbake til hvileposituren (R8b)", () => {
    const map = makeMap({ lat: 63.43, lng: 10.39, range: 300, tilt: 52, heading: 110 });
    const { rerender } = renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: idle(map, { overhead: true, introActive: true, orbitRange: 1600 }),
    });
    map.flyCameraTo.mockClear();

    act(() => rerender(idle(map, { overhead: true, introActive: false, orbitRange: 1600 })));

    expect(map.flyCameraTo).toHaveBeenCalledTimes(1);
    const call = map.flyCameraTo.mock.calls[0][0];
    expect(call.endCamera.tilt).toBe(0);
    expect(call.endCamera.range).toBe(1600);
    expect(call.endCamera.center.lat).toBe(63.435); // hvileposituren (hjem)
    expect(call.durationMillis).toBe(REAIM_FLY_MS);
  });

  it("sat→3d i fri kameramodus: overgangen flyr til skrå (behold senter/range, tilt → ORBIT_TILT)", () => {
    const map = makeMap({ lat: 63.5, lng: 10.6, range: 900, tilt: 0, heading: 0 });
    const { rerender } = renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: idle(map, { overhead: true, cameraMode: "free" }),
    });
    map.flyCameraTo.mockClear();

    act(() => rerender(idle(map, { overhead: false, cameraMode: "free" })));

    expect(map.flyCameraTo).toHaveBeenCalledTimes(1);
    const call = map.flyCameraTo.mock.calls[0][0];
    expect(call.endCamera.center.lat).toBe(63.5); // brukerens senter — aldri hjem
    expect(call.endCamera.range).toBe(900);
    expect(call.endCamera.tilt).toBe(ORBIT_TILT);
    expect(call.durationMillis).toBe(SAT_TRANSITION_MS);
  });

  it("drift-flip (skipSkraaReentryRef): sat→3d flyr IKKE — gesten eier posituren", () => {
    const map = makeMap({ lat: 63.5, lng: 10.6, range: 900, tilt: 9, heading: 4 });
    const skipRef = { current: false };
    const { rerender } = renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: idle(map, {
        overhead: true,
        cameraMode: "free",
        skipSkraaReentryRef: skipRef,
      }),
    });
    map.flyCameraTo.mockClear();
    skipRef.current = true; // settes av drift-flippen FØR view-byttet

    act(() =>
      rerender(
        idle(map, {
          overhead: false,
          cameraMode: "free",
          skipSkraaReentryRef: skipRef,
        }),
      ),
    );

    expect(map.flyCameraTo).not.toHaveBeenCalled();
    expect(skipRef.current).toBe(false); // ett-skudds: nullstilles ved bruk
  });

  it("kategori-klikk i sat: flyr til klampet pose; samme kategori re-render flyr IKKE på nytt", () => {
    const map = makeMap({ lat: 63.44, lng: 10.41, range: 820, tilt: 0, heading: 0 });
    const { result, rerender } = renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: idle(map, { overhead: true }),
    });
    map.flyCameraTo.mockClear();

    act(() =>
      rerender(props(map, { overhead: true, activeCategoryId: "mat-drikke" })),
    );
    expect(result.current.cutVisible).toBe(false); // aldri cut i sat
    expect(map.flyCameraTo).toHaveBeenCalledTimes(1);
    expect(map.flyCameraTo.mock.calls[0][0].endCamera.tilt).toBe(0);

    // Re-render av samme kategori (pause-skifte): posen er etablert — ikke re-fly
    // (brukeren kan ha panorert innen kategorien).
    act(() =>
      rerender(
        props(map, {
          overhead: true,
          activeCategoryId: "mat-drikke",
          audioPaused: true,
        }),
      ),
    );
    expect(map.flyCameraTo).toHaveBeenCalledTimes(1);
  });

  it("mid-flight-omdirigering (R9): nytt view-klikk erstatter pågående flyvning", () => {
    const map = makeMap({ lat: 63.44, lng: 10.41, range: 820, tilt: 50, heading: 0 });
    const { rerender } = renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: idle(map),
    });
    map.flyCameraTo.mockClear();
    map.stopCameraAnimation.mockClear();

    act(() => rerender(idle(map, { overhead: true }))); // 3D→sat: flyvning starter
    expect(map.flyCameraTo).toHaveBeenCalledTimes(1);

    // Klikk «3D» midt i flyvningen: best-effort stopp + ny flyvning (orbit-fly-inn).
    act(() => rerender(idle(map, { overhead: false })));
    expect(map.stopCameraAnimation).toHaveBeenCalled();
    expect(map.flyCameraTo).toHaveBeenCalledTimes(2);
  });
});
