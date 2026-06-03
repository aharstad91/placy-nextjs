import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CameraCutOverlay } from "./CameraCutOverlay";

describe("CameraCutOverlay", () => {
  it("er opak når visible (lys cut)", () => {
    const { container } = render(<CameraCutOverlay visible label="Mat & Drikke" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("opacity-100");
    expect(root.className).not.toContain("opacity-0");
    expect(root.className).toContain("bg-[#f2e9dc]");
  });

  it("er gjennomsiktig når ikke visible", () => {
    const { container } = render(<CameraCutOverlay visible={false} label="Mat & Drikke" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("opacity-0");
  });

  it("er alltid pointer-events-none (blokkerer aldri kart-interaksjon)", () => {
    const { container } = render(<CameraCutOverlay visible={false} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("pointer-events-none");
  });

  it("viser kategori-label + farge-aksent når label er satt", () => {
    const { getByText, container } = render(
      <CameraCutOverlay visible label="Transport" color="#ff8800" />,
    );
    expect(getByText("Transport")).toBeTruthy();
    const accent = container.querySelector('span[style]') as HTMLElement;
    expect(accent.style.backgroundColor).toBe("rgb(255, 136, 0)");
  });

  it("rendrer ingen label-blokk uten label", () => {
    const { container } = render(<CameraCutOverlay visible />);
    expect(container.querySelector("span")).toBeNull();
  });
});
