import { describe, it, expect, beforeEach } from "vitest";
import { useAudioTourStore, type AudioTrack } from "./audio-tour-store";
import type { BoardCategoryId } from "@/components/variants/report/board/board-data";

const TRACKS: AudioTrack[] = [
  {
    categoryId: "home",
    url: "/audio/x/hjem.mp3",
    manus: "hjem-manus",
  },
  {
    categoryId: "mat-drikke" as BoardCategoryId,
    url: "/audio/x/mat-drikke.mp3",
    manus: "mat-drikke-manus",
  },
  {
    categoryId: "transport" as BoardCategoryId,
    url: "/audio/x/transport.mp3",
    manus: "transport-manus",
  },
];

beforeEach(() => {
  useAudioTourStore.getState().close();
});

describe("start", () => {
  it("setter phase=playing, trackIndex=0 og tracks", () => {
    useAudioTourStore.getState().start(TRACKS);
    const s = useAudioTourStore.getState();
    expect(s.phase).toBe("playing");
    expect(s.trackIndex).toBe(0);
    expect(s.tracks).toHaveLength(3);
  });

  it("no-op ved tom tracks-array", () => {
    useAudioTourStore.getState().start([]);
    expect(useAudioTourStore.getState().phase).toBe("idle");
  });
});

describe("next", () => {
  it("flytter til neste track når flere gjenstår", () => {
    useAudioTourStore.getState().start(TRACKS);
    useAudioTourStore.getState().next();
    expect(useAudioTourStore.getState().trackIndex).toBe(1);
    expect(useAudioTourStore.getState().phase).toBe("playing");
  });

  it("setter phase=ended ved siste track", () => {
    useAudioTourStore.getState().start(TRACKS);
    useAudioTourStore.getState().goToTrack(2);
    useAudioTourStore.getState().next();
    expect(useAudioTourStore.getState().phase).toBe("ended");
  });

  it("no-op uten tracks", () => {
    useAudioTourStore.getState().next();
    expect(useAudioTourStore.getState().phase).toBe("idle");
  });
});

describe("prev", () => {
  it("flytter til forrige track", () => {
    useAudioTourStore.getState().start(TRACKS);
    useAudioTourStore.getState().goToTrack(2);
    useAudioTourStore.getState().prev();
    expect(useAudioTourStore.getState().trackIndex).toBe(1);
  });
  it("no-op ved trackIndex=0", () => {
    useAudioTourStore.getState().start(TRACKS);
    useAudioTourStore.getState().prev();
    expect(useAudioTourStore.getState().trackIndex).toBe(0);
  });
});

describe("pause + resume", () => {
  it("pause setter phase=paused og pauseReason", () => {
    useAudioTourStore.getState().start(TRACKS);
    useAudioTourStore.getState().pause("manual");
    const s = useAudioTourStore.getState();
    expect(s.phase).toBe("paused");
    expect(s.pauseReason).toBe("manual");
  });

  it("pause er no-op hvis ikke playing", () => {
    useAudioTourStore.getState().pause("manual");
    expect(useAudioTourStore.getState().phase).toBe("idle");
  });

  it("resume fra paused → playing", () => {
    useAudioTourStore.getState().start(TRACKS);
    useAudioTourStore.getState().pause("category-clicked");
    useAudioTourStore.getState().resume();
    const s = useAudioTourStore.getState();
    expect(s.phase).toBe("playing");
    expect(s.pauseReason).toBeUndefined();
  });
});

describe("goToTrack", () => {
  it("bytter til gyldig index", () => {
    useAudioTourStore.getState().start(TRACKS);
    useAudioTourStore.getState().goToTrack(2);
    expect(useAudioTourStore.getState().trackIndex).toBe(2);
  });
  it("ignorerer ugyldig index", () => {
    useAudioTourStore.getState().start(TRACKS);
    useAudioTourStore.getState().goToTrack(99);
    expect(useAudioTourStore.getState().trackIndex).toBe(0);
  });
  it("ignorerer negativ index", () => {
    useAudioTourStore.getState().start(TRACKS);
    useAudioTourStore.getState().goToTrack(-1);
    expect(useAudioTourStore.getState().trackIndex).toBe(0);
  });
});

describe("close", () => {
  it("resetter til initial state fra hvilken som helst phase", () => {
    useAudioTourStore.getState().start(TRACKS);
    useAudioTourStore.getState().goToTrack(2);
    useAudioTourStore.getState().pause("manual");
    useAudioTourStore.getState().close();
    const s = useAudioTourStore.getState();
    expect(s.phase).toBe("idle");
    expect(s.trackIndex).toBe(0);
    expect(s.tracks).toEqual([]);
    expect(s.pauseReason).toBeUndefined();
  });
});

describe("setError + retryTrack", () => {
  it("setError setter phase=error og lagrer trackIndex", () => {
    useAudioTourStore.getState().start(TRACKS);
    useAudioTourStore.getState().goToTrack(1);
    useAudioTourStore.getState().setError();
    const s = useAudioTourStore.getState();
    expect(s.phase).toBe("error");
    expect(s.errorTrackIndex).toBe(1);
  });

  it("retryTrack fra error → playing samme track", () => {
    useAudioTourStore.getState().start(TRACKS);
    useAudioTourStore.getState().goToTrack(1);
    useAudioTourStore.getState().setError();
    useAudioTourStore.getState().retryTrack();
    const s = useAudioTourStore.getState();
    expect(s.phase).toBe("playing");
    expect(s.trackIndex).toBe(1);
    expect(s.errorTrackIndex).toBeUndefined();
  });

  it("retryTrack no-op hvis ikke error", () => {
    useAudioTourStore.getState().start(TRACKS);
    useAudioTourStore.getState().retryTrack();
    expect(useAudioTourStore.getState().phase).toBe("playing");
  });
});

describe("playedCategoryIds (sticky progress)", () => {
  it("start() resetter playedCategoryIds til tom Set", () => {
    useAudioTourStore.getState().start(TRACKS);
    useAudioTourStore.getState().next();
    expect(useAudioTourStore.getState().playedCategoryIds.has("home")).toBe(true);
    useAudioTourStore.getState().start(TRACKS);
    expect(useAudioTourStore.getState().playedCategoryIds.size).toBe(0);
  });

  it("next() markerer current som played før trackIndex økes", () => {
    useAudioTourStore.getState().start(TRACKS);
    useAudioTourStore.getState().next();
    expect(useAudioTourStore.getState().playedCategoryIds.has("home")).toBe(true);
    expect(useAudioTourStore.getState().trackIndex).toBe(1);
  });

  it("next() ved siste track markerer current OG setter phase=ended", () => {
    useAudioTourStore.getState().start(TRACKS);
    useAudioTourStore.getState().goToTrack(2); // siste
    useAudioTourStore.getState().next();
    const s = useAudioTourStore.getState();
    expect(s.phase).toBe("ended");
    expect(s.playedCategoryIds.has("transport" as BoardCategoryId)).toBe(true);
    expect(s.playedCategoryIds.has("home")).toBe(true); // markert ved goToTrack
  });

  it("goToTrack() markerer current som played før jump", () => {
    useAudioTourStore.getState().start(TRACKS);
    useAudioTourStore.getState().goToTrack(2);
    expect(useAudioTourStore.getState().playedCategoryIds.has("home")).toBe(true);
    expect(useAudioTourStore.getState().trackIndex).toBe(2);
  });

  it("re-spill av tidligere seksjon viser IKKE bort played-status på andre", () => {
    // home → mat-drikke → transport. Alle tre played.
    useAudioTourStore.getState().start(TRACKS);
    useAudioTourStore.getState().next(); // mark home, gå til mat
    useAudioTourStore.getState().next(); // mark mat, gå til transport
    // Hopp tilbake til mat-drikke (re-spill)
    useAudioTourStore.getState().goToTrack(1);
    const s = useAudioTourStore.getState();
    expect(s.trackIndex).toBe(1);
    expect(s.playedCategoryIds.has("home")).toBe(true);
    expect(s.playedCategoryIds.has("mat-drikke" as BoardCategoryId)).toBe(true);
    expect(s.playedCategoryIds.has("transport" as BoardCategoryId)).toBe(true);
  });

  it("prev() markerer current som played før decrement", () => {
    useAudioTourStore.getState().start(TRACKS);
    useAudioTourStore.getState().goToTrack(2);
    useAudioTourStore.getState().prev();
    const s = useAudioTourStore.getState();
    expect(s.trackIndex).toBe(1);
    expect(s.playedCategoryIds.has("transport" as BoardCategoryId)).toBe(true);
  });

  it("close() resetter playedCategoryIds", () => {
    useAudioTourStore.getState().start(TRACKS);
    useAudioTourStore.getState().next();
    useAudioTourStore.getState().close();
    expect(useAudioTourStore.getState().playedCategoryIds.size).toBe(0);
  });
});
