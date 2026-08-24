import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import {
  ProjectSitePin,
  projectSitePinBlocker,
  PROJECT_PIN_DEFAULT_SUBTITLE,
} from "./ProjectSitePin";

afterEach(cleanup);

/** Disc-diameteren i ProjectSitePin. Halve den er markørens venstre utstrekning. */
const DISC = 52;

describe("ProjectSitePin — rendring", () => {
  it("viser prosjektnavnet", () => {
    const { container } = render(<ProjectSitePin name="Testprosjektet" />);
    expect(container.textContent).toContain("Testprosjektet");
  });

  it("viser default-undertittelen når ingen er oppgitt", () => {
    const { container } = render(<ProjectSitePin name="Testprosjektet" />);
    expect(container.textContent).toContain(PROJECT_PIN_DEFAULT_SUBTITLE);
  });

  it("viser oppgitt undertittel i stedet for defaulten", () => {
    const { container } = render(
      <ProjectSitePin name="Testprosjektet" subtitle="Innflytting 2029" />,
    );
    expect(container.textContent).toContain("Innflytting 2029");
    expect(container.textContent).not.toContain(PROJECT_PIN_DEFAULT_SUBTITLE);
  });

  it("tegner bygnings-glyph uten thumbnail, og bildet med", () => {
    const uten = render(<ProjectSitePin name="Test" />);
    expect(uten.container.querySelector("image")).toBeNull();
    cleanup();

    const med = render(
      <ProjectSitePin name="Test" imageSrc="data:image/png;base64,AAA" />,
    );
    expect(med.container.querySelector("image")).toBeTruthy();
  });

  it("SVG-rammen er symmetrisk, så disc-en står på punktet uansett navnelengde", () => {
    // Rammen vokser like mye på begge sider når teksten blir lengre. Det er
    // NETTOPP derfor hindringsboksen må regnes separat (se blocker-testene):
    // rammen beskriver ikke hvor det faktisk står noe.
    const discCx = (name: string) => {
      const { container } = render(<ProjectSitePin name={name} />);
      const svg = container.querySelector("svg")!;
      const circle = container.querySelector("circle")!;
      const halfBox = Number(svg.getAttribute("width")) / 2;
      const cx = Number(circle.getAttribute("cx"));
      cleanup();
      return { cx, halfBox };
    };
    const kort = discCx("Kort");
    const langt = discCx("Et mye lengre prosjektnavn");
    expect(kort.cx).toBeCloseTo(kort.halfBox, 5);
    expect(langt.cx).toBeCloseTo(langt.halfBox, 5);
    expect(langt.halfBox).toBeGreaterThan(kort.halfBox);
  });
});

describe("projectSitePinBlocker — asymmetrisk hindring", () => {
  it("venstre kant er disc-radien, ikke tekstbredden", () => {
    // Regresjonstest for feilen der den symmetriske SVG-rammen ble brukt som
    // hindring: teksten ble speilet inn i tomrommet til venstre for disc-en og
    // demoterte POI-er der det ikke sto noe.
    const b = projectSitePinBlocker("Strindfjordvegen 10", undefined, 1);
    const left = b.dx - b.halfWidth;
    expect(left).toBeCloseTo(-DISC / 2, 5);
  });

  it("høyre kant strekker seg forbi disc-en, så teksten er dekket", () => {
    const b = projectSitePinBlocker("Strindfjordvegen 10", undefined, 1);
    const right = b.dx + b.halfWidth;
    expect(right).toBeGreaterThan(DISC / 2);
  });

  it("boksen er bredere for et langt navn enn for et kort", () => {
    const kort = projectSitePinBlocker("Nav", undefined, 1);
    const langt = projectSitePinBlocker("Et mye lengre prosjektnavn", undefined, 1);
    expect(langt.halfWidth).toBeGreaterThan(kort.halfWidth);
    // Venstre kant flytter seg IKKE — bare høyre.
    expect(langt.dx - langt.halfWidth).toBeCloseTo(kort.dx - kort.halfWidth, 5);
  });

  it("strekker seg oppover fra ankeret (bunn-midten)", () => {
    const b = projectSitePinBlocker("Test", undefined, 1);
    expect(b.dy).toBeLessThan(0);
    // Boksen er nøyaktig disc-høy, og toppkanten ligger en hel disc over ankeret.
    expect(b.halfHeight).toBeCloseTo(DISC / 2, 5);
    expect(b.dy - b.halfHeight).toBeCloseTo(-DISC, 5);
  });

  it("undefined undertittel gir samme boks som komponentens default", () => {
    // Feilen dette fanger: hindringen og komponenten hadde hver sin
    // parameter-default, så de kunne drifte fra hverandre.
    const implisitt = projectSitePinBlocker("Nav", undefined, 1);
    const eksplisitt = projectSitePinBlocker(
      "Nav",
      PROJECT_PIN_DEFAULT_SUBTITLE,
      1,
    );
    expect(implisitt).toEqual(eksplisitt);
  });

  it("tom undertittel reserverer ikke plass til en", () => {
    // Med et kort navn er det undertittelen som setter bredden.
    const med = projectSitePinBlocker("Nav", PROJECT_PIN_DEFAULT_SUBTITLE, 1);
    const uten = projectSitePinBlocker("Nav", "", 1);
    expect(uten.halfWidth).toBeLessThan(med.halfWidth);
  });

  it("skalerer alle fire målene", () => {
    const full = projectSitePinBlocker("Testprosjektet", undefined, 1);
    const halv = projectSitePinBlocker("Testprosjektet", undefined, 0.5);
    expect(halv.dx).toBeCloseTo(full.dx / 2, 5);
    expect(halv.dy).toBeCloseTo(full.dy / 2, 5);
    expect(halv.halfWidth).toBeCloseTo(full.halfWidth / 2, 5);
    expect(halv.halfHeight).toBeCloseTo(full.halfHeight / 2, 5);
  });

  it("klamper tekstbredden, så et absurd langt navn ikke dekker hele skjermen", () => {
    const langt = projectSitePinBlocker("A".repeat(200), undefined, 1);
    const rimelig = projectSitePinBlocker("A".repeat(30), undefined, 1);
    expect(langt.halfWidth).toBeCloseTo(rimelig.halfWidth, 5);
  });
});
