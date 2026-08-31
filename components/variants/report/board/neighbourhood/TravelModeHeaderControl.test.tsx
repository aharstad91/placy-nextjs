import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import type { TravelMode } from "@/lib/types";
import { TravelModeHeaderControl } from "./TravelModeHeaderControl";
import { useAvailableTravelModes, useBoard } from "../board-state";

/**
 * Reisemåte-kontrollen i listeoverskriften.
 *
 * Testene låser tre ting kontrollen finnes for: at den navngir enheten
 * tallene under er i, at den ikke rendres når det ikke finnes et valg å ta,
 * og at panelet har TO lukkeveier — trykk utenfor og navigasjon. Den siste
 * er den som ellers etterlater et åpent panel over innhold det ikke lenger
 * hører til.
 */

vi.mock("../board-state", () => ({
  useBoard: vi.fn(),
  useAvailableTravelModes: vi.fn(),
}));

const dispatch = vi.fn();

function setup(
  overrides: {
    travelMode?: TravelMode;
    modes?: TravelMode[];
    activePOIId?: string | null;
    phase?: string;
  } = {},
) {
  vi.mocked(useBoard).mockReturnValue({
    state: {
      phase: overrides.phase ?? "default",
      activePOIId: overrides.activePOIId ?? null,
      travelMode: overrides.travelMode ?? "walk",
    },
    dispatch,
  } as unknown as ReturnType<typeof useBoard>);
  vi.mocked(useAvailableTravelModes).mockReturnValue(
    overrides.modes ?? ["walk", "bike", "car"],
  );
  return render(<TravelModeHeaderControl />);
}

// `clearAllMocks` nullstiller kall, men IKKE implementasjoner — og én test
// setter en på `dispatch`. Uten denne lekker den videre til neste test.
beforeEach(() => {
  vi.clearAllMocks();
  dispatch.mockReset();
});
afterEach(() => cleanup());

describe("TravelModeHeaderControl", () => {
  it("navngir aktiv modus kollapset", () => {
    const { getByTestId } = setup({ travelMode: "car" });
    expect(getByTestId("travel-mode-header-control").textContent).toContain("Bil");
  });

  it("åpner panelet med alle modusene, aktiv markert", () => {
    const { getByTestId, getByRole } = setup({ travelMode: "bike" });
    fireEvent.click(getByTestId("travel-mode-header-control"));

    expect(getByTestId("travel-mode-header-control").getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(getByRole("button", { name: /Sykkel/ }).getAttribute("aria-pressed")).toBe("true");
    expect(getByRole("button", { name: /Bil/ }).getAttribute("aria-pressed")).toBe("false");
  });

  it("melder modusbyttet videre og lukker panelet", () => {
    const { getByTestId, getByRole, queryByRole } = setup();
    fireEvent.click(getByTestId("travel-mode-header-control"));
    fireEvent.click(getByRole("button", { name: /Bil/ }));

    expect(dispatch).toHaveBeenCalledWith({ type: "SET_TRAVEL_MODE", mode: "car" });
    expect(queryByRole("group", { name: "Reisemåte" })).toBeNull();
  });

  it("rendrer ingenting når boardet bare har én modus", () => {
    // Én modus er ikke et valg. Flaten skal se ut som før reisemåte fantes.
    const { queryByTestId } = setup({ modes: ["walk"] });
    expect(queryByTestId("travel-mode-header-control")).toBeNull();
  });

  it("trykk på allerede aktiv modus lukker uten å endre noe", () => {
    const { getByTestId, getByRole, queryByRole } = setup({ travelMode: "walk" });
    fireEvent.click(getByTestId("travel-mode-header-control"));
    fireEvent.click(getByRole("button", { name: /Til fots/ }));

    // Reduseren kortslutter på samme modus, men kontrollen skal uansett lukke.
    expect(queryByRole("group", { name: "Reisemåte" })).toBeNull();
  });

  it("trykk utenfor lukker uten å bytte modus", () => {
    const { getByTestId, queryByRole } = setup();
    fireEvent.click(getByTestId("travel-mode-header-control"));
    expect(queryByRole("group", { name: "Reisemåte" })).toBeTruthy();

    fireEvent.pointerDown(document.body);

    expect(queryByRole("group", { name: "Reisemåte" })).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("navigasjon lukker et åpent panel", () => {
    // Uten denne blir panelet stående over en flate det ikke ble åpnet i.
    const { getByTestId, queryByRole, rerender } = setup();
    fireEvent.click(getByTestId("travel-mode-header-control"));
    expect(queryByRole("group", { name: "Reisemåte" })).toBeTruthy();

    vi.mocked(useBoard).mockReturnValue({
      state: { phase: "poi", activePOIId: "poi-9", travelMode: "walk" },
      dispatch,
    } as unknown as ReturnType<typeof useBoard>);
    rerender(<TravelModeHeaderControl />);

    expect(queryByRole("group", { name: "Reisemåte" })).toBeNull();
  });

  it("varsler kallstedet FØR modusen byttes, mens gammel rekkefølge står", () => {
    // Kategorisiden bruker dette til å notere hvilken rad som lå øverst, så
    // den kan legges tilbake dit etter at lista har sortert seg om.
    const order: string[] = [];
    const onBeforeChange = vi.fn(() => order.push("before"));
    dispatch.mockImplementation(() => order.push("dispatch"));

    const { getByTestId, getByRole } = render(
      <TravelModeHeaderControl onBeforeChange={onBeforeChange} />,
    );
    fireEvent.click(getByTestId("travel-mode-header-control"));
    fireEvent.click(getByRole("button", { name: /Bil/ }));

    expect(order).toEqual(["before", "dispatch"]);
  });

  it("panelet blir aldri høyere enn plassen det har i den klippende flaten", () => {
    // Sheeten er overflow-hidden og panelet er absolutt posisjonert, så det
    // teller ikke med i innholdstaket. Uten et tak ble siste rad klippet bort
    // på korte skjermer — usynlig, men fortsatt «åpen».
    const { getByTestId, container } = setup();
    const clip = document.createElement("div");
    clip.setAttribute("data-testid", "neighbourhood-sheet");
    container.parentNode?.appendChild(clip);
    clip.appendChild(container);
    clip.getBoundingClientRect = () => ({ bottom: 300, top: 0, height: 300 }) as DOMRect;
    const trigger = getByTestId("travel-mode-header-control");
    trigger.parentElement!.getBoundingClientRect = () =>
      ({ bottom: 250, top: 230, height: 20 }) as DOMRect;

    fireEvent.click(trigger);

    const panel = trigger.parentElement!.querySelector<HTMLElement>("div.absolute");
    expect(panel).toBeTruthy();
    // 300 − 250 − 12 = 38, men gulvet er 96.
    expect(panel!.style.maxHeight).toBe("96px");
  });

  it("panelet viser verken tider eller forbeholdet om at de er omtrentlige", () => {
    // Nabolagslista har ingen utvidet rad å regne et A→B-par fra, så panelet
    // navngir bare modusene.
    const { getByTestId, queryByText, getByRole } = setup();
    fireEvent.click(getByTestId("travel-mode-header-control"));

    expect(queryByText("Alle tider er omtrentlige")).toBeNull();
    expect(getByRole("button", { name: /Bil/ }).textContent).not.toContain("min");
  });
});
