import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

/**
 * Kontrakt-vakt for embed-gaten (Unit 4/5, R12/R19): `?embed` og `?src` leses på
 * klienten og videreføres som props til ReportReelsPage. `?src` guardes til kun
 * finn|embed|qr (parseSrc) — ukjent/manglende → undefined (utelates).
 */

const params = vi.hoisted(() => new URLSearchParams());
vi.mock("next/navigation", () => ({
  useSearchParams: () => params,
}));

const reelsProps = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }));
vi.mock("@/components/variants/report/reels/ReportReelsPage", () => ({
  default: (props: Record<string, unknown>) => {
    reelsProps.last = props;
    return <div data-testid="reels" />;
  },
}));

import BoardEmbedGate from "./board-embed-gate";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AnyGate = BoardEmbedGate as any;

beforeEach(() => {
  reelsProps.last = null;
  for (const k of [...params.keys()]) params.delete(k);
});

describe("BoardEmbedGate — ?embed / ?src → props", () => {
  it("?embed=1&src=embed → embed=true, src='embed'", () => {
    params.set("embed", "1");
    params.set("src", "embed");
    render(<AnyGate />);
    expect(reelsProps.last?.embed).toBe(true);
    expect(reelsProps.last?.src).toBe("embed");
  });

  it("?src=finn (uten embed) → embed=false, src='finn'", () => {
    params.set("src", "finn");
    render(<AnyGate />);
    expect(reelsProps.last?.embed).toBe(false);
    expect(reelsProps.last?.src).toBe("finn");
  });

  it("?src=qr → src='qr'", () => {
    params.set("src", "qr");
    render(<AnyGate />);
    expect(reelsProps.last?.src).toBe("qr");
  });

  it("ukjent ?src=tulleball → src undefined (utelates)", () => {
    params.set("src", "tulleball");
    render(<AnyGate />);
    expect(reelsProps.last?.src).toBeUndefined();
  });

  it("ingen ?src (direkte-trafikk) → src undefined", () => {
    render(<AnyGate />);
    expect(reelsProps.last?.src).toBeUndefined();
  });

  it("bare ?embed (tom verdi) → embed=true (R12-kontrakt)", () => {
    params.set("embed", "");
    render(<AnyGate />);
    expect(reelsProps.last?.embed).toBe(true);
  });

  it("?embed=true → embed=true", () => {
    params.set("embed", "true");
    render(<AnyGate />);
    expect(reelsProps.last?.embed).toBe(true);
  });

  it("?embed=0 / fravær → embed=false", () => {
    params.set("embed", "0");
    render(<AnyGate />);
    expect(reelsProps.last?.embed).toBe(false);
  });
});
