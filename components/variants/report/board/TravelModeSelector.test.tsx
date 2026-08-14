import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { TravelModeSelector } from "./TravelModeSelector";
import type { TravelMode } from "@/lib/types";

/**
 * Modus-utvalget. To varianter, én kontrakt — det er hele poenget med å ha ÉN
 * komponent: rekkefølge, etiketter og regelen for manglende data må være
 * identiske i chipens panel og i kart-kontrollens segment (R5, R6).
 */

afterEach(() => cleanup());

const ALL: TravelMode[] = ["walk", "bike", "car"];

describe("TravelModeSelector — R6: modus uten data vises ikke", () => {
  it.each(["panel", "segment"] as const)("%s med bare én modus rendrer ingenting", (variant) => {
    const { container } = render(
      <TravelModeSelector variant={variant} modes={["walk"]} active="walk" onChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it.each(["panel", "segment"] as const)("%s med tom modus-liste rendrer ingenting", (variant) => {
    const { container } = render(
      <TravelModeSelector variant={variant} modes={[]} active="walk" onChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("viser bare modusene som sendes inn — ingen tomme plasser", () => {
    const { getByRole, queryByRole } = render(
      <TravelModeSelector
        variant="segment"
        modes={["walk", "car"]}
        active="walk"
        onChange={vi.fn()}
      />,
    );
    expect(getByRole("button", { name: "Til fots" })).toBeTruthy();
    expect(getByRole("button", { name: "Bil" })).toBeTruthy();
    expect(queryByRole("button", { name: "Sykkel" })).toBeNull();
  });
});

describe("TravelModeSelector — segment (kart-kontrollen)", () => {
  it("markerer aktiv modus med aria-pressed", () => {
    const { getByRole } = render(
      <TravelModeSelector variant="segment" modes={ALL} active="bike" onChange={vi.fn()} />,
    );
    expect(getByRole("button", { name: "Sykkel" }).getAttribute("aria-pressed")).toBe("true");
    expect(getByRole("button", { name: "Til fots" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("klikk melder modusen videre", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <TravelModeSelector variant="segment" modes={ALL} active="walk" onChange={onChange} />,
    );
    getByRole("button", { name: "Bil" }).click();
    expect(onChange).toHaveBeenCalledWith("car");
  });
});

describe("TravelModeSelector — panel (chipens utvidede liste)", () => {
  const minutes = { walk: 35, bike: 17, car: 11 };

  it("viser alle tre tidene, i kanonisk rekkefølge fra tregeste til raskeste", () => {
    const { getAllByRole } = render(
      <TravelModeSelector
        variant="panel"
        modes={ALL}
        active="bike"
        minutesByMode={minutes}
        onChange={vi.fn()}
      />,
    );
    expect(getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Til fots35 min",
      "Sykkel17 min",
      "Bil11 min",
    ]);
  });

  it("en modus uten tid for punktet viser tankestrek, ikke «undefined min»", () => {
    const { getByRole } = render(
      <TravelModeSelector
        variant="panel"
        modes={ALL}
        active="walk"
        minutesByMode={{ walk: 12 }}
        onChange={vi.fn()}
      />,
    );
    const bike = getByRole("button", { name: /Sykkel/ });
    expect(bike.textContent).toBe("Sykkel–");
    expect(bike.textContent).not.toContain("undefined");
  });

  it("uten minutesByMode i det hele tatt krasjer den ikke", () => {
    const { getAllByRole } = render(
      <TravelModeSelector variant="panel" modes={ALL} active="walk" onChange={vi.fn()} />,
    );
    expect(getAllByRole("button")).toHaveLength(3);
  });

  it("sier at tidene er omtrentlige (samme forbehold som Airbnb-mønsteret)", () => {
    const { getByText } = render(
      <TravelModeSelector
        variant="panel"
        modes={ALL}
        active="walk"
        minutesByMode={minutes}
        onChange={vi.fn()}
      />,
    );
    expect(getByText("Alle tider er omtrentlige")).toBeTruthy();
  });

  it("klikk på en rad melder modusen videre", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <TravelModeSelector
        variant="panel"
        modes={ALL}
        active="walk"
        minutesByMode={minutes}
        onChange={onChange}
      />,
    );
    getByRole("button", { name: /Sykkel/ }).click();
    expect(onChange).toHaveBeenCalledWith("bike");
  });
});

describe("TravelModeSelector — de to variantene deler kontrakt", () => {
  it("samme etiketter og samme rekkefølge i begge", () => {
    const { getAllByRole: panelButtons } = render(
      <TravelModeSelector variant="panel" modes={ALL} active="walk" onChange={vi.fn()} />,
    );
    const panelOrder = panelButtons("button").map((b) => b.getAttribute("aria-pressed"));
    cleanup();

    const { getAllByRole: segmentButtons } = render(
      <TravelModeSelector variant="segment" modes={ALL} active="walk" onChange={vi.fn()} />,
    );
    const segmentOrder = segmentButtons("button").map((b) => b.getAttribute("aria-pressed"));

    expect(panelOrder).toEqual(segmentOrder);
    expect(panelOrder).toEqual(["true", "false", "false"]);
  });
});
