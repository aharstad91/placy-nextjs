import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { TravelModeSelector } from "./TravelModeSelector";
import type { TravelMode } from "@/lib/types";

/**
 * Modus-utvalget. ÉN komponent for alle inngangene til `SET_TRAVEL_MODE` —
 * rekkefølge, etiketter og regelen for manglende data må være identiske på
 * chipen på ruta, chipen i 3D, enheten over minutt-kolonnen, omvisningens
 * celle og kart-pillen (R5, R6).
 *
 * `segment`-varianten (tre ikonknapper på rad) er borte 2026-09-07: kart-pillen
 * gikk over til dropdown, og lista er nå den eneste presentasjonen.
 */

afterEach(() => cleanup());

const ALL: TravelMode[] = ["walk", "bike", "car"];

describe("TravelModeSelector — R6: modus uten data vises ikke", () => {
  it("bare én modus rendrer ingenting", () => {
    const { container } = render(
      <TravelModeSelector modes={["walk"]} active="walk" onChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("tom modus-liste rendrer ingenting", () => {
    const { container } = render(
      <TravelModeSelector modes={[]} active="walk" onChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("viser bare modusene som sendes inn — ingen tomme plasser", () => {
    const { getByRole, queryByRole } = render(
      <TravelModeSelector modes={["walk", "car"]} active="walk" onChange={vi.fn()} />,
    );
    expect(getByRole("button", { name: "Til fots" })).toBeTruthy();
    expect(getByRole("button", { name: "Bil" })).toBeTruthy();
    expect(queryByRole("button", { name: "Sykkel" })).toBeNull();
  });
});

describe("TravelModeSelector — lista", () => {
  it("markerer aktiv modus med aria-pressed", () => {
    const { getByRole } = render(
      <TravelModeSelector modes={ALL} active="bike" onChange={vi.fn()} />,
    );
    expect(getByRole("button", { name: /Sykkel/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(getByRole("button", { name: /Til fots/ }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("klikk melder modusen videre", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <TravelModeSelector modes={ALL} active="walk" onChange={onChange} />,
    );
    getByRole("button", { name: /Bil/ }).click();
    expect(onChange).toHaveBeenCalledWith("car");
  });

  it("beholder kanonisk rekkefølge (gå, sykkel, bil)", () => {
    const { getAllByRole } = render(
      <TravelModeSelector modes={ALL} active="walk" onChange={vi.fn()} />,
    );
    expect(getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Til fots",
      "Sykkel",
      "Bil",
    ]);
  });

  it("viser tid per modus når tallene finnes", () => {
    const { getByRole } = render(
      <TravelModeSelector
        modes={ALL}
        active="bike"
        minutesByMode={{ walk: 12, bike: 5, car: 3 }}
        onChange={vi.fn()}
      />,
    );
    expect(getByRole("button", { name: /Sykkel/ }).textContent).toContain("5 min");
    expect(getByRole("button", { name: /Til fots/ }).textContent).toContain("12 min");
  });

  it("sier «–» for modus uten rute — aldri «undefined min»", () => {
    const { getByRole, container } = render(
      <TravelModeSelector
        modes={ALL}
        active="walk"
        minutesByMode={{ walk: 12 }}
        onChange={vi.fn()}
      />,
    );
    expect(getByRole("button", { name: /Sykkel/ }).textContent).toContain("–");
    expect(container.textContent).not.toContain("undefined");
  });

  it("utelates `minutesByMode` helt, står ingen tid-kolonne og ingen forbehold", () => {
    const { container } = render(
      <TravelModeSelector modes={ALL} active="walk" onChange={vi.fn()} />,
    );
    expect(container.textContent).not.toContain("min");
    expect(container.textContent).not.toContain("omtrentlige");
  });

  it("forbeholdet står bare når det finnes tall å ta forbehold om", () => {
    const { container: withNumbers } = render(
      <TravelModeSelector
        modes={ALL}
        active="walk"
        minutesByMode={{ walk: 12 }}
        onChange={vi.fn()}
      />,
    );
    expect(withNumbers.textContent).toContain("Alle tider er omtrentlige");
    cleanup();

    // `{}` er «ingen av modusene har tall» — da ville forbeholdet stått over
    // tre streker.
    const { container: empty } = render(
      <TravelModeSelector modes={ALL} active="walk" minutesByMode={{}} onChange={vi.fn()} />,
    );
    expect(empty.textContent).not.toContain("omtrentlige");
  });
});
