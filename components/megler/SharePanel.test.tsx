import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SharePanel from "./SharePanel";

/**
 * Kontrakt-vakter for delings-panelet (R9/R18/R19): kopier-handlingene skriver
 * BOARD-URLen med riktig kanal-markør til clipboard, gir synlig «Kopiert!»-
 * bekreftelse (og synlig FEIL ved mislykket kopiering — ingen stille glipp),
 * QR koder ?src=qr, og FINN-veiledningen er til stede.
 */

vi.mock("qrcode.react", () => ({
  QRCodeCanvas: ({ value }: { value: string }) => (
    <div data-testid="qr" data-value={value} />
  ),
}));

const writeText = vi.fn().mockResolvedValue(undefined);

const PROPS = {
  address: "Testvegen 12, 7030 Trondheim",
  boardLinkUrl:
    "https://placy.no/eiendom/dnb/testvegen-12/rapport-board?src=finn",
  boardEmbedUrl:
    "https://placy.no/eiendom/dnb/testvegen-12/rapport-board?embed=1&src=embed",
  boardQrUrl: "https://placy.no/eiendom/dnb/testvegen-12/rapport-board?src=qr",
  previewSrc: "/eiendom/dnb/testvegen-12/rapport-board?embed=1&src=embed",
  recommendedHeight: 600,
  backHref: "/megler/dnb-x7k2f9",
};

beforeEach(() => {
  writeText.mockClear();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

describe("SharePanel", () => {
  it("kopier lenke → skriver board-URL med ?src=finn + viser Kopiert!", async () => {
    render(<SharePanel {...PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: "Kopier lenke" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(PROPS.boardLinkUrl));
    expect(await screen.findByText("Kopiert!")).toBeInTheDocument();
  });

  it("kopier iframe-kode → snippet koder ?embed=1&src=embed, loading=lazy, 100% bredde", async () => {
    render(<SharePanel {...PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: "Kopier iframe-kode" }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const snippet = writeText.mock.calls.at(-1)![0] as string;
    expect(snippet).toContain(PROPS.boardEmbedUrl);
    expect(snippet).toContain('loading="lazy"');
    expect(snippet).toContain('width="100%"');
    expect(snippet).toContain('height="600"');
  });

  it("mislykket kopiering → synlig feil (ingen stille glipp, R9)", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    render(<SharePanel {...PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: "Kopier lenke" }));
    expect(await screen.findByText(/Kunne ikke kopiere/)).toBeInTheDocument();
  });

  it("QR koder board-URL med ?src=qr", () => {
    render(<SharePanel {...PROPS} />);
    expect(screen.getByTestId("qr")).toHaveAttribute("data-value", PROPS.boardQrUrl);
  });

  it("FINN-veiledning + tilbake-lenke til kontor-siden", () => {
    render(<SharePanel {...PROPS} />);
    expect(
      screen.getByText(/FINN tillater ikke innebygde kart/)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Lag et nytt kart/ })).toHaveAttribute(
      "href",
      "/megler/dnb-x7k2f9"
    );
  });
});
