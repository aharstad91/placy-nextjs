import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { PoiMarkerContent, PIN_SIZE, DOT_SIZE } from "./PoiMarkerContent";
import {
  LABEL_FONT_SIZE,
  LABEL_GAP_X,
  LABEL_MAX_LINES,
  LABEL_MAX_W,
} from "@/lib/board/label-collision";

afterEach(cleanup);

/** Ikon-stub som fanger width-propen. */
const StubIcon = ((props: { width?: number }) => (
  <svg data-testid="picon" data-w={props.width} />
)) as unknown as PhosphorIcon;

const base = {
  color: "#0a7",
  backgroundColor: "#e6f7f1",
  Icon: StubIcon,
};

const host = (c: HTMLElement) =>
  c.querySelector("[data-poi-marker]") as HTMLElement;
const label = (c: HTMLElement) =>
  c.querySelector("[data-poi-label]") as HTMLElement | null;

describe("PoiMarkerContent — boksen holder seg kvadratisk", () => {
  // Dette er testen som beskytter ankeret. `anchorLeft: -50%` er prosent av
  // ELEMENTETS EGEN boks, så vokser boksen med teksten, vandrer disc-en bort fra
  // punktet sitt — og hopper motsatt vei når labelen flipper side. Feiler denne,
  // har noen lagt labelen tilbake i flyten.
  const cases: [string, Parameters<typeof PoiMarkerContent>[0]][] = [
    ["uten label", { ...base }],
    ["med kort label", { ...base, label: "Nille" }],
    ["med lang label", { ...base, label: "Grillstadfjæra barnehage og skole" }],
    ["label til venstre", { ...base, label: "Sjøparken", labelSide: "left" }],
    ["som prikk", { ...base, compact: true }],
    ["med badge", { ...base, number: 3, label: "Extra Grilstad" }],
    ["som anker", { ...base, anchor: true, label: "Sirkus Shopping" }],
  ];

  for (const [navn, props] of cases) {
    it(`boksen er ${PIN_SIZE}×${PIN_SIZE} — ${navn}`, () => {
      const { container } = render(<PoiMarkerContent {...props} />);
      const el = host(container);
      expect(el.style.width).toBe(`${PIN_SIZE}px`);
      expect(el.style.height).toBe(`${PIN_SIZE}px`);
      expect(el.style.position).toBe("relative");
    });
  }

  it("labelen ligger utenfor flyten (absolute), ikke ved siden av disc-en", () => {
    const { container } = render(<PoiMarkerContent {...base} label="Nille" />);
    expect(label(container)!.style.position).toBe("absolute");
  });
});

describe("PoiMarkerContent — label", () => {
  it("uten label finnes ingen tekstnode", () => {
    const { container } = render(<PoiMarkerContent {...base} />);
    expect(label(container)).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("med label er navnet EKTE tekst i DOM — hele poenget med byttet", () => {
    const { container } = render(
      <PoiMarkerContent {...base} label="Grillstadfjæra" />,
    );
    expect(label(container)!.textContent).toBe("Grillstadfjæra");
    // Ingen SVG-tekst, ingen template: teksten skal rendres av nettleseren.
    expect(container.querySelector("template")).toBeNull();
    expect(container.querySelector("text")).toBeNull();
  });

  it("default-siden er høyre; venstre ankres fra motsatt kant", () => {
    const h = render(<PoiMarkerContent {...base} label="Nille" />);
    expect(label(h.container)!.style.left).not.toBe("");
    expect(label(h.container)!.style.right).toBe("");
    cleanup();

    const v = render(
      <PoiMarkerContent {...base} label="Nille" labelSide="left" />,
    );
    expect(label(v.container)!.style.right).not.toBe("");
    expect(label(v.container)!.style.left).toBe("");
  });

  it("labelen starter utenfor disc-kanten på begge sider", () => {
    const h = render(<PoiMarkerContent {...base} label="Nille" />);
    expect(parseFloat(label(h.container)!.style.left)).toBeGreaterThanOrEqual(
      PIN_SIZE,
    );
    cleanup();
    const v = render(
      <PoiMarkerContent {...base} label="Nille" labelSide="left" />,
    );
    expect(parseFloat(label(v.container)!.style.right)).toBeGreaterThanOrEqual(
      PIN_SIZE,
    );
  });

  it("et svært langt navn klippes i stedet for å bre seg ubegrenset", () => {
    const { container } = render(
      <PoiMarkerContent
        {...base}
        label="Et absurd langt stedsnavn som aldri ville fått plass på et kart"
      />,
    );
    const el = label(container)!;
    expect(el.style.maxWidth).not.toBe("");
    expect(el.style.overflow).toBe("hidden");
    expect(el.style.webkitLineClamp).toBe(String(LABEL_MAX_LINES));
  });

  it("labelen har hvit kontur — underlaget er satellittfoto, ikke lyst kart", () => {
    const { container } = render(<PoiMarkerContent {...base} label="Nille" />);
    expect(label(container)!.style.textShadow).toContain("#ffffff");
  });

  it("labelen stjeler ikke kart-gester", () => {
    // DOM-markøren tar over hit-testingen fra canvaset, så en label med
    // pointer-events ville utvidet treffflaten langt utover disc-en.
    const { container } = render(<PoiMarkerContent {...base} label="Nille" />);
    expect(label(container)!.style.pointerEvents).toBe("none");
  });
});

describe("PoiMarkerContent — disc, ikon og prikk", () => {
  it("ikon-ratio er 0,50 (halve disc-en), som 2D og lista", () => {
    const { getByTestId } = render(<PoiMarkerContent {...base} />);
    expect(getByTestId("picon").getAttribute("data-w")).toBe(
      String(PIN_SIZE / 2),
    );
  });

  it("disc-en bruker kategorifargen som ring og tinten som bakgrunn", () => {
    const { container } = render(<PoiMarkerContent {...base} />);
    const disc = host(container).firstElementChild as HTMLElement;
    // jsdom normaliserer hex til rgb(), så assertér på den formen.
    expect(disc.style.border).toBe("2px solid rgb(0, 170, 119)");
    expect(disc.style.background).toBe("rgb(230, 247, 241)");
  });

  it("compact tegner prikken og ingen disc eller ikon", () => {
    const { container, queryByTestId } = render(
      <PoiMarkerContent {...base} compact />,
    );
    expect(queryByTestId("picon")).toBeNull();
    const dot = host(container).firstElementChild as HTMLElement;
    expect(dot.style.width).toBe(`${DOT_SIZE}px`);
    expect(dot.style.borderRadius).toBe("50%");
  });

  it("prikken beholder en label hvis den får en — teksten er kullet oppstrøms", () => {
    // Utglisningen sender aldri label til en demotert markør, men komponenten
    // skal ikke ha en egen skjult regel som gjør det umulig å se hvis den gjør.
    const { container } = render(
      <PoiMarkerContent {...base} compact label="Nille" />,
    );
    expect(label(container)).not.toBeNull();
  });

  it("badge vises bare når number er satt", () => {
    const uten = render(<PoiMarkerContent {...base} />);
    expect(uten.container.textContent).toBe("");
    cleanup();
    const med = render(<PoiMarkerContent {...base} number={3} />);
    expect(med.container.textContent).toContain("3");
  });
});

describe("PoiMarkerContent — zoom-skalaen", () => {
  // Skalaen finnes fordi 10 px navn ble uleselig på gatezoom: der er markøren
  // den eneste teksten på en satellittflate uten stedsnavn. Den ganger derfor
  // HELE markøren — det var teksten som var problemet, ikke skiva.
  it("scale 1 er default og endrer ingenting", () => {
    const uten = render(<PoiMarkerContent {...base} label="Nille" />);
    const html = uten.container.innerHTML;
    cleanup();
    const med = render(<PoiMarkerContent {...base} label="Nille" scale={1} />);
    expect(med.container.innerHTML).toBe(html);
  });

  it("boksen vokser med skalaen — ankeret er prosent av den, så pinnen står", () => {
    const { container } = render(<PoiMarkerContent {...base} scale={1.45} />);
    const el = host(container);
    expect(el.style.width).toBe(`${Math.round(PIN_SIZE * 1.45)}px`);
    expect(el.style.height).toBe(el.style.width);
  });

  it("ikonet beholder ratio 0,50 av den SKALERTE disc-en", () => {
    const { getByTestId } = render(
      <PoiMarkerContent {...base} scale={1.5} />,
    );
    expect(getByTestId("picon").getAttribute("data-w")).toBe(
      String(Math.round(PIN_SIZE * 1.5) / 2),
    );
  });

  it("navnet skaleres — font, linjehøyde, maksbredde og luften til disc-en", () => {
    const { container } = render(
      <PoiMarkerContent {...base} label="Nille" scale={1.5} />,
    );
    const el = label(container)!;
    expect(el.style.fontSize).toBe(`${LABEL_FONT_SIZE * 1.5}px`);
    expect(el.style.maxWidth).toBe(`${LABEL_MAX_W * 1.5}px`);
    expect(el.style.left).toBe(
      `${Math.round(PIN_SIZE * 1.5) + LABEL_GAP_X * 1.5}px`,
    );
  });

  it("venstre-label måler fra samme skalerte kant", () => {
    const { container } = render(
      <PoiMarkerContent {...base} label="Nille" labelSide="left" scale={1.25} />,
    );
    const el = label(container)!;
    expect(el.style.right).toBe(
      `${Math.round(PIN_SIZE * 1.25) + LABEL_GAP_X * 1.25}px`,
    );
    expect(el.style.left).toBe("");
  });

  it("prikken skalerer også — ellers vokser pinsene fra teksturen rundt dem", () => {
    const { container } = render(
      <PoiMarkerContent {...base} compact scale={1.45} />,
    );
    const dot = host(container).firstElementChild as HTMLElement;
    const d = Math.round(DOT_SIZE * 1.45);
    expect(dot.style.width).toBe(`${d}px`);
    expect(dot.style.marginLeft).toBe(`${-d / 2}px`);
  });

  it("størrelsen har en overgang — trinnene ved kamera-ro skal ikke hoppe", () => {
    const { container } = render(<PoiMarkerContent {...base} scale={1.2} />);
    expect(host(container).style.transition).toContain("width");
  });
});

describe("PoiMarkerContent — anker-modus", () => {
  const badge = (c: HTMLElement) =>
    c.querySelector("[data-poi-badge]") as HTMLElement | null;

  it("kjøpesenteret får et «+», ikke et tall", () => {
    // Tallet er FINN-mønsteret vi forkastet: det forutsetter likeverdige
    // objekter, og for en boligkjøper betyr «60» ingenting. `+` sier at det er
    // mer her inne uten å påstå hvor mye.
    const { container } = render(<PoiMarkerContent {...base} anchor />);
    expect(badge(container)?.textContent).toBe("+");
    expect(badge(container)?.getAttribute("data-poi-badge")).toBe("anchor");
  });

  it("et eksplisitt tall vinner over «+» — turrekkefølge overskrives ikke", () => {
    const { container } = render(<PoiMarkerContent {...base} anchor number={3} />);
    expect(badge(container)?.textContent).toBe("3");
  });

  it("uten anker og uten tall er det ingen badge", () => {
    const { container } = render(<PoiMarkerContent {...base} />);
    expect(badge(container)).toBeNull();
  });

  it("ankeret beholder kategori-ikonet — ingen ny elementtype", () => {
    const { container } = render(<PoiMarkerContent {...base} anchor />);
    expect(container.querySelector("[data-testid=picon]")).not.toBeNull();
  });

  it("prikk-modus har ingen badge — en demotert markør bærer ingen påstand", () => {
    // I praksis demoteres et anker aldri (Infinity-prioritet), men global
    // compact (story-mode-peek på mobil) gjør ALT til prikker.
    const { container } = render(<PoiMarkerContent {...base} anchor compact />);
    expect(badge(container)).toBeNull();
  });
});
