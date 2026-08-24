import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { BoardMapControls } from "./BoardMapControls";

const baseProps = {
  view: "3d" as const,
  onViewChange: vi.fn(),
  cameraMode: "auto" as const,
  onCameraModeChange: vi.fn(),
};

describe("BoardMapControls — Auto/Fri-gating (voice-over-tier)", () => {
  it("viser Auto/Fri-segmentet i 3D når showCameraMode er på", () => {
    const { getByLabelText } = render(
      <BoardMapControls {...baseProps} showCameraMode />,
    );
    // Begge kameramodus-knappene finnes via aria-label.
    expect(getByLabelText(/Automatisk kamera/)).toBeTruthy();
    expect(getByLabelText(/Fri kamerakontroll/)).toBeTruthy();
    // Motor-byttet finnes alltid.
    expect(getByLabelText("3D-kart")).toBeTruthy();
  });

  it("skjuler Auto/Fri-segmentet på basic-tier (showCameraMode=false) — kun Kart/3D", () => {
    const { queryByLabelText, getByLabelText } = render(
      <BoardMapControls {...baseProps} showCameraMode={false} />,
    );
    expect(queryByLabelText(/Automatisk kamera/)).toBeNull();
    expect(queryByLabelText(/Fri kamerakontroll/)).toBeNull();
    // Kart/3D blir stående.
    expect(getByLabelText("2D-kart")).toBeTruthy();
    expect(getByLabelText("3D-kart")).toBeTruthy();
  });

  it("skjuler recovery-hinten på basic-tier selv når showFreeHint er satt", () => {
    const { queryByRole } = render(
      <BoardMapControls {...baseProps} showCameraMode={false} showFreeHint />,
    );
    // Recovery-hinten har role=status og peker på en Auto-knapp som ikke finnes.
    expect(queryByRole("status")).toBeNull();
  });

  it("skjuler Auto/Fri i 2D uansett (segmentet er 3D-only)", () => {
    const { queryByLabelText } = render(
      <BoardMapControls {...baseProps} view="2d" showCameraMode />,
    );
    expect(queryByLabelText(/Automatisk kamera/)).toBeNull();
  });

  it("skjuler Auto/Fri i Satelitt (R4 — auto-orbit er av, nord opp er posituren)", () => {
    const { queryByLabelText } = render(
      <BoardMapControls {...baseProps} view="sat" showCameraMode />,
    );
    expect(queryByLabelText(/Automatisk kamera/)).toBeNull();
    expect(queryByLabelText(/Fri kamerakontroll/)).toBeNull();
  });
});

describe("BoardMapControls — kart-veksleren (Kart | Satelitt | 3D)", () => {
  it("rendrer tre segmenter med riktige labels/aria i rekkefølgen Kart, Satelitt, 3D", () => {
    const { getByLabelText, getAllByRole } = render(
      <BoardMapControls {...baseProps} showCameraMode={false} />,
    );
    expect(getByLabelText("2D-kart").textContent).toBe("Kart");
    expect(getByLabelText("Satellitt ovenfra").textContent).toBe("Satelitt");
    expect(getByLabelText("3D-kart").textContent).toBe("3D");
    const labels = getAllByRole("button").map((b) => b.textContent);
    expect(labels.slice(-3)).toEqual(["Kart", "Satelitt", "3D"]);
  });

  it("klikk på Satelitt kaller onViewChange('sat')", () => {
    const onViewChange = vi.fn();
    const { getByLabelText } = render(
      <BoardMapControls
        {...baseProps}
        onViewChange={onViewChange}
        showCameraMode={false}
      />,
    );
    getByLabelText("Satellitt ovenfra").click();
    expect(onViewChange).toHaveBeenCalledWith("sat");
  });

  it("markerer aktivt segment med aria-pressed når view er 'sat'", () => {
    const { getByLabelText } = render(
      <BoardMapControls {...baseProps} view="sat" showCameraMode={false} />,
    );
    expect(getByLabelText("Satellitt ovenfra").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(getByLabelText("3D-kart").getAttribute("aria-pressed")).toBe("false");
  });

  it("showViewToggle=false → ingen veksler-segmenter (boards uten 3D-tillegg)", () => {
    const { queryByLabelText } = render(
      <BoardMapControls {...baseProps} showCameraMode={false} showViewToggle={false} />,
    );
    expect(queryByLabelText("2D-kart")).toBeNull();
    expect(queryByLabelText("Satellitt ovenfra")).toBeNull();
    expect(queryByLabelText("3D-kart")).toBeNull();
  });
});
