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
