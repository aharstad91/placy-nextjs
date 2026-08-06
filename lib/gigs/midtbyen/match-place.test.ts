import { describe, it, expect } from "vitest";
import { TORVET } from "./anchor";
import {
  nameScore,
  normaliseName,
  pickBestPlaceMatch,
  type PlaceCandidate,
} from "./match-place";

/** Et punkt `meters` nord for Torvet — brukt til å plassere kandidater presist. */
function northOfTorvet(meters: number) {
  return { lat: TORVET.lat + meters / 111_320, lng: TORVET.lng };
}

const AAGAARD = { name: "Aagaard siden 1876", coordinates: northOfTorvet(120) };

function candidate(over: Partial<PlaceCandidate> = {}): PlaceCandidate {
  return {
    placeId: "ChIJtest",
    displayName: "AAGAARD siden 1876",
    location: northOfTorvet(120),
    ...over,
  };
}

describe("normaliseName", () => {
  it("fjerner kasus, diakritikk og tegnsetting", () => {
    expect(normaliseName("Reimers Th. Angells gt.")).toBe(
      "reimers th angells gt",
    );
  });

  it("translittererer æ, ø og å i stedet for å stryke dem", () => {
    // ø er en egen Unicode-bokstav, ikke o + diakritikk, så NFD alene lar den
    // stå — og tegnsettingsfjerningen ville gjort navnet til «bratt rkaia».
    expect(normaliseName("Brattørkaia Sykkel")).toBe("brattorkaia sykkel");
    expect(normaliseName("Lanullva Trøndelag")).toBe("lanullva trondelag");
    expect(normaliseName("Kjæledyr Ås")).toBe("kjaeledyr as");
  });

  it("gjør norsk og translitterert skrivemåte til samme streng", () => {
    // Google skriver ofte «Brattorkaia» der katalogen skriver «Brattørkaia».
    expect(nameScore("Brattørkaia sykkel", "Brattorkaia Sykkel")).toBe(1);
  });
});

describe("nameScore", () => {
  it("gir full poengsum når navnene er like bortsett fra skrivemåte", () => {
    expect(nameScore("Aagaard siden 1876", "AAGAARD siden 1876")).toBe(1);
  });

  it("gir full poengsum når det ene navnet inneholder det andre", () => {
    // Katalogen skriver filialen med gateadresse, Google bare kjeden.
    expect(nameScore("Reimers Th. Angells gt.", "Reimers")).toBe(1);
  });

  it("gir delvis poengsum ved delte ord", () => {
    expect(nameScore("Gullsmed Aas", "Aas Ur og Gull")).toBeCloseTo(0.5, 5);
  });

  it("gir null for navn uten overlapp", () => {
    expect(nameScore("Transit", "Bergans brandstore")).toBe(0);
  });

  it("ser bort fra ordmellomrom når navnene ellers er like", () => {
    // Katalogen skriver initialene med punktum og mellomrom, Google uten.
    // Ordvis sammenligning gir 1/3 og ville avvist et åpenbart treff.
    expect(nameScore("C. I. Pedersen", "CI Pedersen AS")).toBe(1);
  });

  it("lar ikke et kort navn sluke et lengre ved komprimert sammenligning", () => {
    // «bag» ligger inni «bagarstuga». Uten lengdekravet ville en veskebutikk
    // fått et bakeris åpningstider.
    expect(nameScore("BAG", "Bagarstuga")).toBeLessThan(0.5);
  });
});

describe("pickBestPlaceMatch", () => {
  it("velger kandidaten som er nær og har riktig navn", () => {
    const hit = candidate();
    expect(pickBestPlaceMatch(AAGAARD, [hit])).toBe(hit);
  });

  it("avviser en kandidat som ligger for langt unna butikkens koordinat", () => {
    // Samme navn, men 400 m unna — i Midtbyen er det en annen gate.
    expect(
      pickBestPlaceMatch(AAGAARD, [
        candidate({ location: northOfTorvet(600) }),
      ]),
    ).toBeNull();
  });

  it("avviser en nær kandidat med feil navn", () => {
    // Nabobygget er innenfor radien. Uten navnekontrollen ville butikken fått
    // nabolagets åpningstider.
    expect(
      pickBestPlaceMatch(AAGAARD, [candidate({ displayName: "Narvesen" })]),
    ).toBeNull();
  });

  it("velger høyeste navnescore blant flere nære kandidater", () => {
    const svak = candidate({ placeId: "svak", displayName: "Aagaard Kafé" });
    const sterk = candidate({ placeId: "sterk" });
    expect(pickBestPlaceMatch(AAGAARD, [svak, sterk])?.placeId).toBe("sterk");
  });

  it("godtar et treff i Midtbyen når butikken mangler koordinat", () => {
    // De ni g.page-oppføringene har ingen koordinat å kontrollere mot.
    const hit = candidate({ displayName: "Transit", location: northOfTorvet(800) });
    expect(pickBestPlaceMatch({ name: "Transit" }, [hit])).toBe(hit);
  });

  it("avviser et likelydende treff utenfor Midtbyen når koordinat mangler", () => {
    // «Transit» finnes i flere byer. Uten radiusvakten ville demoen vist
    // åpningstidene til en butikk i en annen by.
    expect(
      pickBestPlaceMatch({ name: "Transit" }, [
        candidate({ displayName: "Transit", location: { lat: 59.91, lng: 10.75 } }),
      ]),
    ).toBeNull();
  });

  it("avviser kandidater uten posisjon", () => {
    expect(
      pickBestPlaceMatch(AAGAARD, [candidate({ location: undefined })]),
    ).toBeNull();
  });

  it("gir null når det ikke finnes kandidater i det hele tatt", () => {
    expect(pickBestPlaceMatch(AAGAARD, [])).toBeNull();
  });
});
