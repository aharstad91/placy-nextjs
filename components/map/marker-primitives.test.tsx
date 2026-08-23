import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { Marker3DPin } from "./Marker3DPin";
import { BlobMarker3D } from "./BlobMarker3D";

afterEach(cleanup);

// Ikon-stub som fanger width-propen (Marker3DPin rendrer <Icon width=.../>).
const StubIcon = ((props: { width?: number }) => (
  <g data-testid="picon" data-w={props.width} />
)) as unknown as PhosphorIcon;

describe("Marker3DPin — SVG-pin, ratio 0.50, full-opacity-mount (AC3/AC1)", () => {
  it("rendrer SVG (Google 3D rasteriserer kun SVG/Pin/img — ikke HTML)", () => {
    const { container } = render(<Marker3DPin color="#abc" Icon={StubIcon} />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("default-størrelse = 40 (PIN_SIZE, matcher Marker3DItem)", () => {
    const { container } = render(<Marker3DPin color="#abc" Icon={StubIcon} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("40");
    expect(svg.getAttribute("height")).toBe("40");
  });

  it("ikon-ratio er 0.50 (size 40 → ikon 20)", () => {
    const { getByTestId } = render(<Marker3DPin color="#abc" Icon={StubIcon} />);
    expect(getByTestId("picon").getAttribute("data-w")).toBe("20");
  });

  it("monterer på full opacity (opacity default 1)", () => {
    const { container } = render(<Marker3DPin color="#abc" Icon={StubIcon} />);
    expect(container.querySelector("svg")!.getAttribute("opacity")).toBe("1");
  });

  it("scale 1 legger IKKE igjen en identitets-scale-transform; scale≠1 skalerer innholdet", () => {
    const settled = render(<Marker3DPin color="#abc" Icon={StubIcon} scale={1} />);
    expect(settled.container.innerHTML).not.toContain("scale(");
    cleanup();
    const bouncing = render(<Marker3DPin color="#abc" Icon={StubIcon} scale={0.8} />);
    expect(bouncing.container.innerHTML).toContain("scale(0.8)");
  });
});

describe("BlobMarker3D — skalerer radius ikke ramme, full-opacity-mount (AC3/AC1)", () => {
  it("rammen (SVG width + viewBox) er KONSTANT uansett scale", () => {
    const a = render(<BlobMarker3D color="#abc" scale={1} />);
    const svgA = a.container.querySelector("svg")!;
    expect(svgA.getAttribute("width")).toBe("14");
    expect(svgA.getAttribute("viewBox")).toBe("0 0 14 14");
    cleanup();
    const b = render(<BlobMarker3D color="#abc" scale={0.5} />);
    const svgB = b.container.querySelector("svg")!;
    expect(svgB.getAttribute("width")).toBe("14"); // ramme uendret …
    expect(svgB.getAttribute("viewBox")).toBe("0 0 14 14");
  });

  it("disc-radiusen krymper med scale (sprett, ikke zoom)", () => {
    const full = render(<BlobMarker3D color="#abc" scale={1} />);
    const rFull = Number(full.container.querySelector("circle")!.getAttribute("r"));
    cleanup();
    const half = render(<BlobMarker3D color="#abc" scale={0.5} />);
    const rHalf = Number(half.container.querySelector("circle")!.getAttribute("r"));
    expect(rFull).toBeCloseTo(5); // (14/2 - 2) * 1
    expect(rHalf).toBeCloseTo(2.5); // (14/2 - 2) * 0.5
    expect(rHalf).toBeLessThan(rFull);
  });

  it("scale 0 → radius 0 (usynlig), aldri negativ", () => {
    const { container } = render(<BlobMarker3D color="#abc" scale={0} />);
    expect(Number(container.querySelector("circle")!.getAttribute("r"))).toBe(0);
  });

  it("monterer på full opacity (opacity default 1)", () => {
    const { container } = render(<BlobMarker3D color="#abc" />);
    expect(container.querySelector("svg")!.getAttribute("opacity")).toBe("1");
  });
});

/**
 * Label i pin-SVG-en (2026-08-23). 2D lar CSS gjøre dette; her må teksten inn i
 * teksturen. Det kritiske er at RAMMEN vokser symmetrisk — ellers flytter selve
 * markøren seg fra punktet sitt i det labelen kommer på.
 */
describe("Marker3DPin — label", () => {
  const discCx = (container: HTMLElement) =>
    Number(container.querySelector("circle")!.getAttribute("cx"));

  it("uten label er rammen uendret 40 × 40", () => {
    const { container } = render(<Marker3DPin color="#abc" Icon={StubIcon} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("40");
    expect(svg.getAttribute("height")).toBe("40");
    expect(container.querySelector("text")).toBeNull();
  });

  it("med label vokser bredden, men høyden står stille", () => {
    const { container } = render(
      <Marker3DPin color="#abc" Icon={StubIcon} label="Extra Grilstad" />,
    );
    const svg = container.querySelector("svg")!;
    expect(Number(svg.getAttribute("width"))).toBeGreaterThan(40);
    expect(svg.getAttribute("height")).toBe("40");
  });

  it("disc-en blir liggende i rammens midte uansett side — pinnen flytter seg ikke", () => {
    const uten = render(<Marker3DPin color="#abc" Icon={StubIcon} />);
    const utenW = Number(uten.container.querySelector("svg")!.getAttribute("width"));
    expect(discCx(uten.container)).toBe(utenW / 2);
    cleanup();

    for (const side of ["right", "left"] as const) {
      const { container } = render(
        <Marker3DPin
          color="#abc"
          Icon={StubIcon}
          label="Vitusapotek Ranheim"
          labelSide={side}
        />,
      );
      const w = Number(container.querySelector("svg")!.getAttribute("width"));
      expect(discCx(container)).toBe(w / 2);
      cleanup();
    }
  });

  it("høyre-label starter etter disc-en, venstre-label ender før den", () => {
    const høyre = render(
      <Marker3DPin color="#abc" Icon={StubIcon} label="Nille" labelSide="right" />,
    );
    const hText = høyre.container.querySelector("text")!;
    expect(hText.getAttribute("text-anchor")).toBe("start");
    expect(Number(hText.getAttribute("x"))).toBeGreaterThan(discCx(høyre.container));
    cleanup();

    const venstre = render(
      <Marker3DPin color="#abc" Icon={StubIcon} label="Nille" labelSide="left" />,
    );
    const vText = venstre.container.querySelector("text")!;
    expect(vText.getAttribute("text-anchor")).toBe("end");
    expect(Number(vText.getAttribute("x"))).toBeLessThan(discCx(venstre.container));
  });

  it("default-siden er høyre (som 2D)", () => {
    const { container } = render(
      <Marker3DPin color="#abc" Icon={StubIcon} label="Nille" />,
    );
    expect(container.querySelector("text")!.getAttribute("text-anchor")).toBe(
      "start",
    );
  });

  it("tegner hvit kontur BAK fyllet — satellittfoto er ikke et lyst karttema", () => {
    const { container } = render(
      <Marker3DPin color="#abc" Icon={StubIcon} label="Nille" />,
    );
    const texts = Array.from(container.querySelectorAll("text"));
    expect(texts).toHaveLength(2);
    // Konturen først i dokumentrekkefølge = under fyllet. Én <text> med
    // paint-order ville lagt konturen OVER glyfene om attributten falt bort.
    expect(texts[0].getAttribute("stroke")).toBe("#ffffff");
    expect(texts[0].getAttribute("fill")).toBe("none");
    expect(texts[1].getAttribute("stroke")).toBeNull();
    expect(texts[1].getAttribute("fill")).toBe("#1c1917");
  });

  it("bryter lange navn til to linjer, sentrert på disc-en", () => {
    const { container } = render(
      <Marker3DPin
        color="#abc"
        Icon={StubIcon}
        label="Pakkeautomat Ranheim Post i Butikk"
      />,
    );
    const texts = Array.from(container.querySelectorAll("text"));
    // 2 linjer × (kontur + fyll)
    expect(texts).toHaveLength(4);
    const ys = [...new Set(texts.map((t) => Number(t.getAttribute("y"))))];
    expect(ys).toHaveLength(2);
    // Symmetrisk rundt disc-senteret (cy = 20).
    expect((ys[0] + ys[1]) / 2).toBeCloseTo(20, 6);
  });

  it("tall-badget følger disc-en, ikke rammen, når label er på", () => {
    const uten = render(
      <Marker3DPin color="#abc" Icon={StubIcon} number={3} />,
    );
    const utenCx =
      Number(uten.container.querySelectorAll("circle")[1].getAttribute("cx")) -
      discCx(uten.container);
    cleanup();
    const med = render(
      <Marker3DPin color="#abc" Icon={StubIcon} number={3} label="Nille" />,
    );
    const medCx =
      Number(med.container.querySelectorAll("circle")[1].getAttribute("cx")) -
      discCx(med.container);
    expect(medCx).toBe(utenCx);
  });
});
