import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Kontrakt-vakter for Unit 1 (R1/R2/R15): kontor-slug-oppslag server-side.
 * Ukjent/inaktiv → 404 uten kunde-opprettelse; active=true-filteret bevist;
 * rate-limit stopper før DB; DB-feil er fail-closed (404, ikke 500).
 */

const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  })
);
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers({ "x-forwarded-for": "1.2.3.4" })),
}));

const limiterAllow = vi.hoisted(() => ({ value: true }));
vi.mock("@/lib/utils/rate-limit", () => ({
  createRateLimiter: () => ({ check: () => limiterAllow.value }),
  getClientIp: () => "test-ip",
}));

// Scriptbar broker_offices-oppslag + logg for å bevise active-filter og at
// KUN broker_offices slås opp (aldri customers → ingen kunde-opprettelse, R15).
const officeResult = vi.hoisted(() => ({
  data: null as unknown,
  error: null as unknown,
}));
const eqLog = vi.hoisted(() => [] as Array<[string, unknown]>);
const fromLog = vi.hoisted(() => [] as string[]);
vi.mock("@/lib/supabase/client", () => {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = (col: string, val: unknown) => {
    eqLog.push([col, val]);
    return builder;
  };
  builder.maybeSingle = () =>
    Promise.resolve({ data: officeResult.data, error: officeResult.error });
  return {
    createServerClient: () => ({
      schema: () => ({
        from: (t: string) => {
          fromLog.push(t);
          return builder;
        },
      }),
    }),
  };
});

vi.mock("@/components/megler/OfficeGenererForm", () => ({
  default: (props: { officeSlug: string; officeName: string }) => (
    <div
      data-testid="office-form"
      data-slug={props.officeSlug}
      data-name={props.officeName}
    />
  ),
}));

import OfficePage from "./page";

beforeEach(() => {
  officeResult.data = null;
  officeResult.error = null;
  eqLog.length = 0;
  fromLog.length = 0;
  limiterAllow.value = true;
  notFoundMock.mockClear();
});

function renderPage(slug: string) {
  return OfficePage({ params: Promise.resolve({ slug }) });
}

describe("OfficePage — kontor-slug-oppslag", () => {
  it("happy: gyldig aktiv slug rendrer formen med kontornavnet", async () => {
    officeResult.data = {
      slug: "dnb-midtbyen-x7k2f9",
      name: "DNB Eiendom Midtbyen",
      customer_id: "dnb-midtbyen",
      active: true,
    };

    render(await renderPage("dnb-midtbyen-x7k2f9"));

    const form = screen.getByTestId("office-form");
    expect(form).toHaveAttribute("data-name", "DNB Eiendom Midtbyen");
    expect(form).toHaveAttribute("data-slug", "dnb-midtbyen-x7k2f9");
    expect(notFoundMock).not.toHaveBeenCalled();
    // slår KUN opp broker_offices — aldri customers (R15: ingen kunde-opprettelse)
    expect(fromLog).toEqual(["broker_offices"]);
    // active=true-filteret er anvendt → inaktive rader kommer aldri tilbake
    expect(eqLog).toContainEqual(["slug", "dnb-midtbyen-x7k2f9"]);
    expect(eqLog).toContainEqual(["active", true]);
  });

  it("ukjent slug → 404, ingen kunde-oppslag", async () => {
    officeResult.data = null;
    await expect(renderPage("finnes-ikke-000000")).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
    expect(notFoundMock).toHaveBeenCalled();
    expect(fromLog).toEqual(["broker_offices"]);
  });

  it("inaktiv slug → samme 404 (active=true filtrerer bort → data=null)", async () => {
    officeResult.data = null; // active=false ekskluderes server-side av .eq(active,true)
    await expect(renderPage("gammel-lenke-111111")).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
    expect(eqLog).toContainEqual(["active", true]);
  });

  it("DB-feil → fail-closed 404 (ikke distinguibel 500 / rotasjons-orakel)", async () => {
    officeResult.error = { message: "boom" };
    await expect(renderPage("dnb-x")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("reservert-navn-slug (admin/api) → 404, kun broker_offices-oppslag", async () => {
    officeResult.data = null;
    await expect(renderPage("admin")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(renderPage("api")).rejects.toThrow("NEXT_NOT_FOUND");
    // behandles bare som ukjente slugs — ingen rute-kollisjon, ingen kunde-write
    expect(fromLog.every((t) => t === "broker_offices")).toBe(true);
  });

  it("rate-limit overskredet → 404 FØR DB-oppslag", async () => {
    limiterAllow.value = false;
    await expect(renderPage("dnb-x")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(fromLog).toEqual([]); // stoppet før createServerClient
  });
});
