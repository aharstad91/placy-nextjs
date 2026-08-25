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

  it("tegner bygnings-glyph uten thumbnail, og bildet som CSS-bakgrunn med", () => {
    // Bildet legges som background-image, ikke som <img> — ingen ekstra node, og
    // ingen next/image-regel å bryte.
    const uten = render(<ProjectSitePin name="Test" />);
    expect(uten.container.querySelector("svg")).toBeTruthy(); // glyph
    cleanup();

    const med = render(
      <ProjectSitePin name="Test" imageSrc="data:image/png;base64,AAA" />,
    );
    expect(med.container.querySelector("img")).toBeNull();
    expect(med.container.innerHTML).toContain("data:image/png;base64,AAA");
    expect(med.container.querySelector("svg")).toBeNull(); // glyphen erstattes
  });

  it("navnet er EKTE tekst med hvit kontur, ikke en rasterisert SVG-node", () => {
    const { container } = render(<ProjectSitePin name="Strindfjordvegen 10" />);
    expect(container.querySelector("text")).toBeNull();
    const el = [...container.querySelectorAll("span")].find(
      (s) => s.textContent === "Strindfjordvegen 10",
    ) as HTMLElement | undefined;
    expect(el).toBeTruthy();
    expect(el!.style.textShadow).toContain("#ffffff");
  });

  it("boksen er KVADRATISK uansett navnelengde — det er dette som holder disc-en på punktet", () => {
    // `anchorLeft: -50%` er prosent av elementets egen boks. Vokser boksen med
    // teksten, vandrer disc-en bort fra punktet sitt. Den gamle SVG-en løste det
    // med en symmetrisk ramme, altså ved å betale for tomrom på motsatt side —
    // og det tomrommet er nettopp det `projectSitePinBlocker` ikke skal regne som
    // hindring. Feiler denne, har noen lagt teksten tilbake i flyten.
    const boxOf = (name: string) => {
      const { container } = render(<ProjectSitePin name={name} />);
      const el = container.querySelector("[data-project-pin]") as HTMLElement;
      const box = { w: el.style.width, h: el.style.height };
      cleanup();
      return box;
    };
    const kort = boxOf("Kort");
    const langt = boxOf("Et mye lengre prosjektnavn enn det");
    expect(kort).toEqual(langt);
    expect(kort.w).toBe(kort.h);
    expect(kort.w).toBe(`${DISC}px`);
  });

  it("skalerer boksen og teksten sammen", () => {
    const { container } = render(<ProjectSitePin name="Test" scale={0.5} />);
    const el = container.querySelector("[data-project-pin]") as HTMLElement;
    expect(el.style.width).toBe(`${DISC * 0.5}px`);
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
