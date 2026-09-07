import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { BoardMapControls } from "./BoardMapControls";

/**
 * Kontroll-pillen nederst på kart-flaten.
 *
 * Reisemåte og kartvisning er DROPDOWNS fra 2026-09-07 (var utbrettede
 * segmenter). Testene åpner derfor triggeren før de leter etter valgene — en
 * verdi som ikke er valgt, er ikke i DOM-en før panelet står åpent.
 */

afterEach(() => cleanup());

const baseProps = {
  view: "3d" as const,
  onViewChange: vi.fn(),
  cameraMode: "auto" as const,
  onCameraModeChange: vi.fn(),
};

const ALL_MODES = ["walk", "bike", "car"] as const;

/** Triggeren for en dropdown — begge har rolle button og kontrollens navn. */
const trigger = (
  container: HTMLElement,
  name: "Reisemåte" | "Kartvisning",
): HTMLButtonElement | null =>
  container.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);

describe("BoardMapControls — Auto/Fri-gating (voice-over-tier)", () => {
  it("viser Auto/Fri-segmentet i 3D når showCameraMode er på", () => {
    const { getByLabelText, container } = render(
      <BoardMapControls {...baseProps} showCameraMode />,
    );
    expect(getByLabelText(/Automatisk kamera/)).toBeTruthy();
    expect(getByLabelText(/Fri kamerakontroll/)).toBeTruthy();
    // Kartvisningen finnes alltid — som trigger, ikke som tre knapper.
    expect(trigger(container, "Kartvisning")).toBeTruthy();
  });

  it("skjuler Auto/Fri-segmentet på basic-tier (showCameraMode=false)", () => {
    const { queryByLabelText, container } = render(
      <BoardMapControls {...baseProps} showCameraMode={false} />,
    );
    expect(queryByLabelText(/Automatisk kamera/)).toBeNull();
    expect(queryByLabelText(/Fri kamerakontroll/)).toBeNull();
    expect(trigger(container, "Kartvisning")).toBeTruthy();
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

  it("står SIST i pillen — kameraet er det siste leddet i rekkefølgen", () => {
    const { container } = render(
      <BoardMapControls
        {...baseProps}
        showCameraMode
        travelModes={ALL_MODES}
        travelMode="walk"
        onTravelModeChange={vi.fn()}
      />,
    );
    // Pillens direkte barn er gruppene, med skilletegn mellom seg.
    const pill = container.querySelector("[data-testid='board-map-controls']")!;
    const groups = Array.from(pill.children).filter(
      (el) => !el.hasAttribute("aria-hidden"),
    );
    const labels = groups.map((el) =>
      el.getAttribute("aria-label") ??
      el.querySelector("[aria-label]")?.getAttribute("aria-label"),
    );
    expect(labels).toEqual(["Reisemåte", "Kartvisning", "Kameramodus"]);
  });
});

describe("BoardMapControls — kartvisningen (dropdown)", () => {
  it("triggeren viser visningen som er valgt nå", () => {
    const { container } = render(
      <BoardMapControls {...baseProps} view="sat" showCameraMode={false} />,
    );
    expect(trigger(container, "Kartvisning")!.textContent).toBe("Satelitt");
    cleanup();

    const { container: c2 } = render(
      <BoardMapControls {...baseProps} view="2d" showCameraMode={false} />,
    );
    expect(trigger(c2, "Kartvisning")!.textContent).toBe("Kart");
  });

  it("panelet er lukket til det åpnes — valgene finnes ikke i DOM-en før det", () => {
    const { queryByLabelText, container } = render(
      <BoardMapControls {...baseProps} showCameraMode={false} />,
    );
    expect(queryByLabelText("Satellitt ovenfra")).toBeNull();
    expect(trigger(container, "Kartvisning")!.getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("åpnet viser de tre visningene i rekkefølgen Kart, Satelitt, 3D", () => {
    const { container, getByLabelText, getByRole } = render(
      <BoardMapControls {...baseProps} showCameraMode={false} />,
    );
    fireEvent.click(trigger(container, "Kartvisning")!);
    expect(getByLabelText("2D-kart").textContent).toBe("Kart");
    expect(getByLabelText("Satellitt ovenfra").textContent).toBe("Satelitt");
    expect(getByLabelText("3D-kart").textContent).toBe("3D");
    const rows = Array.from(
      getByRole("group", { name: "Kartvisning" }).querySelectorAll("button"),
    );
    expect(rows.map((b) => b.textContent)).toEqual(["Kart", "Satelitt", "3D"]);
  });

  it("skiller Kart fra Satelitt/3D med en hårstrek (to kilder, tre visninger)", () => {
    const { container, getByRole } = render(
      <BoardMapControls {...baseProps} showCameraMode={false} />,
    );
    fireEvent.click(trigger(container, "Kartvisning")!);
    const kids = Array.from(getByRole("group", { name: "Kartvisning" }).children);
    // Strek mellom Kart og Satelitt — ingen strek mellom Satelitt og 3D, de
    // deler motor.
    expect(kids.map((el) => el.tagName.toLowerCase())).toEqual([
      "button",
      "span",
      "button",
      "button",
    ]);
    expect(kids[1].getAttribute("aria-hidden")).toBe("true");
    expect(kids[1].className).toContain("h-px");
    expect(kids[0].textContent).toBe("Kart");
    expect(kids[2].textContent).toBe("Satelitt");
  });

  it("klikk på Satelitt kaller onViewChange('sat') og lukker panelet", () => {
    const onViewChange = vi.fn();
    const { container, getByLabelText, queryByLabelText } = render(
      <BoardMapControls
        {...baseProps}
        onViewChange={onViewChange}
        showCameraMode={false}
      />,
    );
    fireEvent.click(trigger(container, "Kartvisning")!);
    fireEvent.click(getByLabelText("Satellitt ovenfra"));
    expect(onViewChange).toHaveBeenCalledWith("sat");
    expect(queryByLabelText("Satellitt ovenfra")).toBeNull();
  });

  it("markerer aktiv rad med aria-pressed", () => {
    const { container, getByLabelText } = render(
      <BoardMapControls {...baseProps} view="sat" showCameraMode={false} />,
    );
    fireEvent.click(trigger(container, "Kartvisning")!);
    expect(getByLabelText("Satellitt ovenfra").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(getByLabelText("3D-kart").getAttribute("aria-pressed")).toBe("false");
  });

  it("showViewToggle=false → ingen kartvisning i det hele tatt", () => {
    const { container } = render(
      <BoardMapControls {...baseProps} showCameraMode={false} showViewToggle={false} />,
    );
    expect(trigger(container, "Kartvisning")).toBeNull();
  });
});

describe("BoardMapControls — reisemåten (dropdown)", () => {
  it("triggeren viser modusen som er valgt nå", () => {
    const { container } = render(
      <BoardMapControls
        {...baseProps}
        showCameraMode={false}
        travelModes={ALL_MODES}
        travelMode="bike"
        onTravelModeChange={vi.fn()}
      />,
    );
    expect(trigger(container, "Reisemåte")!.textContent).toBe("Sykkel");
  });

  it("åpnet lister modusene, og klikk melder den videre", () => {
    const onTravelModeChange = vi.fn();
    const { container, getByRole } = render(
      <BoardMapControls
        {...baseProps}
        showCameraMode={false}
        travelModes={ALL_MODES}
        travelMode="walk"
        onTravelModeChange={onTravelModeChange}
      />,
    );
    fireEvent.click(trigger(container, "Reisemåte")!);
    fireEvent.click(getByRole("button", { name: /Bil/ }));
    expect(onTravelModeChange).toHaveBeenCalledWith("car");
    // Panelet lukket seg.
    expect(container.querySelector("[aria-label='Reisemåte'][role='group']")).toBeNull();
  });

  it("én modus er ikke et valg — ingen trigger (R6)", () => {
    const { container } = render(
      <BoardMapControls
        {...baseProps}
        showCameraMode={false}
        travelModes={["walk"]}
        travelMode="walk"
        onTravelModeChange={vi.fn()}
      />,
    );
    expect(trigger(container, "Reisemåte")).toBeNull();
  });

  it("står FØRST i pillen", () => {
    const { container } = render(
      <BoardMapControls
        {...baseProps}
        showCameraMode={false}
        travelModes={ALL_MODES}
        travelMode="walk"
        onTravelModeChange={vi.fn()}
      />,
    );
    const first = container.querySelectorAll("button")[0];
    expect(first.getAttribute("aria-label")).toBe("Reisemåte");
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

  it("står MELLOM reisemåten og kartvisningen — konturene er 5/10/15 min MED reisemåten, ikke et kartlag", () => {
    const { container } = render(
      <BoardMapControls
        {...baseProps}
        showCameraMode={false}
        showViewToggle
        travelModes={ALL_MODES}
        travelMode="walk"
        onTravelModeChange={vi.fn()}
        showContourToggle
        onContoursToggle={vi.fn()}
      />,
    );
    const labels = Array.from(container.querySelectorAll("button")).map((b) =>
      b.getAttribute("aria-label"),
    );
    expect(labels).toEqual([
      "Reisemåte",
      "Vis rekkevidde-konturer",
      "Kartvisning",
    ]);
  });

  it("er avslått når den VALGTE reisemåten mangler konturer, og sier hvorfor", () => {
    const { getByLabelText } = render(
      <BoardMapControls
        {...baseProps}
        showCameraMode={false}
        travelModes={ALL_MODES}
        travelMode="car"
        onTravelModeChange={vi.fn()}
        showContourToggle
        contourModes={["walk", "bike"]}
        onContoursToggle={vi.fn()}
      />,
    );
    const button = getByLabelText("Vis rekkevidde-konturer") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("title")).toBe("Ingen rekkevidde for bil");
  });

  it("er på når den valgte reisemåten HAR konturer", () => {
    const { getByLabelText } = render(
      <BoardMapControls
        {...baseProps}
        showCameraMode={false}
        travelModes={ALL_MODES}
        travelMode="walk"
        onTravelModeChange={vi.fn()}
        showContourToggle
        contourModes={["walk", "bike"]}
        onContoursToggle={vi.fn()}
      />,
    );
    const button = getByLabelText("Vis rekkevidde-konturer") as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("title")).toBeNull();
  });

  it("utelatt contourModes betyr «ikke oppgitt», ikke «ingen» — knappen er brukbar", () => {
    const { getByLabelText } = render(
      <BoardMapControls {...baseProps} showContourToggle onContoursToggle={vi.fn()} />,
    );
    expect((getByLabelText("Vis rekkevidde-konturer") as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("AE10: på et board uten 3D-tillegg vises knappen, men ikke kartvisningen", () => {
    const { getByLabelText, container } = render(
      <BoardMapControls
        {...baseProps}
        view="2d"
        showViewToggle={false}
        showContourToggle
        onContoursToggle={vi.fn()}
      />,
    );
    expect(getByLabelText("Vis rekkevidde-konturer")).toBeTruthy();
    expect(trigger(container, "Kartvisning")).toBeNull();
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
    expect(container.querySelectorAll("span.bg-stone-300\\/70")).toHaveLength(0);
    expect(container.querySelectorAll("button")).toHaveLength(1);
  });

  it("skilletegn mellom reisemåte og konturknapp når kartvisningen er borte", () => {
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

describe("BoardMapControls — ingen grupper, ingen pille", () => {
  it("returnerer null når alt er gated bort", () => {
    const { container } = render(
      <BoardMapControls
        {...baseProps}
        view="2d"
        showCameraMode={false}
        showViewToggle={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
