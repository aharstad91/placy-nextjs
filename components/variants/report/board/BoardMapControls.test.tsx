import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
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

  it("skiller Kart fra Satelitt/3D med en vertikal strek (to kilder, tre visninger)", () => {
    const { getByRole } = render(
      <BoardMapControls {...baseProps} showCameraMode={false} />,
    );
    const group = getByRole("group", { name: "Kartvisning" });
    const kids = Array.from(group.children);
    // Strek mellom Kart og Satelitt — ingen strek mellom Satelitt og 3D, de
    // deler motor.
    expect(kids.map((el) => el.tagName.toLowerCase())).toEqual([
      "button",
      "span",
      "button",
      "button",
    ]);
    expect(kids[1].getAttribute("aria-hidden")).toBe("true");
    expect(kids[1].className).toContain("w-px");
    expect(kids[0].textContent).toBe("Kart");
    expect(kids[2].textContent).toBe("Satelitt");
  });

  it("kompenserer strekens margin for den fylte siden, med konstant bredde", () => {
    const sep = (view: "2d" | "sat" | "3d") => {
      const { container, unmount } = render(
        <BoardMapControls {...baseProps} view={view} showCameraMode={false} />,
      );
      const group = container.querySelector('[aria-label="Kartvisning"]')!;
      const el = group.children[1] as HTMLElement;
      const margins = [
        parseInt(el.style.marginLeft),
        parseInt(el.style.marginRight),
      ];
      unmount();
      return margins;
    };
    // Aktiv knapp fyller sin egen padding, så streken skyves bort fra den for å
    // se sentrert ut mellom labelene. Summen er alltid 16 → pillen holder bredden.
    expect(sep("sat")[0]).toBeLessThan(sep("sat")[1]);
    expect(sep("2d")[0]).toBeGreaterThan(sep("2d")[1]);
    expect(sep("3d")[0]).toBe(sep("3d")[1]);
    for (const v of ["2d", "sat", "3d"] as const) {
      const [l, r] = sep(v);
      expect(l + r).toBe(16);
    }
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

describe("BoardMapControls — rekkevidde-konturer", () => {
  it("knappen finnes ikke uten konturer i dataene (AE3)", () => {
    const { queryByLabelText } = render(
      <BoardMapControls {...baseProps} onContoursToggle={vi.fn()} />,
    );
    expect(queryByLabelText("Vis rekkevidde-konturer")).toBeNull();
  });

  it("knappen finnes når minst én reisemåte har konturer", () => {
    const { getByLabelText } = render(
      <BoardMapControls {...baseProps} showContourToggle onContoursToggle={vi.fn()} />,
    );
    expect(getByLabelText("Vis rekkevidde-konturer")).toBeTruthy();
  });

  it("melder av/på-tilstanden som aria-pressed og kaller handlingen ved klikk", () => {
    const onContoursToggle = vi.fn();
    const { getByLabelText, rerender } = render(
      <BoardMapControls {...baseProps} showContourToggle onContoursToggle={onContoursToggle} />,
    );
    const button = getByLabelText("Vis rekkevidde-konturer");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button);
    expect(onContoursToggle).toHaveBeenCalledTimes(1);

    rerender(
      <BoardMapControls
        {...baseProps}
        showContourToggle
        contoursOn
        onContoursToggle={onContoursToggle}
      />,
    );
    expect(getByLabelText("Vis rekkevidde-konturer").getAttribute("aria-pressed")).toBe("true");
  });

  it("står SIST i pillen, etter kartvisningen", () => {
    const { container } = render(
      <BoardMapControls
        {...baseProps}
        showViewToggle
        showContourToggle
        onContoursToggle={vi.fn()}
      />,
    );
    const labels = Array.from(container.querySelectorAll("button")).map((b) =>
      b.getAttribute("aria-label"),
    );
    expect(labels.indexOf("Vis rekkevidde-konturer")).toBe(labels.length - 1);
    expect(labels.indexOf("3D-kart")).toBeLessThan(labels.indexOf("Vis rekkevidde-konturer"));
  });

  it("AE10: på et board uten 3D-tillegg vises knappen, men ikke motorvalget", () => {
    const { getByLabelText, queryByLabelText } = render(
      <BoardMapControls
        {...baseProps}
        view="2d"
        showViewToggle={false}
        showContourToggle
        onContoursToggle={vi.fn()}
      />,
    );
    expect(getByLabelText("Vis rekkevidde-konturer")).toBeTruthy();
    expect(queryByLabelText("Satellitt ovenfra")).toBeNull();
  });

  it("konturknappen alene gir én pille uten ledende skilletegn", () => {
    const { container } = render(
      <BoardMapControls
        {...baseProps}
        view="2d"
        showViewToggle={false}
        showCameraMode={false}
        showContourToggle
        onContoursToggle={vi.fn()}
      />,
    );
    // Ingen divider skal stå foran den når den er den eneste kontrollen.
    expect(container.querySelectorAll("span.bg-stone-300\\/70")).toHaveLength(0);
    expect(container.querySelectorAll("button")).toHaveLength(1);
  });

  it("skilletegn mellom reisemåte og konturknapp når motorvalget er borte", () => {
    const { container } = render(
      <BoardMapControls
        {...baseProps}
        view="2d"
        showViewToggle={false}
        showCameraMode={false}
        travelModes={["walk", "bike"]}
        travelMode="walk"
        onTravelModeChange={vi.fn()}
        showContourToggle
        onContoursToggle={vi.fn()}
      />,
    );
    expect(container.querySelectorAll("span.bg-stone-300\\/70")).toHaveLength(1);
  });

  it("er ikon-bare på mobil — teksten dyttet pillen ut over kanten", () => {
    const { getByLabelText, rerender } = render(
      <BoardMapControls {...baseProps} showContourToggle onContoursToggle={vi.fn()} compact />,
    );
    expect(getByLabelText("Vis rekkevidde-konturer").textContent).toBe("");

    rerender(
      <BoardMapControls {...baseProps} showContourToggle onContoursToggle={vi.fn()} />,
    );
    expect(getByLabelText("Vis rekkevidde-konturer").textContent).toContain("Rekkevidde");
  });

  it("kollapset (mobil) bærer knappen i popoveren", () => {
    const { getByLabelText } = render(
      <BoardMapControls
        {...baseProps}
        collapsed
        compact
        showContourToggle
        onContoursToggle={vi.fn()}
      />,
    );
    // Åpne ⚙-popoveren, så skal konturknappen være nåbar der.
    fireEvent.click(getByLabelText("Kart-innstillinger"));
    expect(getByLabelText("Vis rekkevidde-konturer")).toBeTruthy();
  });
});
