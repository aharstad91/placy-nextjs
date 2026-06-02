import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { DesktopReportSplash, type SplashCategory } from "../DesktopReportSplash";

// next/image trenger ikke optimizer-stien i jsdom — render som vanlig img.
// Strip Next-spesifikke props (fill/priority/unoptimized/sizes) så React ikke
// advarer om ukjente DOM-attributter.
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
  }: {
    src: string;
    alt: string;
    className?: string;
  }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={typeof src === "string" ? src : ""} alt={alt} className={className} />;
  },
}));

const categories: SplashCategory[] = [
  { id: "mat-drikke", label: "Mat & Drikke", color: "#ff8800", image: "/x.jpg" },
  { id: "transport", label: "Transport", color: "#3366ff" },
];

const baseProps = {
  visible: true,
  name: "Stasjonskvartalet",
  subline: "Midtbyen, Trondheim",
  categories,
  primaryLabel: "Start opplevelsen",
  onPlay: () => {},
};

describe("DesktopReportSplash", () => {
  it("er synlig (opacity-100, ikke pointer-events-none) når visible", () => {
    const { container } = render(<DesktopReportSplash {...baseProps} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("opacity-100");
    expect(root.className).not.toContain("pointer-events-none");
  });

  it("er skjult og klikk-gjennomsiktig når ikke visible", () => {
    const { container } = render(
      <DesktopReportSplash {...baseProps} visible={false} />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("opacity-0");
    expect(root.className).toContain("pointer-events-none");
  });

  it("viser velkomst-tittel + knappe-tekst", () => {
    const { getByRole } = render(<DesktopReportSplash {...baseProps} />);
    expect(
      getByRole("heading", { name: "Velkommen til Stasjonskvartalet" }),
    ).toBeTruthy();
    expect(getByRole("button", { name: /Start opplevelsen/ })).toBeTruthy();
  });

  it("viser logo når logoSrc er satt", () => {
    const { getByAltText } = render(
      <DesktopReportSplash {...baseProps} logoSrc="/logo.svg" />,
    );
    expect(getByAltText("Stasjonskvartalet")).toBeTruthy();
  });

  it("faller tilbake til tekst-wordmark uten logoSrc", () => {
    const { getByText, queryByAltText } = render(
      <DesktopReportSplash {...baseProps} />,
    );
    expect(queryByAltText("Stasjonskvartalet")).toBeNull();
    expect(getByText("Bli kjent med")).toBeTruthy();
  });

  it("rendrer kategori-teaser med labels", () => {
    const { getByText } = render(<DesktopReportSplash {...baseProps} />);
    expect(getByText("Mat & Drikke")).toBeTruthy();
    expect(getByText("Transport")).toBeTruthy();
  });

  it("kaller onPlay ved klikk på play-knappen", () => {
    const onPlay = vi.fn();
    const { getByRole } = render(
      <DesktopReportSplash {...baseProps} onPlay={onPlay} />,
    );
    fireEvent.click(getByRole("button", { name: /Start opplevelsen/ }));
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it("scroll nedover trigger onPlay når visible", () => {
    const onPlay = vi.fn();
    render(<DesktopReportSplash {...baseProps} onPlay={onPlay} />);
    fireEvent.wheel(window, { deltaY: 50 });
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it("scroll oppover trigger ikke onPlay", () => {
    const onPlay = vi.fn();
    render(<DesktopReportSplash {...baseProps} onPlay={onPlay} />);
    fireEvent.wheel(window, { deltaY: -50 });
    expect(onPlay).not.toHaveBeenCalled();
  });

  it("scroll trigger ikke onPlay når ikke visible", () => {
    const onPlay = vi.fn();
    render(<DesktopReportSplash {...baseProps} visible={false} onPlay={onPlay} />);
    fireEvent.wheel(window, { deltaY: 50 });
    expect(onPlay).not.toHaveBeenCalled();
  });

  it("rendrer video i høyre panel når heroVideo er satt (med poster)", () => {
    const { container } = render(
      <DesktopReportSplash
        {...baseProps}
        heroImage="/hero.jpg"
        heroVideo="/x-splash-video.mp4"
      />,
    );
    const video = container.querySelector("video[src='/x-splash-video.mp4']");
    expect(video).toBeTruthy();
    expect(video?.getAttribute("poster")).toBe("/x-splash-video.jpg");
  });

  it("faller tilbake til render-bilde uten heroVideo", () => {
    const { container, getByAltText } = render(
      <DesktopReportSplash {...baseProps} heroImage="/hero.jpg" />,
    );
    // Ingen video uten heroVideo (bakgrunns-videoen er fjernet).
    expect(container.querySelector("video")).toBeNull();
    expect(getByAltText("Stasjonskvartalet – illustrasjon")).toBeTruthy();
  });
});
