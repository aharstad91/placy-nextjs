import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import {
  PrecisionNote,
  SourceCredit,
  SourceLink,
  StatusBadge,
  UnplacedNote,
  sourceHost,
} from "./SourcedContent";

/**
 * Merkene som skiller lånt innhold fra vårt eget, og planer fra tilbud.
 *
 * Det som låses her er ASYMMETRIEN, ikke utseendet: hvert av merkene rendrer
 * INGENTING i normaltilfellet. Et vanlig board er utelukkende steder som
 * finnes, med tekst vi har skrevet selv og koordinater som er belagt — og da
 * skal flaten se ut nøyaktig som før merkene ble innført. Går en av disse
 * testene i rødt, har et transformasjonsområde-merke lekket ut på alle boards.
 */

afterEach(() => cleanup());

describe("StatusBadge", () => {
  it("rendrer ingenting for et sted som finnes", () => {
    const { container } = render(<StatusBadge status="existing" />);
    expect(container.innerHTML).toBe("");
  });

  it("rendrer ingenting når status mangler (alle vanlige boards)", () => {
    const { container } = render(<StatusBadge />);
    expect(container.innerHTML).toBe("");
  });

  it("rendrer pillen for et planlagt sted", () => {
    const { getByTestId } = render(<StatusBadge status="planned" />);
    expect(getByTestId("status-planned").textContent).toBe("Planlagt");
  });
});

describe("PrecisionNote", () => {
  it("rendrer ingenting uten note", () => {
    const { container } = render(<PrecisionNote />);
    expect(container.innerHTML).toBe("");
  });

  it("viser forbeholdet som tekst, ikke bak en hover", () => {
    const { getByTestId } = render(<PrecisionNote note="Plassert omtrentlig." />);
    expect(getByTestId("precision-note").textContent).toContain(
      "Plassert omtrentlig.",
    );
  });
});

describe("sourceHost", () => {
  it("gir vertsnavnet uten www", () => {
    expect(sourceHost("https://www.nyhavna.no/leve/")).toBe("nyhavna.no");
  });

  it("gir null for noe som ikke er en URL", () => {
    expect(sourceHost("Trondheim kommune, planbeskrivelse")).toBeNull();
  });
});

describe("SourceLink", () => {
  it("rendrer ingenting uten kilde", () => {
    const { container } = render(<SourceLink />);
    expect(container.innerHTML).toBe("");
  });

  it("bruker VERTSNAVNET som tekst, ikke label-feltet", () => {
    // Label kan være hva som helst kuratoren skrev; vertsnavnet er det leseren
    // kjenner igjen som «kilden», og det er det som skal stå.
    const { getByTestId } = render(
      <SourceLink source={{ label: "Nyhavna Utvikling", url: "https://www.nyhavna.no/leve/" }} />,
    );
    const a = getByTestId("source-link") as HTMLAnchorElement;
    expect(a.textContent).toBe("nyhavna.no");
    expect(a.getAttribute("href")).toBe("https://www.nyhavna.no/leve/");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("setter sidenavnet foran vertsnavnet når kilden har ett", () => {
    const { getByTestId } = render(
      <SourceLink
        source={{ label: "nyhavna.no", url: "https://nyhavna.no/leve/park-og-promenade/", page: "Park og promenade" }}
      />,
    );
    expect(getByTestId("source-link").textContent).toBe(
      "Park og promenade på nyhavna.no",
    );
  });
});

describe("SourceCredit", () => {
  it("rendrer ingenting når teksten er vår egen", () => {
    const { container } = render(<SourceCredit />);
    expect(container.innerHTML).toBe("");
  });

  it("krediterer kilden under teksten", () => {
    const { getByTestId } = render(
      <SourceCredit source={{ label: "nyhavna.no", url: "https://nyhavna.no/leve/" }} />,
    );
    expect(getByTestId("source-credit").textContent).toBe(
      "Tekst og utvalg fra nyhavna.no",
    );
    expect(getByTestId("source-credit-link")).not.toBeNull();
  });
});

describe("UnplacedNote", () => {
  it("rendrer ingenting for en tom liste", () => {
    const { container } = render(<UnplacedNote names={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("rendrer ingenting når lista mangler", () => {
    const { container } = render(<UnplacedNote />);
    expect(container.innerHTML).toBe("");
  });

  it("navngir stedene kilden nevner uten at vi kan plassere dem", () => {
    const { getByTestId } = render(
      <UnplacedNote names={["Doratorget", "Kullkranparken"]} />,
    );
    const text = getByTestId("unplaced-note").textContent ?? "";
    expect(text).toContain("Nevnt i kilden, men ikke plassert i kartet");
    expect(text).toContain("Doratorget · Kullkranparken");
  });
});
