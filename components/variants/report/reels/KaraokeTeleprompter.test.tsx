import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KaraokeTeleprompter } from "./KaraokeTeleprompter";
import { AudioElementContext } from "../board/audio-tour/use-audio-element";
import type { BoardAudioTimings } from "../board/board-data";

function withAudioContext(currentTime: number, children: React.ReactNode) {
  return (
    <AudioElementContext.Provider
      value={{
        currentTime,
        duration: 0,
        unlock: async () => {},
        muted: false,
        toggleMuted: () => {},
      }}
    >
      {children}
    </AudioElementContext.Provider>
  );
}

// "En. To. Tre." — tre setninger med stigende ms slik at vi kan plassere
// currentTime midt i setning 2 og verifisere vinduet (aktiv + neste).
const threeSentences: BoardAudioTimings = {
  characters: ["E", "n", ".", " ", "T", "o", ".", " ", "T", "r", "e", "."],
  characterStartTimesSeconds: [
    0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1,
  ],
  characterEndTimesSeconds: [
    0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2,
  ],
};
// Setnings-endMs: "En."=300, "To."=700, "Tre."=1200.

describe("KaraokeTeleprompter", () => {
  it("uten timings → faller tilbake til klartekst", () => {
    render(
      withAudioContext(
        0,
        <KaraokeTeleprompter
          text="ingen alignment her"
          timings={undefined}
          isActive={true}
        />,
      ),
    );
    expect(screen.getByText("ingen alignment her")).toBeDefined();
    // Karaoke-rendering skjer ikke uten timings.
    expect(document.querySelector("[data-karaoke='active']")).toBeNull();
  });

  it("viser et vindu på 2 setninger (aktiv + neste), ikke ferdigspilte", () => {
    render(
      withAudioContext(
        0.5, // 500ms → forbi "En." (300ms), inne i "To." (700ms) → activeIdx=1
        <KaraokeTeleprompter
          text="En. To. Tre."
          timings={threeSentences}
          isActive={true}
        />,
      ),
    );
    // Aktiv setning "To." rendres som karaoke (ord-spans fra timings).
    const active = document.querySelector("[data-karaoke='active']");
    expect(active).not.toBeNull();
    expect(active!.textContent).toContain("To");
    // Neste setning "Tre." vises som teaser (klartekst).
    expect(screen.getByText("Tre.")).toBeDefined();
    // Ferdigspilt setning "En." er ute av vinduet.
    expect(screen.queryByText("En.")).toBeNull();
  });

  it("aktiv karaoke leser ORIGINAL-tekst fra timings, ikke alias i text-prop (AC3)", () => {
    // text-prop = alias-staving (det TTS faktisk sa), timings.characters =
    // original-staving etter remapTimingsToOriginal. Karaoke MÅ rendre
    // original fra timings — ellers lekker alias-stavingen til skjerm.
    const originalSpelling: BoardAudioTimings = {
      characters: ["L", "a", "d", "e", " ", "s", "t", "r", "a", "n", "d"],
      characterStartTimesSeconds: [
        0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
      ],
      characterEndTimesSeconds: [
        0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1,
      ],
    };
    render(
      withAudioContext(
        0.05, // tidlig i setningen → activeIdx=0
        <KaraokeTeleprompter
          text="Lah-deh strand"
          timings={originalSpelling}
          isActive={true}
        />,
      ),
    );
    const active = document.querySelector("[data-karaoke='active']");
    expect(active).not.toBeNull();
    expect(active!.textContent).toContain("Lade");
    expect(active!.textContent).toContain("strand");
    // Alias-stavingen fra text-prop skal aldri nå skjermen i aktiv karaoke.
    expect(active!.textContent).not.toContain("Lah-deh");
    expect(screen.queryByText("Lah-deh strand")).toBeNull();
  });
});
