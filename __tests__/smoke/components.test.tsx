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

// ─── SEO JSON-LD Components ─────────────────────────────────

describe("BreadcrumbJsonLd", () => {
  it("renders valid JSON-LD script tag", async () => {
    const { default: BreadcrumbJsonLd } = await import(
      "@/components/seo/BreadcrumbJsonLd"
    );
    const { container } = render(
      <BreadcrumbJsonLd
        items={[
          { name: "Trondheim", url: "https://placy.no/trondheim" },
          { name: "Restauranter" },
        ]}
      />
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const data = JSON.parse(script!.textContent!);
    expect(data["@type"]).toBe("BreadcrumbList");
    expect(data.itemListElement).toHaveLength(2);
  });
});

describe("FAQJsonLd", () => {
  it("renders FAQ schema with questions", async () => {
    const { default: FAQJsonLd } = await import(
      "@/components/seo/FAQJsonLd"
    );
    const { container } = render(
      <FAQJsonLd
        items={[
          { question: "Hva er Placy?", answer: "En lokasjonsplattform." },
        ]}
      />
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const data = JSON.parse(script!.textContent!);
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity).toHaveLength(1);
  });

  it("returns null for empty items", async () => {
    const { default: FAQJsonLd } = await import(
      "@/components/seo/FAQJsonLd"
    );
    const { container } = render(<FAQJsonLd items={[]} />);
    expect(container.innerHTML).toBe("");
  });
});

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

// ─── Navigation Components ──────────────────────────────────

describe("Breadcrumb", () => {
  it("renders breadcrumb items with links", async () => {
    const { default: Breadcrumb } = await import(
      "@/components/public/Breadcrumb"
    );
    render(
      <Breadcrumb
        items={[
          { label: "Hjem", href: "/" },
          { label: "Trondheim", href: "/trondheim" },
          { label: "Restauranter" },
        ]}
      />
    );
    expect(screen.getByText("Hjem")).toBeDefined();
    expect(screen.getByText("Trondheim")).toBeDefined();
    expect(screen.getByText("Restauranter")).toBeDefined();
    expect(screen.getByRole("navigation")).toBeDefined();
  });
});
