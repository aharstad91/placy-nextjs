import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import {
  POIExploreModal,
  hasExploreContent,
  hasGroundedNarrative,
} from "./POIExploreModal";
import type { BoardPOI } from "./board-data";
import type { POI, PoiGrounding } from "@/lib/types";

/**
 * Utforsk-modalen er kodebasens FØRSTE renderer av `searchEntryPointHtml`.
 * Kontrakten (sanert build-time, rendret verbatim ved visning) er et
 * Google-ToS-krav, så den bevises her framfor å antas.
 */

// next/image krever Next-runtime i jsdom — bytt til en enkel img i test.
// (Produksjonskoden bruker next/image; ESLint-regelen gjelder ikke testmocken.)
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    onError,
  }: {
    src: string;
    alt: string;
    onError?: () => void;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-testid="gallery-img" onClick={onError} />
  ),
}));

const ENTRY_POINT = '<style>.chip{color:red}</style><div class="gsc-chip">Muustrøparken</div>';

function generated(overrides: Partial<NonNullable<PoiGrounding["generated"]>> = {}) {
  return {
    provider: "gemini-search-grounding" as const,
    narrative:
      "Muustrøparken er en skulpturpark i Straumen sentrum. Parken brukes til rekreasjon og uteopphold.\n\n- Skulpturer av Nils Aas\n- Amfi med scene\n- Kvernhus ved elvekanten",
    sources: [
      {
        title: "Muustrøparken – Inderøy kommune",
        url: "https://inderoy.kommune.no/muustroparken",
        redirectUrl: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/aaa",
        domain: "inderoy.kommune.no",
      },
      {
        title: "Nils Aas Kunstverksted",
        url: "https://nilsaas.no/parken",
        redirectUrl: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/bbb",
        domain: "nilsaas.no",
      },
    ],
    searchEntryPointHtml: ENTRY_POINT,
    searchQueries: ["Muustrøparken Inderøy"],
    model: "gemini-2.5-flash",
    fetchedAt: "2026-08-12T10:00:00.000Z",
    qualityGate: { passed: true, sourceCount: 2, charCount: 540 },
    ...overrides,
  };
}

function boardPoi(raw: Partial<POI> = {}): BoardPOI {
  const poi = {
    id: "google-ChIJe2pnuSJibUYRqz4D6mc_JdM",
    name: "Muustrøparken",
    coordinates: { lat: 63.87, lng: 11.27 },
    address: "Muustrøa 4, Inderøy",
    category: { id: "park", name: "Park", icon: "Trees", color: "#2f855a" },
    ...raw,
  } as POI;
  return {
    id: poi.id,
    name: poi.name,
    coordinates: poi.coordinates,
    address: poi.address,
    categoryId: "park",
    raw: poi,
  } as BoardPOI;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("gating-hjelpere", () => {
  it("bestått generated gir grounded narrativ", () => {
    expect(hasGroundedNarrative({ poiGroundingVersion: 1, generated: generated() })).toBe(true);
  });

  it("strykende generated gir IKKE grounded narrativ", () => {
    expect(
      hasGroundedNarrative({
        poiGroundingVersion: 1,
        generated: generated({
          qualityGate: { passed: false, sourceCount: 1, charCount: 120, reason: "for få kilder" },
        }),
      })
    ).toBe(false);
  });

  it("curated alene er nok — Placy-eid tekst trenger ingen port", () => {
    expect(
      hasGroundedNarrative({
        poiGroundingVersion: 1,
        curated: { narrative: "Nabolagets grønne pustehull.", curatedAt: "2026-08-01T00:00:00Z" },
      })
    ).toBe(true);
  });

  it("ingen grounding og ingen Google-fakta → ingen modal-innhold", () => {
    expect(hasExploreContent(boardPoi())).toBe(false);
  });

  it("kun Google-fakta (ingen grounding) er nok innhold til en modal", () => {
    expect(hasExploreContent(boardPoi({ googleRating: 4.5, googleReviewCount: 12 }))).toBe(true);
  });
});

describe("POIExploreModal — innhold", () => {
  it("rendrer narrativ som avsnitt + punktliste, ikke som én tekstklump", () => {
    render(
      <POIExploreModal
        open
        onClose={() => {}}
        poi={boardPoi({ grounding: { poiGroundingVersion: 1, generated: generated() } })}
      />
    );
    expect(screen.getByText(/skulpturpark i Straumen sentrum/)).toBeTruthy();
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toContain("Skulpturer av Nils Aas");
    expect(items).toContain("Amfi med scene");
  });

  it("curated vinner over generated når begge finnes", () => {
    render(
      <POIExploreModal
        open
        onClose={() => {}}
        poi={boardPoi({
          grounding: {
            poiGroundingVersion: 1,
            generated: generated(),
            curated: { narrative: "Meglerens egen beskrivelse av parken.", curatedAt: "2026-08-01T00:00:00Z" },
          },
        })}
      />
    );
    expect(screen.getByText("Meglerens egen beskrivelse av parken.")).toBeTruthy();
    expect(screen.queryByText(/skulpturpark i Straumen sentrum/)).toBeNull();
  });

  it("kuratert tekst bærer IKKE Google-attribusjon — Google skrev den ikke", () => {
    render(
      <POIExploreModal
        open
        onClose={() => {}}
        poi={boardPoi({
          grounding: {
            poiGroundingVersion: 1,
            generated: generated(),
            curated: { narrative: "Meglerens tekst.", curatedAt: "2026-08-01T00:00:00Z" },
          },
        })}
      />
    );
    expect(screen.queryByText("Hentet via Google Søk")).toBeNull();
  });

  it("rendrer Google-fakta fra DB: rating, telefon, nettside", () => {
    render(
      <POIExploreModal
        open
        onClose={() => {}}
        poi={boardPoi({
          grounding: { poiGroundingVersion: 1, generated: generated() },
          googleRating: 4.5,
          googleReviewCount: 23,
          googlePhone: "74 12 42 00",
          // Bevisst et annet domene enn kildelistas — ellers matcher
          // getByText både kilde-domenet og nettside-lenka.
          googleWebsite: "https://www.muustroparken.example/",
        })}
      />
    );
    expect(screen.getByLabelText(/4\.5 av 5 stjerner, 23 anmeldelser/)).toBeTruthy();
    expect(screen.getByText("74 12 42 00")).toBeTruthy();
    expect(screen.getByText("muustroparken.example")).toBeTruthy();
  });

  it("uten fakta utelates fakta-seksjonen helt, narrativet vises fortsatt", () => {
    render(
      <POIExploreModal
        open
        onClose={() => {}}
        poi={boardPoi({ grounding: { poiGroundingVersion: 1, generated: generated() } })}
      />
    );
    expect(screen.getByText(/skulpturpark/)).toBeTruthy();
    expect(screen.queryByText(/Åpent nå|Stengt nå/)).toBeNull();
  });

  it("uten bilder rendres ingen bildeseksjon (ingen brutt bilde)", () => {
    render(
      <POIExploreModal
        open
        onClose={() => {}}
        poi={boardPoi({ grounding: { poiGroundingVersion: 1, generated: generated() } })}
      />
    );
    expect(screen.queryAllByTestId("gallery-img")).toHaveLength(0);
  });

  it("bilde som feiler ved last skjuler hele stripa (utløpt lh3-URL)", () => {
    render(
      <POIExploreModal
        open
        onClose={() => {}}
        poi={boardPoi({
          grounding: { poiGroundingVersion: 1, generated: generated() },
          galleryImages: [
            "https://lh3.googleusercontent.com/a",
            "https://lh3.googleusercontent.com/b",
          ],
        })}
      />
    );
    expect(screen.getAllByTestId("gallery-img")).toHaveLength(2);
    // Mocken kaller onError på click.
    fireEvent.click(screen.getAllByTestId("gallery-img")[0]);
    expect(screen.queryAllByTestId("gallery-img")).toHaveLength(0);
  });

  it("strykende grounding viser ikke leverandør-tekst, men modalen er ikke tom", () => {
    render(
      <POIExploreModal
        open
        onClose={() => {}}
        poi={boardPoi({
          grounding: {
            poiGroundingVersion: 1,
            generated: generated({
              qualityGate: { passed: false, sourceCount: 1, charCount: 120, reason: "for få kilder" },
            }),
          },
          googleRating: 4.2,
        })}
      />
    );
    expect(screen.queryByText(/skulpturpark i Straumen sentrum/)).toBeNull();
    expect(screen.queryByText("Hentet via Google Søk")).toBeNull();
    expect(screen.getByLabelText(/4\.2 av 5 stjerner/)).toBeTruthy();
  });
});

describe("POIExploreModal — Google-attribusjon (ToS)", () => {
  it("kildelenker vises med tittel og domene, uten ekstra interaksjon", () => {
    render(
      <POIExploreModal
        open
        onClose={() => {}}
        poi={boardPoi({ grounding: { poiGroundingVersion: 1, generated: generated() } })}
      />
    );
    expect(screen.getByText("Hentet via Google Søk")).toBeTruthy();
    const link = screen.getByText("Muustrøparken – Inderøy kommune").closest("a")!;
    expect(link.getAttribute("href")).toBe("https://inderoy.kommune.no/muustroparken");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(screen.getByText("nilsaas.no")).toBeTruthy();
  });

  it("searchEntryPointHtml havner VERBATIM i DOM (inkl. sanert style-blokk)", () => {
    const { baseElement } = render(
      <POIExploreModal
        open
        onClose={() => {}}
        poi={boardPoi({ grounding: { poiGroundingVersion: 1, generated: generated() } })}
      />
    );
    expect(baseElement.querySelector(".gsc-chip")).toBeTruthy();
    expect(baseElement.innerHTML).toContain("<style>.chip{color:red}</style>");
  });

  it("attribusjonsteksten er ekte tekst i DOM, ikke bare visuell — skjermlesere må få den", () => {
    render(
      <POIExploreModal
        open
        onClose={() => {}}
        poi={boardPoi({ grounding: { poiGroundingVersion: 1, generated: generated() } })}
      />
    );
    const node = screen.getByText("Hentet via Google Søk");
    expect(node.getAttribute("aria-hidden")).toBeNull();
  });
});

describe("POIExploreModal — oppførsel", () => {
  it("emitter onOpened én gang per åpning, ikke per re-render", () => {
    const onOpened = vi.fn();
    const poi = boardPoi({ grounding: { poiGroundingVersion: 1, generated: generated() } });
    const { rerender } = render(
      <POIExploreModal open onClose={() => {}} poi={poi} onOpened={onOpened} />
    );
    rerender(<POIExploreModal open onClose={() => {}} poi={poi} onOpened={onOpened} />);
    rerender(<POIExploreModal open onClose={() => {}} poi={poi} onOpened={onOpened} />);
    expect(onOpened).toHaveBeenCalledTimes(1);
    expect(onOpened).toHaveBeenCalledWith(poi);
  });

  it("emitter ikke når modalen er lukket", () => {
    const onOpened = vi.fn();
    render(
      <POIExploreModal
        open={false}
        onClose={() => {}}
        poi={boardPoi({ grounding: { poiGroundingVersion: 1, generated: generated() } })}
        onOpened={onOpened}
      />
    );
    expect(onOpened).not.toHaveBeenCalled();
  });

  it("bytte av POI mens modalen står åpen teller som ny åpning", () => {
    const onOpened = vi.fn();
    const a = boardPoi({ grounding: { poiGroundingVersion: 1, generated: generated() } });
    const b = boardPoi({ id: "osm-node-1", name: "Nilsparken" });
    const { rerender } = render(
      <POIExploreModal open onClose={() => {}} poi={a} onOpened={onOpened} />
    );
    rerender(<POIExploreModal open onClose={() => {}} poi={b} onOpened={onOpened} />);
    expect(onOpened).toHaveBeenCalledTimes(2);
  });

  it("Escape lukker modalen", () => {
    const onClose = vi.fn();
    render(
      <POIExploreModal
        open
        onClose={onClose}
        poi={boardPoi({ grounding: { poiGroundingVersion: 1, generated: generated() } })}
      />
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("fallback-lenken har target=_blank og noopener", () => {
    render(
      <POIExploreModal
        open
        onClose={() => {}}
        poi={boardPoi({ grounding: { poiGroundingVersion: 1, generated: generated() } })}
        fallbackUrl="https://www.google.com/search?udm=50&q=Muustr%C3%B8parken"
      />
    );
    const link = screen.getByText("Se mer på Google").closest("a")!;
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("poi=null rendrer ingenting (ingen crash)", () => {
    const { baseElement } = render(<POIExploreModal open onClose={() => {}} poi={null} />);
    expect(baseElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it("dialogen får fokus ved åpning, og fokus returneres ved lukking", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = render(
      <POIExploreModal
        open
        onClose={() => {}}
        poi={boardPoi({ grounding: { poiGroundingVersion: 1, generated: generated() } })}
      />
    );
    expect(document.activeElement?.getAttribute("role")).toBe("dialog");

    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
