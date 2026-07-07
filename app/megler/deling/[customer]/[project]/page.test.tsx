import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Kontrakt-vakter for delings-siden (Unit 3): oppslagsstrategi der address_slug
 * og url_slug divergerer. url_slug kanonisk → SharePanel; address_slug pending →
 * vente-tilstand; address_slug completed → 301 til kanonisk; ukjent → 404.
 */

const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  })
);
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  })
);
vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

// Order-basert queue: page-ens spørringer er deterministiske i rekkefølge.
const queue = vi.hoisted(() => [] as Array<{ data: unknown }>);
vi.mock("@/lib/supabase/client", () => {
  const makeBuilder = () => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit"]) b[m] = () => b;
    b.maybeSingle = () => Promise.resolve(queue.shift() ?? { data: null });
    return b;
  };
  return {
    createServerClient: () => ({ schema: () => ({ from: () => makeBuilder() }) }),
  };
});

vi.mock("@/components/megler/SharePanel", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="share-panel" data-props={JSON.stringify(props)} />
  ),
}));

import DelingPage from "./page";

beforeEach(() => {
  queue.length = 0;
  notFoundMock.mockClear();
  redirectMock.mockClear();
});

function run(customer: string, project: string) {
  return DelingPage({ params: Promise.resolve({ customer, project }) });
}

describe("DelingPage — oppslagsstrategi", () => {
  it("url_slug (kanonisk) → SharePanel med board-URLer + kanal-markører + tilbake-lenke", async () => {
    queue.push({
      data: {
        url_slug: "testvegen-12-7030-trondheim",
        name: "Testvegen 12, 7030 Trondheim",
      },
    }); // projects
    queue.push({ data: { slug: "dnb-x7k2f9" } }); // broker_offices (tilbake-lenke)

    render(await run("dnb", "testvegen-12-7030-trondheim"));

    const props = JSON.parse(
      screen.getByTestId("share-panel").getAttribute("data-props")!
    );
    expect(props.boardLinkUrl).toBe(
      "https://placy.no/eiendom/dnb/testvegen-12-7030-trondheim/rapport-board?src=finn"
    );
    expect(props.boardEmbedUrl).toContain("?embed=1&src=embed");
    expect(props.boardQrUrl).toContain("?src=qr");
    expect(props.backHref).toBe("/megler/dnb-x7k2f9");
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("address_slug pending → vente-tilstand (ikke død preview)", async () => {
    queue.push({ data: null }); // projects url_slug: miss
    queue.push({
      data: { status: "pending", project_id: null, address: "Testvegen 12, 7030 Trondheim" },
    }); // generation_requests fallback

    render(await run("dnb", "testvegen-12"));
    expect(screen.getByText("Nabolagskartet genereres")).toBeInTheDocument();
  });

  it("address_slug completed → 301 til kanonisk url_slug-delings-side", async () => {
    queue.push({ data: null }); // projects url_slug: miss
    queue.push({
      data: { status: "completed", project_id: "dnb_testvegen-12b", address: "x" },
    }); // generation_requests
    queue.push({ data: { url_slug: "testvegen-12b-7030-trondheim" } }); // projects by id

    await expect(run("dnb", "testvegen-12")).rejects.toThrow(
      "REDIRECT:/megler/deling/dnb/testvegen-12b-7030-trondheim"
    );
    expect(redirectMock).toHaveBeenCalledWith(
      "/megler/deling/dnb/testvegen-12b-7030-trondheim"
    );
  });

  it("ukjent slug (verken prosjekt eller request) → 404", async () => {
    queue.push({ data: null }); // projects
    queue.push({ data: null }); // generation_requests
    await expect(run("dnb", "finnes-ikke")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("address_slug failed → feil-tilstand (ikke død preview, ikke redirect)", async () => {
    queue.push({ data: null }); // projects url_slug: miss
    queue.push({
      data: { status: "failed", project_id: null, address: "Testvegen 12, 7030 Trondheim" },
    }); // generation_requests fallback
    render(await run("dnb", "testvegen-12"));
    expect(screen.getByText("Genereringen feilet")).toBeInTheDocument();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("completed request men prosjekt-raden mangler → 404 (ingen redirect til udefinert)", async () => {
    queue.push({ data: null }); // projects url_slug: miss
    queue.push({
      data: { status: "completed", project_id: "dnb_borte", address: "x" },
    }); // generation_requests
    queue.push({ data: null }); // projects-by-id: mangler
    await expect(run("dnb", "testvegen-12")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("kanonisk board uten aktivt kontor → SharePanel med backHref=null", async () => {
    queue.push({
      data: { url_slug: "teknostallen", name: "Teknostallen" },
    }); // projects hit
    queue.push({ data: null }); // broker_offices: intet aktivt kontor for kunden
    render(await run("klp-eiendom", "teknostallen"));
    const props = JSON.parse(
      screen.getByTestId("share-panel").getAttribute("data-props")!
    );
    expect(props.backHref).toBeNull();
  });
});
