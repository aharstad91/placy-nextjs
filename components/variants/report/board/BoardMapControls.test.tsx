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
});
