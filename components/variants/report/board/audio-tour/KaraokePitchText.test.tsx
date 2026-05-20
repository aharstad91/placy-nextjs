import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KaraokePitchText } from "./KaraokePitchText";
import { AudioElementContext } from "./use-audio-element";

function withAudioContext(currentTime: number, children: React.ReactNode) {
  return (
    <AudioElementContext.Provider value={{ currentTime, duration: 0 }}>
      {children}
    </AudioElementContext.Provider>
  );
}

// Token 0 starter på 0.1s slik at currentTime=0 < startMs gir opacity 0.4
// (ekte ElevenLabs-respons har også typisk en liten lead-pause).
const helloTimings = {
  characters: ["e", "n", " ", "t", "o", " ", "t", "r", "e"],
  characterStartTimesSeconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
  characterEndTimesSeconds: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
};

describe("KaraokePitchText", () => {
  it("isActive=false → rendrer klartekst uten karaoke-attributter", () => {
    render(
      withAudioContext(
        0,
        <KaraokePitchText text="en to tre" timings={helloTimings} isActive={false} />,
      ),
    );
    expect(screen.getByText("en to tre")).toBeDefined();
    expect(document.querySelector("[data-karaoke='active']")).toBeNull();
  });

  it("timings=undefined → rendrer klartekst (legacy-spor uten alignment)", () => {
    render(
      withAudioContext(
        0,
        <KaraokePitchText text="en to tre" timings={undefined} isActive={true} />,
      ),
    );
    expect(screen.getByText("en to tre")).toBeDefined();
    expect(document.querySelector("[data-karaoke='active']")).toBeNull();
  });

  it("isActive=true og currentTime=0 → alle tokens har opacity 0.4", () => {
    render(
      withAudioContext(
        0,
        <KaraokePitchText text="en to tre" timings={helloTimings} isActive={true} />,
      ),
    );
    const root = document.querySelector("[data-karaoke='active']");
    expect(root).not.toBeNull();
    const tokens = root!.querySelectorAll("[data-token-index]");
    expect(tokens).toHaveLength(3);
    tokens.forEach((tok) => {
      expect((tok as HTMLElement).style.opacity).toBe("0.4");
      expect(tok.getAttribute("data-token-lit")).toBe("false");
    });
  });

  it("currentTime=0.5s tenner ord som starter ≤500ms (en, to)", () => {
    render(
      withAudioContext(
        0.5,
        <KaraokePitchText text="en to tre" timings={helloTimings} isActive={true} />,
      ),
    );
    const tokens = document.querySelectorAll("[data-token-index]");
    expect((tokens[0] as HTMLElement).style.opacity).toBe("1");
    expect(tokens[0].getAttribute("data-token-lit")).toBe("true");
    expect((tokens[1] as HTMLElement).style.opacity).toBe("1");
    expect((tokens[2] as HTMLElement).style.opacity).toBe("0.4");
  });

  it("currentTime forbi siste token → alle tokens er lit", () => {
    render(
      withAudioContext(
        1.0,
        <KaraokePitchText text="en to tre" timings={helloTimings} isActive={true} />,
      ),
    );
    const tokens = document.querySelectorAll("[data-token-index]");
    tokens.forEach((tok) => {
      expect((tok as HTMLElement).style.opacity).toBe("1");
    });
  });

  it("rendrer uten AudioElementProvider — currentTime defaulter til 0", () => {
    render(
      <KaraokePitchText text="en to tre" timings={helloTimings} isActive={true} />,
    );
    const tokens = document.querySelectorAll("[data-token-index]");
    expect(tokens).toHaveLength(3);
    tokens.forEach((tok) => {
      expect((tok as HTMLElement).style.opacity).toBe("0.4");
    });
  });

  it("token-mapper får tom array → fallback til klartekst", () => {
    const corrupt = {
      characters: ["a", "b"],
      characterStartTimesSeconds: [0],
      characterEndTimesSeconds: [0.1],
    };
    render(
      withAudioContext(
        0,
        <KaraokePitchText text="fallback" timings={corrupt} isActive={true} />,
      ),
    );
    expect(screen.getByText("fallback")).toBeDefined();
    expect(document.querySelector("[data-karaoke='active']")).toBeNull();
  });
});
