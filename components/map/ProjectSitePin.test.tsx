import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectSitePin } from "@/components/map/ProjectSitePin";

/**
 * Regresjonsvakt for BOARDETS prosjektmarkør.
 *
 * Porteføljekartet la til tone, valgt-tilstand, navn-bryter og hover på denne
 * komponenten. Utvidelsen skulle være additiv: kalt slik boardet kaller den —
 * bare navn, undertittel og skala — må markøren se ut og oppføre seg akkurat
 * som før, og særlig forbli IKKE-interaktiv.
 */
describe("ProjectSitePin med boardets props", () => {
  function renderBoardPin() {
    const { container } = render(
      <ProjectSitePin name="Wesselsløkka" subtitle="Nybygg 2028" scale={0.85} />,
    );
    return container.querySelector("[data-project-pin]") as HTMLElement;
  }

  it("viser navn og undertittel", () => {
    renderBoardPin();
    expect(screen.getByText("Wesselsløkka")).toBeTruthy();
    expect(screen.getByText("Nybygg 2028")).toBeTruthy();
  });

  it("beholder aksent-gløden og legger ingen markeringsring til", () => {
    const pin = renderBoardPin();
    // Gløden + disc-en = to spans før tekstblokken. En markeringsring ville
    // vært en tredje.
    const rings = pin.querySelectorAll(":scope > span");
    expect(rings).toHaveLength(3); // glød, disc, tekstblokk
  });

  it("er ikke klikkbar", () => {
    const pin = renderBoardPin();
    expect(pin.style.cursor).toBe("");
  });

  it("melder ikke hover", async () => {
    const pin = renderBoardPin();
    // Ingen handlere registrert → et pekerbesøk gjør ingenting. Vi verifiserer
    // at komponenten ikke kaster og at ingenting endrer seg.
    await userEvent.hover(pin);
    expect(pin.style.cursor).toBe("");
  });
});

describe("ProjectSitePin i porteføljemodus", () => {
  it("tegner disc uten navn når showName er false", () => {
    render(
      <ProjectSitePin name="Berg Hageby" subtitle="Trondheim" showName={false} />,
    );
    expect(screen.queryByText("Berg Hageby")).toBeNull();
  });

  it("dropper aksent-gløden i muted-tilstand", () => {
    const { container } = render(
      <ProjectSitePin name="Berg Hageby" tone="muted" showName={false} />,
    );
    const pin = container.querySelector("[data-project-pin]")!;
    expect(pin.querySelectorAll(":scope > span")).toHaveLength(1); // bare disc
  });

  it("legger en markeringsring på valgt chip", () => {
    const { container } = render(
      <ProjectSitePin name="Berg Hageby" tone="muted" selected showName={false} />,
    );
    const pin = container.querySelector("[data-project-pin]")!;
    expect(pin.querySelectorAll(":scope > span")).toHaveLength(2); // ring + disc
  });

  it("melder hover og viser peker når den er klikkbar", async () => {
    const onHoverChange = vi.fn();
    const { container } = render(
      <ProjectSitePin
        name="Berg Hageby"
        showName={false}
        clickable
        onHoverChange={onHoverChange}
      />,
    );
    const pin = container.querySelector("[data-project-pin]") as HTMLElement;
    expect(pin.style.cursor).toBe("pointer");

    await userEvent.hover(pin);
    expect(onHoverChange).toHaveBeenCalledWith(true);
    await userEvent.unhover(pin);
    expect(onHoverChange).toHaveBeenCalledWith(false);
  });
});
