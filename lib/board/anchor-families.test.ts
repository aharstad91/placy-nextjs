import { describe, it, expect } from "vitest";
import {
  ANCHOR_FAMILIES,
  ALL_ANCHOR_CATEGORY_IDS,
  hasSiteNoun,
  isFamilyCandidate,
} from "./anchor-families";
import { resolveAnchors } from "./anchor-membership";

const ANLEGG = ANCHOR_FAMILIES.find((f) => f.id === "anlegg")!;
const KJOPESENTER = ANCHOR_FAMILIES.find((f) => f.id === "kjopesenter")!;

describe("hasSiteNoun — navne-gaten for idrettsanlegg", () => {
  it("godtar ordene som betyr ANLEGGET", () => {
    // Alle fire er ekte navn fra poolen.
    expect(hasSiteNoun("Ranheim Idrettspark")).toBe(true);
    expect(hasSiteNoun("Leangen Idrettsanlegg")).toBe(true);
    expect(hasSiteNoun("Jakobsli idrettsplass")).toBe(true);
    expect(hasSiteNoun("Øya stadion")).toBe(true);
  });

  it("avviser ordene som betyr ENHETEN inne i anlegget", () => {
    // Dette er hele poenget med gaten: tar vi inn «hall» og «arena», blir
    // stadion ankeret og anlegget medlem — feil vei.
    expect(hasSiteNoun("Ranheimshallen")).toBe(false);
    expect(hasSiteNoun("Ranheim Extra Arena")).toBe(false);
    expect(hasSiteNoun("Charlottenlundhallen")).toBe(false);
    expect(hasSiteNoun("Ranheim Kunstgress 9'er")).toBe(false);
    expect(hasSiteNoun("Lade tennisbaner")).toBe(false);
    expect(hasSiteNoun("Trondheim Ice Rink")).toBe(false);
  });

  it("tåler bestemt form", () => {
    expect(hasSiteNoun("Idrettsplassen")).toBe(true);
    expect(hasSiteNoun("Vikhammer idrettsplassen")).toBe(true);
  });

  it("treffer ikke ordet som delstreng i et annet ord", () => {
    // Ordgrensen er der for at «Stadionvegen 4» ikke skal bli et anlegg.
    expect(hasSiteNoun("Stadionvegen 4")).toBe(false);
    expect(hasSiteNoun("Idrettsparkveien 12")).toBe(false);
  });
});

describe("isFamilyCandidate — kategorien OG navnet", () => {
  it("idrettsanlegg krever begge", () => {
    expect(isFamilyCandidate(ANLEGG, { name: "Lade idrettspark", categoryId: "idrett" })).toBe(true);
    // Riktig navn, feil kategori: bussholdeplassen «Leangen idrettspark» er
    // veifinning, ikke et anlegg.
    expect(isFamilyCandidate(ANLEGG, { name: "Leangen idrettspark", categoryId: "bus" })).toBe(false);
    // Riktig kategori, feil navn.
    expect(isFamilyCandidate(ANLEGG, { name: "Ranheimshallen", categoryId: "idrett" })).toBe(false);
  });

  it("kjøpesenteret har ingen navne-gate — Google-typen er gaten", () => {
    expect(isFamilyCandidate(KJOPESENTER, { name: "Sirkus Shopping", categoryId: "shopping" })).toBe(true);
    // Også søppelet: «Tem Im thaimat» bærer shopping_mall hos Google og slipper
    // inn her. Realitets-gaten (≥4 medlemmer) er det som stopper den.
    expect(isFamilyCandidate(KJOPESENTER, { name: "Tem Im thaimat", categoryId: "shopping" })).toBe(true);
  });

  it("en svømmehall er medlem, aldri kandidat", () => {
    expect(isFamilyCandidate(ANLEGG, { name: "Charlottenlund svømmehall", categoryId: "swimming" })).toBe(false);
    expect(ANLEGG.options.memberCategoryIds?.has("swimming")).toBe(true);
  });

  it("alle anker-kategorier er dekket", () => {
    expect([...ALL_ANCHOR_CATEGORY_IDS].sort()).toEqual(["idrett", "shopping"]);
  });
});

describe("anleggs-familien — kategori-skranken", () => {
  // Ranheim Idrettspark med naboene sine, på ekte koordinater.
  const park = { id: "park", name: "Ranheim Idrettspark", address: null, lat: 63.4279771, lng: 10.5252197 };
  const at = (dLat: number, dLng: number) => ({ lat: 63.4279771 + dLat, lng: 10.5252197 + dLng });

  const pois = [
    { id: "hall", name: "Ranheimshallen", address: null, ...at(0.0008, -0.0004), categoryId: "idrett" },
    { id: "arena", name: "Ranheim Extra Arena", address: null, ...at(0.0005, -0.0013), categoryId: "idrett" },
    { id: "gress", name: "Ranheim Kunstgress", address: null, ...at(0.0001, 0.0002), categoryId: "idrett" },
    { id: "aktiv", name: "Ranheim aktivitetshall", address: null, ...at(0.0006, 0.0023), categoryId: "idrett" },
    { id: "basseng", name: "Ranheim basseng", address: null, ...at(0.0002, 0.0004), categoryId: "swimming" },
    // De tre som IKKE skal absorberes, alle innenfor 500 m.
    { id: "rema", name: "REMA 1000 Ranheimsfjæra", address: null, ...at(-0.001, 0.0025), categoryId: "supermarket" },
    { id: "tann", name: "Ranheim tannklinikk", address: null, ...at(0.0005, -0.0011), categoryId: "dentist" },
    { id: "bib", name: "Trondheim folkebibliotek Ranheim", address: null, ...at(0.0005, -0.0012), categoryId: "library" },
  ];

  const result = resolveAnchors([park], pois, ANLEGG.options);

  it("anlegget blir ett anker", () => {
    expect(result.anchors).toHaveLength(1);
    expect(result.anchors[0].name).toBe("Ranheim Idrettspark");
  });

  it("absorberer idrett og svømming — medlemmene DELER kategori med ankeret", () => {
    expect(result.anchors[0].memberIds.sort()).toEqual(["aktiv", "arena", "basseng", "gress", "hall"]);
  });

  it("absorberer ALDRI dagligvaren, tannlegen eller biblioteket", () => {
    // Uten denne skranken er 500 m-radiusen katastrofal: nabolagets viktigste
    // POI forsvinner inn i en fotballbane.
    for (const id of ["rema", "tann", "bib"]) {
      expect(result.parentByPoiId.has(id)).toBe(false);
    }
  });
});

describe("anleggs-familien — samme anlegg under to navn", () => {
  // Målt: Google og OSM har hver sin rad for Ranheim, 130 m fra hverandre.
  const google = {
    id: "google-park", name: "Ranheim Idrettspark", address: "Ranheimsvegen 166, Trondheim",
    lat: 63.4279771, lng: 10.5252197, reviewCount: 1,
  };
  const osm = {
    id: "osm-way-84078488", name: "Ranheim idrettsanlegg", address: null,
    lat: 63.4279173, lng: 10.5265199, reviewCount: 0,
  };
  const members = [
    { id: "m1", name: "Ranheimshallen", address: null, lat: 63.42876, lng: 10.52281, categoryId: "idrett" },
    { id: "m2", name: "Ranheim Extra Arena", address: null, lat: 63.42836, lng: 10.52406, categoryId: "idrett" },
    { id: "m3", name: "Ranheim Kunstgress", address: null, lat: 63.42798, lng: 10.52540, categoryId: "idrett" },
    { id: "m4", name: "Ranheim aktivitetshall", address: null, lat: 63.42836, lng: 10.52739, categoryId: "idrett" },
  ];
  const result = resolveAnchors([google, osm], members, ANLEGG.options);

  it("blir ETT anker, ikke to", () => {
    expect(result.anchors).toHaveLength(1);
  });

  it("Google-oppføringen vinner navnet — den er stedet publikum kjenner", () => {
    expect(result.anchors[0].name).toBe("Ranheim Idrettspark");
  });

  it("taperen blir medlem, ikke en ensom tvillingpinne", () => {
    expect(result.parentByPoiId.get("osm-way-84078488")).toBe("google-park");
  });

  it("tvillingen teller IKKE i firetallet — den er samme sted", () => {
    // Fire ekte medlemmer + tvillingen = fem rader, men firetallet måles på de
    // fire. Fjernes ett ekte medlem, faller ankeret.
    const tynnere = resolveAnchors([google, osm], members.slice(0, 3), ANLEGG.options);
    expect(tynnere.anchors).toHaveLength(0);
  });
});

describe("anleggs-familien — to anlegg forblir to", () => {
  it("Charlottenlund og Brundalen ligger 520 m fra hverandre og kollapser ikke", () => {
    const charlottenlund = { id: "c", name: "Charlottenlund idrettsanlegg", address: null, lat: 63.42551, lng: 10.48790 };
    const brundalen = { id: "b", name: "Brundalen idrettsplass", address: null, lat: 63.42084, lng: 10.48669 };
    const near = (base: { lat: number; lng: number }, i: number) =>
      Array.from({ length: 4 }, (_, k) => ({
        id: `${base.lat}-${k}`, name: `Bane ${i}${k}`, address: null,
        lat: base.lat + 0.0003 * k, lng: base.lng + 0.0002, categoryId: "idrett",
      }));
    const result = resolveAnchors(
      [charlottenlund, brundalen],
      [...near(charlottenlund, 1), ...near(brundalen, 2)],
      ANLEGG.options,
    );
    expect(result.anchors.map((a) => a.anchorId).sort()).toEqual(["b", "c"]);
    const seen = new Set<string>();
    for (const a of result.anchors) for (const id of a.memberIds) {
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });
});
