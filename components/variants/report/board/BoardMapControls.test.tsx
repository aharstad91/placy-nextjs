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

/**
 * Rekkevidde er en av/på-RAD inne i reisemåte-panelet fra 2026-09-07 — ikke en
 * knapp i baren. Den sto først som nabo, deretter som nabo i en felles kapsel;
 * begge leste som to uavhengige valg (Andreas: «de to kontrollene henger ikke
 * sammen, de er to separate»). Testene åpner derfor reisemåte-panelet først.
 */
const REACH_PROPS = {
  ...baseProps,
  view: "2d" as const,
  showViewToggle: false,
  showCameraMode: false,
  travelModes: ["walk", "bike", "car"] as const,
  travelMode: "walk" as const,
  onTravelModeChange: vi.fn(),
  showContourToggle: true,
  onContoursToggle: vi.fn(),
};

/** Åpner reisemåte-panelet og gir raden for rekkevidde (eller null). */
function openReach(container: HTMLElement): HTMLButtonElement | null {
  fireEvent.click(trigger(container, "Reisemåte")!);
  return container.querySelector<HTMLButtonElement>(
    "button[aria-label='Vis rekkevidde-konturer']",
  );
}

describe("BoardMapControls — rekkevidde-konturer", () => {
  it("raden finnes ikke uten konturer i dataene (AE3)", () => {
    const { container } = render(
      <BoardMapControls {...REACH_PROPS} showContourToggle={false} />,
    );
    expect(openReach(container)).toBeNull();
  });

  it("raden ligger INNE i reisemåte-panelet, ikke i baren", () => {
    /* Koblingen er plasseringen: du kan ikke slå rekkevidde på uten å se
       hvilken reisemåte den gjelder. */
    const { container } = render(<BoardMapControls {...REACH_PROPS} />);
    expect(
      container.querySelector("button[aria-label='Vis rekkevidde-konturer']"),
    ).toBeNull();
    expect(openReach(container)).toBeTruthy();
  });

  it("baren har ingen egen rekkevidde-knapp igjen — kun reisemåte og kartvisning", () => {
    const { container } = render(
      <BoardMapControls {...REACH_PROPS} showViewToggle />,
    );
    const labels = Array.from(container.querySelectorAll("button")).map((b) =>
      b.getAttribute("aria-label"),
    );
    expect(labels).toEqual(["Reisemåte", "Kartvisning"]);
  });

  it("melder av/på-tilstanden som aria-pressed og kaller handlingen ved klikk", () => {
    const onContoursToggle = vi.fn();
    const { container, rerender } = render(
      <BoardMapControls {...REACH_PROPS} onContoursToggle={onContoursToggle} />,
    );
    const row = openReach(container)!;
    expect(row.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(row);
    expect(onContoursToggle).toHaveBeenCalledTimes(1);

    rerender(
      <BoardMapControls
        {...REACH_PROPS}
        contoursOn
        onContoursToggle={onContoursToggle}
      />,
    );
    // Panelet lukkes IKKE av trykket: du vil se effekten mens du står i
    // kontrollen, og bytter ofte reisemåte rett etterpå.
    expect(
      container
        .querySelector("button[aria-label='Vis rekkevidde-konturer']")!
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("er avslått når den VALGTE reisemåten mangler konturer, og sier hvorfor", () => {
    const { container, getByText } = render(
      <BoardMapControls
        {...REACH_PROPS}
        travelMode="car"
        contourModes={["walk", "bike"]}
      />,
    );
    expect(openReach(container)!.disabled).toBe(true);
    expect(getByText("Ingen rekkevidde for bil.")).toBeTruthy();
  });

  it("er på når den valgte reisemåten HAR konturer", () => {
    const { container } = render(
      <BoardMapControls {...REACH_PROPS} contourModes={["walk", "bike"]} />,
    );
    expect(openReach(container)!.disabled).toBe(false);
  });

  it("utelatt contourModes betyr «ikke oppgitt», ikke «ingen» — raden er brukbar", () => {
    const { container } = render(<BoardMapControls {...REACH_PROPS} />);
    expect(openReach(container)!.disabled).toBe(false);
  });

  it("panelet finnes selv med ÉN reisemåte, så rekkevidde ikke blir unåbar", () => {
    /* Modus-lista rendres ikke under to moduser (R6), men bryteren må fortsatt
       ha et sted å bo. */
    const { container } = render(
      <BoardMapControls {...REACH_PROPS} travelModes={["walk"]} />,
    );
    expect(openReach(container)).toBeTruthy();
  });

  it("kollapset (mobil) bærer raden i popoveren", () => {
    const { getByLabelText, container } = render(
      <BoardMapControls {...REACH_PROPS} collapsed compact />,
    );
    fireEvent.click(getByLabelText("Kart-innstillinger"));
    expect(openReach(container)).toBeTruthy();
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

describe("BoardMapControls — koblingen reisemåte ⇄ rekkevidde", () => {
  /* Koblingen fantes ikke for brukeren: to knapper ved siden av hverandre, og
     ingenting som sa at «Til fots» ga ringene sine minutter (Andreas,
     2026-09-07). Nå sier tre ting det — plasseringen (raden bor under
     reisemåtene), linja under raden, og bildeteksten under pillen. */
  const REACH = {
    active: true,
    outsideIds: new Set(["a", "b"]),
    inside: 34,
    minutes: ["5", "10", "15"] as const,
  };

  const props = { ...REACH_PROPS, contoursOn: true };

  it("bildeteksten sier minuttene, reisemåten OG hvor mange som er innenfor", () => {
    const { getByTestId } = render(
      <BoardMapControls {...props} reach={{ ...REACH, minutes: [...REACH.minutes] }} />,
    );
    expect(getByTestId("reach-caption").textContent).toBe(
      "5, 10 og 15 min til fots — 34 steder innenfor",
    );
  });

  it("bildeteksten følger reisemåten, med riktig preposisjon", () => {
    const { getByTestId } = render(
      <BoardMapControls
        {...props}
        travelMode="bike"
        reach={{ ...REACH, minutes: [...REACH.minutes] }}
      />,
    );
    expect(getByTestId("reach-caption").textContent).toContain("min på sykkel");
  });

  it("bildeteksten nevner bare konturene som FINNES", () => {
    const { getByTestId } = render(
      <BoardMapControls {...props} reach={{ ...REACH, minutes: ["5", "10"] }} />,
    );
    expect(getByTestId("reach-caption").textContent).toContain("5 og 10 min");
  });

  it("ingen bildetekst når rekkevidde er av", () => {
    const { queryByTestId } = render(
      <BoardMapControls
        {...props}
        contoursOn={false}
        reach={{ ...REACH, minutes: [...REACH.minutes] }}
      />,
    );
    expect(queryByTestId("reach-caption")).toBeNull();
  });

  it("ingen bildetekst når reisemåten mangler konturer", () => {
    const { queryByTestId } = render(
      <BoardMapControls
        {...props}
        travelMode="bike"
        contourModes={["walk"]}
        reach={{ active: false, outsideIds: new Set(), inside: 0, minutes: [] }}
      />,
    );
    expect(queryByTestId("reach-caption")).toBeNull();
  });

  it("ingen bildetekst uten reach-prop (event-boardet)", () => {
    const { queryByTestId } = render(<BoardMapControls {...props} />);
    expect(queryByTestId("reach-caption")).toBeNull();
  });

  it("linja under raden sier tallet og reisemåten når rekkevidde er PÅ", () => {
    // Mobilens kollapsede variant har ingen ledig bunn-midt til bildeteksten,
    // så denne linja må stå alene.
    const { container, getByText } = render(
      <BoardMapControls {...props} reach={{ ...REACH, minutes: [...REACH.minutes] }} />,
    );
    openReach(container);
    expect(
      getByText(
        "5, 10 og 15 min til fots — 34 steder innenfor. Punkter utenfor blir blasse prikker.",
      ),
    ).toBeTruthy();
  });

  it("linja sier hva raden VIL gjøre når rekkevidde er av", () => {
    /* Den er av som standard, så dette er teksten de fleste ser først — den må
       forklare funksjonen, ikke beskrive et kart som ikke er tegnet. */
    const { container, getByText } = render(
      <BoardMapControls {...props} contoursOn={false} />,
    );
    openReach(container);
    expect(
      getByText(
        "Tegner 5, 10 og 15 min til fots i kartet, og demper stedene utenfor.",
      ),
    ).toBeTruthy();
  });
});
