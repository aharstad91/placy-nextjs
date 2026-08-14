import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LocaleProvider, useLocale } from "@/lib/i18n/locale-context";

function Probe() {
  const { locale, setLocale } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <button onClick={() => setLocale("en")}>til engelsk</button>
    </div>
  );
}

function setBrowserLanguage(value: string) {
  Object.defineProperty(window.navigator, "language", {
    value,
    configurable: true,
  });
}

describe("LocaleProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    setBrowserLanguage("nb-NO");
  });

  it("blir stående på norsk selv når nettleseren er engelsk", async () => {
    // Regresjonsvakt: auto-deteksjonen ga «Walking distance from Overvik» på et
    // norsk Grilstad-board fordi nettleserspråket alene byttet locale.
    setBrowserLanguage("en-US");
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("locale").textContent).toBe("no"));
  });

  it("respekterer et lagret engelsk valg", async () => {
    localStorage.setItem("placy-locale", "en");
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("locale").textContent).toBe("en"));
  });

  it("lagrer valget slik at det overlever neste besøk", async () => {
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    screen.getByText("til engelsk").click();
    await waitFor(() => expect(localStorage.getItem("placy-locale")).toBe("en"));
  });

  it("starter på norsk for å matche SSR", () => {
    setBrowserLanguage("en-GB");
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    // Første render, før effekten kjører — må være «no», ellers hydrerer serveren
    // og klienten ulikt.
    expect(screen.getByTestId("locale").textContent).toBe("no");
  });

  it("ignorerer ugyldig lagret verdi", async () => {
    localStorage.setItem("placy-locale", "de");
    setBrowserLanguage("de-DE");
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("locale").textContent).toBe("no"));
  });
});

describe("useLocale utenfor provider", () => {
  it("faller tilbake til norsk", () => {
    render(<Probe />);
    expect(screen.getByTestId("locale").textContent).toBe("no");
  });
});

// Sanity: testene over ville bestått også med auto-deteksjon dersom
// navigator.language ikke lot seg overstyre. Denne asserter at overstyringen
// faktisk virker, så regresjonsvakten er ekte.
describe("testoppsettet", () => {
  it("kan overstyre navigator.language", () => {
    setBrowserLanguage("en-US");
    expect(navigator.language).toBe("en-US");
    vi.restoreAllMocks();
  });
});
