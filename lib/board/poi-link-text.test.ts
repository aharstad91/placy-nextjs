import { describe, expect, it } from "vitest";
import { boardLinkResolvers, parseLinkedText } from "./poi-link-text";

const RESOLVE_ALL = {
  resolvePoi: (id: string) => id,
  resolveCategory: (id: string) => id,
};

describe("parseLinkedText", () => {
  it("deler blandet tekst i riktige segmenter", () => {
    const nodes = parseLinkedText(
      "Boligen sogner til [Ranheim skole](poi:nsr-975278980), og [Charlottenlund ungdomsskole](poi:nsr-975290158) tar ungdomstrinnet.",
      RESOLVE_ALL,
    );
    expect(nodes).toEqual([
      { kind: "text", text: "Boligen sogner til " },
      { kind: "poi", text: "Ranheim skole", poiId: "nsr-975278980" },
      { kind: "text", text: ", og " },
      { kind: "poi", text: "Charlottenlund ungdomsskole", poiId: "nsr-975290158" },
      { kind: "text", text: " tar ungdomstrinnet." },
    ]);
  });

  it("tar imot heterogene POI-IDer — aldri en UUID-antakelse", () => {
    // En UUID-sjekk droppet 6 av 7 grounding-objekter stille ved render.
    const ider = [
      "nsr-975278980",
      "google-ChIJabc123",
      "entur-NSR-StopPlace-60260",
      "bus-dronningens-gate",
      "a3f1c2d4-1111-2222-3333-444455556666",
    ];
    for (const id of ider) {
      const [node] = parseLinkedText(`[Sted](poi:${id})`, RESOLVE_ALL);
      expect(node).toEqual({ kind: "poi", text: "Sted", poiId: id });
    }
  });

  it("degraderer til ren tekst når stedet ikke er på boardet", () => {
    // Aldri sensurer: svaret er sant selv om punktet ikke finnes i kartet.
    expect(
      parseLinkedText("Nær [Byåsen videregående](poi:nsr-984477112) i vest.", {
        resolvePoi: () => null,
      }),
    ).toEqual([{ kind: "text", text: "Nær Byåsen videregående i vest." }]);
  });

  it("slår sammen tekst rundt en degradert lenke til ÉN node", () => {
    const nodes = parseLinkedText("A [B](poi:x) C", { resolvePoi: () => null });
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual({ kind: "text", text: "A B C" });
  });

  it("parser kategorilenker", () => {
    expect(
      parseLinkedText("Se [Transport & Mobilitet](category:transport) for mer.", RESOLVE_ALL),
    ).toEqual([
      { kind: "text", text: "Se " },
      { kind: "category", text: "Transport & Mobilitet", categoryId: "transport" },
      { kind: "text", text: " for mer." },
    ]);
  });

  it("degraderer ukjent kategori til ren tekst", () => {
    expect(
      parseLinkedText("Se [Opplevelser](category:opplevelser).", { resolveCategory: () => null }),
    ).toEqual([{ kind: "text", text: "Se Opplevelser." }]);
  });

  it("lar tekst uten lenker være én node", () => {
    expect(parseLinkedText("Ingen lenker her.", RESOLVE_ALL)).toEqual([
      { kind: "text", text: "Ingen lenker her." },
    ]);
  });

  it("lar andre markdown-lenker stå urørt", () => {
    // Vi eier bare poi:- og category:-skjemaene. En http-lenke er ikke vår.
    expect(parseLinkedText("Se [AtB](https://atb.no).", RESOLVE_ALL)).toEqual([
      { kind: "text", text: "Se [AtB](https://atb.no)." },
    ]);
  });

  it("gir samme resultat andre gang samme tekst parses", () => {
    // En modul-delt /g-regex bærer lastIndex mellom kall.
    const tekst = "[A](poi:a) og [B](poi:b)";
    expect(parseLinkedText(tekst, RESOLVE_ALL)).toEqual(parseLinkedText(tekst, RESOLVE_ALL));
  });

  it("gir ren tekst uten resolvere", () => {
    expect(parseLinkedText("[A](poi:a) her")).toEqual([{ kind: "text", text: "A her" }]);
  });

  it("tåler tom streng", () => {
    expect(parseLinkedText("", RESOLVE_ALL)).toEqual([]);
  });

  it("trimmer whitespace rundt id-en", () => {
    const [node] = parseLinkedText("[A](poi: nsr-1 )", RESOLVE_ALL);
    expect(node).toEqual({ kind: "poi", text: "A", poiId: "nsr-1" });
  });
});

describe("boardLinkResolvers", () => {
  // `poisById` er nøklet på lowercased id (board-data.ts:249) mens POI-en
  // bærer sin egen skrivemåte. Begge deler må håndteres, ellers bommer enten
  // oppslaget eller OPEN_POI.
  const poisById = new Map([
    ["entur-nsr-stopplace-60260", { id: "entur-NSR-StopPlace-60260" }],
    ["nsr-975278980", { id: "nsr-975278980" }],
  ]);

  it("slår opp i små bokstaver og returnerer POI-ens EGEN skrivemåte", () => {
    const { resolvePoi } = boardLinkResolvers(poisById, []);
    expect(resolvePoi("entur-NSR-StopPlace-60260")).toBe("entur-NSR-StopPlace-60260");
    expect(resolvePoi("ENTUR-NSR-STOPPLACE-60260")).toBe("entur-NSR-StopPlace-60260");
  });

  it("gir null for et sted utenfor boardet", () => {
    expect(boardLinkResolvers(poisById, []).resolvePoi("google-ukjent")).toBeNull();
  });

  it("godtar bare kategorier som faktisk finnes på boardet", () => {
    const { resolveCategory } = boardLinkResolvers(poisById, ["transport", "mat-drikke"]);
    expect(resolveCategory("transport")).toBe("transport");
    expect(resolveCategory("opplevelser")).toBeNull();
  });
});
