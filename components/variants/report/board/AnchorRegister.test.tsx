import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, within } from "@testing-library/react";
import { AnchorRegister, groupRegister, REGISTER_AUTO_EXPAND_MAX } from "./AnchorRegister";
import type { BoardPOI } from "./board-data";
import type { POI } from "@/lib/types";

/**
 * Registeret er det ENESTE stedet de absorberte virksomhetene finnes.
 * `report-data` fjerner dem fra temaet sitt (Unit 4) og de har ingen markør, så
 * en feil her er ikke en visuell detalj — det er femti butikker som forsvinner.
 */

const CATEGORIES: Record<string, POI["category"]> = {
  dagligvare: { id: "dagligvare", name: "Dagligvare", icon: "ShoppingCart", color: "#16a34a" },
  klar: { id: "klar", name: "Klær", icon: "Shirt", color: "#a855f7" },
  apotek: { id: "apotek", name: "Apotek", icon: "Pill", color: "#0ea5e9" },
  shopping: { id: "shopping", name: "Kjøpesenter", icon: "Store", color: "#f59e0b" },
};

function member(name: string, categoryKey: keyof typeof CATEGORIES): POI {
  return {
    id: `google-${name.replace(/\s/g, "-")}`,
    name,
    coordinates: { lat: 63.43, lng: 10.45 },
    category: CATEGORIES[categoryKey],
  };
}

function anchor(children: POI[], overrides: Partial<POI> = {}): BoardPOI {
  const raw = {
    id: "google-sirkus",
    name: "Sirkus Shopping",
    coordinates: { lat: 63.43, lng: 10.45 },
    address: "Falkenborgvegen 9, Trondheim",
    category: CATEGORIES.shopping,
    anchorSummary: "Butikk, apotek, dagligvare og hotell",
    ...overrides,
  } as POI;
  return {
    id: raw.id,
    name: raw.name,
    coordinates: raw.coordinates,
    address: raw.address,
    categoryId: "hverdagsliv",
    isAnchor: true,
    ...(children.length > 0 ? { childPOIs: children } : {}),
    raw,
  } as BoardPOI;
}

/** Flere medlemmer enn auto-åpne-grensen, fordelt på tre kategorier. */
function bigRegister(): POI[] {
  return [
    ...Array.from({ length: 6 }, (_, i) => member(`Klesbutikk ${6 - i}`, "klar")),
    ...Array.from({ length: 3 }, (_, i) => member(`Matbutikk ${i + 1}`, "dagligvare")),
    member("Apotek 1", "apotek"),
  ];
}

afterEach(() => cleanup());

describe("groupRegister", () => {
  it("grupperer på Placy-kategori", () => {
    const groups = groupRegister([
      member("Rema 1000", "dagligvare"),
      member("Cubus", "klar"),
      member("Extra", "dagligvare"),
    ]);
    expect(groups.map((g) => [g.categoryId, g.members.length])).toEqual([
      ["dagligvare", 2],
      ["klar", 1],
    ]);
  });

  it("sorterer gruppene på antall synkende, så navn stigende — samme rekkefølge som anchor_summary", () => {
    // Pipelinens `buildAnchorSummary` bruker nøyaktig denne rangeringen.
    // Sammendragslinjen og registeret skal ikke fortelle to ulike historier.
    const groups = groupRegister([
      member("Apotek 1", "apotek"),
      member("Cubus", "klar"),
      member("Rema 1000", "dagligvare"),
      member("Extra", "dagligvare"),
      member("H&M", "klar"),
    ]);
    expect(groups.map((g) => g.name)).toEqual(["Dagligvare", "Klær", "Apotek"]);
  });

  it("sorterer medlemmene alfabetisk innad i gruppa (nb-NO)", () => {
    const groups = groupRegister([
      member("Ørn Sport", "klar"),
      member("Cubus", "klar"),
      member("Ålesund Klær", "klar"),
      member("Bik Bok", "klar"),
    ]);
    // Æ/Ø/Å sist — nb-NO-kollasjon, ikke ASCII.
    expect(groups[0].members.map((m) => m.name)).toEqual([
      "Bik Bok",
      "Cubus",
      "Ørn Sport",
      "Ålesund Klær",
    ]);
  });

  it("er deterministisk — omstokket input gir samme resultat", () => {
    const input = bigRegister();
    const a = groupRegister(input);
    const b = groupRegister([...input].reverse());
    expect(a.map((g) => [g.categoryId, g.members.map((m) => m.id)])).toEqual(
      b.map((g) => [g.categoryId, g.members.map((m) => m.id)]),
    );
  });

  it("tom input gir tom liste", () => {
    expect(groupRegister([])).toEqual([]);
  });
});

describe("AnchorRegister — medlemslista", () => {
  it("rendrer én rad per kategori med antall", () => {
    render(<AnchorRegister poi={anchor(bigRegister())} />);
    const rows = screen.getAllByTestId("register-group");
    expect(rows.map((r) => r.textContent)).toEqual(["Klær6", "Dagligvare3", "Apotek1"]);
  });

  it("lister medlemsnavnene under kategorien sin", () => {
    render(<AnchorRegister poi={anchor(bigRegister())} />);
    const panels = screen.getAllByTestId("register-members");
    expect(within(panels[1]).getAllByTestId("register-member").map((li) => li.textContent)).toEqual([
      "Matbutikk 1",
      "Matbutikk 2",
      "Matbutikk 3",
    ]);
  });

  it("medlemsnavnene er IKKE trykkbare — de har ingen markør å fly til", () => {
    render(<AnchorRegister poi={anchor(bigRegister())} />);
    const members = screen.getAllByTestId("register-member");
    expect(members.length).toBe(10);
    for (const m of members) {
      expect(m.tagName).toBe("LI");
      expect(m.querySelector("button")).toBeNull();
    }
  });

  it("store registre starter lukket", () => {
    render(<AnchorRegister poi={anchor(bigRegister())} />);
    for (const row of screen.getAllByTestId("register-group")) {
      expect(row.getAttribute("aria-expanded")).toBe("false");
    }
    for (const panel of screen.getAllByTestId("register-members")) {
      expect(panel.getAttribute("data-expanded")).toBe("false");
    }
  });

  it("små registre starter åpne — fem lukkede rader med ett navn i hver er verre enn å vise dem", () => {
    // Vikhammer senteret: fem medlemmer, fem kategorier.
    const small = [
      member("Extra Vikhammer", "dagligvare"),
      member("Apotek 1 Malvik", "apotek"),
      member("Vikhamar Hårsenter", "klar"),
    ];
    expect(small.length).toBeLessThanOrEqual(REGISTER_AUTO_EXPAND_MAX);
    render(<AnchorRegister poi={anchor(small)} />);
    for (const row of screen.getAllByTestId("register-group")) {
      expect(row.getAttribute("aria-expanded")).toBe("true");
    }
  });

  it("klikk på kategori-raden veksler panelet", () => {
    render(<AnchorRegister poi={anchor(bigRegister())} />);
    const row = screen.getAllByTestId("register-group")[0];
    const panelId = row.getAttribute("aria-controls")!;

    fireEvent.click(row);
    expect(row.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(panelId)!.getAttribute("data-expanded")).toBe("true");

    fireEvent.click(row);
    expect(row.getAttribute("aria-expanded")).toBe("false");
  });

  it("begge tilstander står i DOM — panelet skjules med CSS, ikke ved unmount", () => {
    // Husets expand/collapse-oppskrift. Uten dette faller høyde-animasjonen bort.
    render(<AnchorRegister poi={anchor(bigRegister())} />);
    expect(screen.getAllByTestId("register-member").length).toBe(10);
  });

  it("sammendragslinja vises ikke når medlemmene finnes — registeret erstatter den", () => {
    render(<AnchorRegister poi={anchor(bigRegister())} />);
    expect(screen.queryByTestId("register-summary")).toBeNull();
  });
});

describe("AnchorRegister — fjerne ankre", () => {
  it("uten medlemmer er anchor_summary hele registeret", () => {
    // Thon Senter Verdal, 12 km: medlemstallet kom fra Google-proben (Unit 3),
    // men ingen medlemmer ble importert. Vi later ikke som vi kjenner butikkene.
    render(<AnchorRegister poi={anchor([])} />);
    expect(screen.getByTestId("register-summary").textContent).toBe(
      "Butikk, apotek, dagligvare og hotell",
    );
    expect(screen.queryByTestId("register-group")).toBeNull();
  });

  it("rendrer ingenting uten både medlemmer og sammendrag", () => {
    const { container } = render(
      <AnchorRegister poi={anchor([], { anchorSummary: undefined })} />,
    );
    expect(container.querySelector('[data-testid="anchor-register"]')).toBeNull();
  });

  it("blank sammendragsstreng teller ikke som register", () => {
    const { container } = render(<AnchorRegister poi={anchor([], { anchorSummary: "   " })} />);
    expect(container.querySelector('[data-testid="anchor-register"]')).toBeNull();
  });
});
