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

// "en to tre" — alle ord på én linje i jsdom (ingen layout-engine, alle
// getBoundingClientRect-er returnerer top=0). I praksis betyr det at hele
// teksten utgjør én linje, og line-startMs = første ords startMs (100ms).
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

  it("isActive=true → rendrer ord-spans med data-line-index", () => {
    render(
      withAudioContext(
        0,
        <KaraokePitchText text="en to tre" timings={helloTimings} isActive={true} />,
      ),
    );
    const root = document.querySelector("[data-karaoke='active']");
    expect(root).not.toBeNull();
    const wordSpans = root!.querySelectorAll("[data-line-index]");
    expect(wordSpans).toHaveLength(3);
  });

  it("currentTime før første ords startMs → alle ord er dim (opacity 0.4)", () => {
    render(
      withAudioContext(
        0.05, // 50ms — før første ord (100ms)
        <KaraokePitchText text="en to tre" timings={helloTimings} isActive={true} />,
      ),
    );
    const wordSpans = document.querySelectorAll("[data-line-index]");
    wordSpans.forEach((span) => {
      expect((span as HTMLElement).style.opacity).toBe("0.4");
      expect(span.getAttribute("data-line-lit")).toBe("false");
    });
  });

  it("currentTime forbi linjens startMs → alle ord på linjen er lit (jsdom: én linje)", () => {
    render(
      withAudioContext(
        0.5, // 500ms — godt forbi linje 0's startMs på 100ms
        <KaraokePitchText text="en to tre" timings={helloTimings} isActive={true} />,
      ),
    );
    const wordSpans = document.querySelectorAll("[data-line-index]");
    wordSpans.forEach((span) => {
      expect((span as HTMLElement).style.opacity).toBe("1");
      expect(span.getAttribute("data-line-lit")).toBe("true");
    });
  });

  it("ord-mapper får tom array → fallback til klartekst", () => {
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
