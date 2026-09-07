import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { Footprints } from "lucide-react";
import { ControlDropdown, ControlPanelRow } from "./ControlDropdown";

/**
 * Trigger + panel — kontroll-språket kart-pillen og enheten over
 * minutt-kolonnen deler. Testene her dekker MEKANIKKEN (åpne, lukke, retning,
 * takhøyde); hva radene inneholder er hver kallers egen sak.
 */

afterEach(() => cleanup());

const setup = (props: Partial<Parameters<typeof ControlDropdown>[0]> = {}) =>
  render(
    <ControlDropdown
      variant="bar"
      icon={Footprints}
      label="Til fots"
      ariaLabel="Reisemåte"
      {...props}
    >
      {(close) => (
        <button type="button" onClick={close}>
          Velg
        </button>
      )}
    </ControlDropdown>,
  );

describe("ControlDropdown", () => {
  it("viser etiketten for det som er valgt nå, og melder kontrollens navn", () => {
    const { getByRole } = setup();
    const button = getByRole("button", { name: "Reisemåte" });
    expect(button.textContent).toBe("Til fots");
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("panelet finnes ikke i DOM-en før det åpnes", () => {
    const { queryByText, getByRole } = setup();
    expect(queryByText("Velg")).toBeNull();
    fireEvent.click(getByRole("button", { name: "Reisemåte" }));
    expect(queryByText("Velg")).toBeTruthy();
    expect(getByRole("button", { name: "Reisemåte" }).getAttribute("aria-expanded")).toBe(
      "true",
    );
  });

  it("nytt trykk på triggeren lukker igjen", () => {
    const { queryByText, getByRole } = setup();
    const button = getByRole("button", { name: "Reisemåte" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(queryByText("Velg")).toBeNull();
  });

  it("`close` sendt til radene lukker panelet", () => {
    const { queryByText, getByRole, getByText } = setup();
    fireEvent.click(getByRole("button", { name: "Reisemåte" }));
    fireEvent.click(getByText("Velg"));
    expect(queryByText("Velg")).toBeNull();
  });

  it("trykk utenfor lukker uten å velge", () => {
    const { queryByText, getByRole } = setup();
    fireEvent.click(getByRole("button", { name: "Reisemåte" }));
    fireEvent.pointerDown(document.body);
    expect(queryByText("Velg")).toBeNull();
  });

  it("trykk INNI panelet lukker ikke", () => {
    const { queryByText, getByRole, getByText } = setup();
    fireEvent.click(getByRole("button", { name: "Reisemåte" }));
    fireEvent.pointerDown(getByText("Velg"));
    expect(queryByText("Velg")).toBeTruthy();
  });

  it("Escape lukker", () => {
    const { queryByText, getByRole } = setup();
    fireEvent.click(getByRole("button", { name: "Reisemåte" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(queryByText("Velg")).toBeNull();
  });

  it("closeKey som endrer seg lukker — et åpent panel skal ikke overleve ny kontekst", () => {
    const { queryByText, getByRole, rerender } = render(
      <ControlDropdown
        variant="bar"
        icon={Footprints}
        label="Til fots"
        ariaLabel="Reisemåte"
        closeKey="poi-1"
      >
        {() => <button type="button">Velg</button>}
      </ControlDropdown>,
    );
    fireEvent.click(getByRole("button", { name: "Reisemåte" }));
    expect(queryByText("Velg")).toBeTruthy();

    rerender(
      <ControlDropdown
        variant="bar"
        icon={Footprints}
        label="Til fots"
        ariaLabel="Reisemåte"
        closeKey="poi-2"
      >
        {() => <button type="button">Velg</button>}
      </ControlDropdown>,
    );
    expect(queryByText("Velg")).toBeNull();
  });

  it("folder OPP i pillen og NED i en overskrift", () => {
    const { container, getByRole } = setup({ direction: "up" });
    fireEvent.click(getByRole("button", { name: "Reisemåte" }));
    expect(container.querySelector(".bottom-full")).toBeTruthy();
    cleanup();

    const { container: c2, getByRole: r2 } = setup({ direction: "down" });
    fireEvent.click(r2("button", { name: "Reisemåte" }));
    expect(c2.querySelector(".top-full")).toBeTruthy();
  });

  it("måler takhøyden mot flaten som klipper, så siste rad ikke blir borte", () => {
    const { container, getByRole } = render(
      <div data-testid="clip">
        <ControlDropdown
          variant="header"
          icon={Footprints}
          label="Til fots"
          ariaLabel="Reisemåte"
          direction="down"
          clipSelector="[data-testid='clip']"
        >
          {() => <button type="button">Velg</button>}
        </ControlDropdown>
      </div>,
    );
    // jsdom gir 0 på alle rektangler, så rommet blir negativt og gulvet (96px)
    // slår inn. Poenget testen holder: taket SETTES når en klippende flate
    // finnes — uten den ville panelet vokst fritt og blitt kuttet av sheeten.
    fireEvent.click(getByRole("button", { name: "Reisemåte" }));
    const panel = container.querySelector<HTMLElement>(".top-full")!;
    expect(panel.style.maxHeight).toBe("96px");
  });

  it("uten clipSelector settes ingen takhøyde", () => {
    const { container, getByRole } = setup({ direction: "down" });
    fireEvent.click(getByRole("button", { name: "Reisemåte" }));
    const panel = container.querySelector<HTMLElement>(".top-full")!;
    expect(panel.style.maxHeight).toBe("");
  });
});

describe("ControlPanelRow", () => {
  it("melder valgt tilstand som aria-pressed", () => {
    const { getByRole } = render(
      <ControlPanelRow icon={Footprints} label="Til fots" active onClick={vi.fn()} />,
    );
    expect(getByRole("button").getAttribute("aria-pressed")).toBe("true");
  });

  it("meta-kolonnen rendres bare når den finnes", () => {
    const { getByRole, rerender } = render(
      <ControlPanelRow icon={Footprints} label="Til fots" active={false} onClick={vi.fn()} />,
    );
    expect(getByRole("button").textContent).toBe("Til fots");

    rerender(
      <ControlPanelRow
        icon={Footprints}
        label="Til fots"
        active={false}
        meta="8 min"
        onClick={vi.fn()}
      />,
    );
    expect(getByRole("button").textContent).toBe("Til fots8 min");
  });

  it("aria-label overstyrer etiketten når etiketten ikke er nok alene", () => {
    const { getByRole } = render(
      <ControlPanelRow
        icon={Footprints}
        label="Satelitt"
        ariaLabel="Satellitt ovenfra"
        active={false}
        onClick={vi.fn()}
      />,
    );
    expect(getByRole("button", { name: "Satellitt ovenfra" })).toBeTruthy();
  });
});
