/**
 * Smoke tests — verify critical components render without crashing.
 *
 * These are NOT functional tests. They catch import errors, missing deps,
 * and render crashes — the kind of bugs that slip through typecheck but
 * break pages at runtime.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/link since we're outside Next.js runtime
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...props} />
  ),
}));

// Mock locale context — returns Norwegian locale by default
vi.mock("@/lib/i18n/locale-context", () => ({
  useLocale: () => ({ locale: "no" as const, setLocale: vi.fn() }),
  LocaleProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// ─── UI Components ──────────────────────────────────────────

describe("GoogleRating", () => {
  it("renders stars and rating number", async () => {
    const { GoogleRating } = await import("@/components/ui/GoogleRating");
    render(<GoogleRating rating={4.5} reviewCount={120} />);
    expect(screen.getByText("4.5")).toBeDefined();
    expect(screen.getByText("(120)")).toBeDefined();
  });

  it("renders null for rating 0", async () => {
    const { GoogleRating } = await import("@/components/ui/GoogleRating");
    const { container } = render(<GoogleRating rating={0} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders xs compact variant", async () => {
    const { GoogleRating } = await import("@/components/ui/GoogleRating");
    render(<GoogleRating rating={4.2} size="xs" />);
    expect(screen.getByText("4.2")).toBeDefined();
  });
});

describe("TierBadge", () => {
  it("renders Anbefalt badge for tier 1", async () => {
    const { TierBadge } = await import("@/components/ui/TierBadge");
    render(<TierBadge poiTier={1} variant="card" />);
    expect(screen.getByText("Anbefalt")).toBeDefined();
  });

  it("renders Local Gem badge", async () => {
    const { TierBadge } = await import("@/components/ui/TierBadge");
    render(<TierBadge poiTier={2} isLocalGem variant="card" />);
    expect(screen.getByText("Lokal perle")).toBeDefined();
  });

  it("returns null for tier 2 without gem status", async () => {
    const { TierBadge } = await import("@/components/ui/TierBadge");
    const { container } = render(<TierBadge poiTier={2} variant="card" />);
    expect(container.innerHTML).toBe("");
  });
});
