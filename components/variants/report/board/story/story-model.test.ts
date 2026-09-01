import { describe, it, expect } from "vitest";
import type { BoardCategory, BoardPOI } from "../board-data";
import {
  AREA_LEAD,
  AREA_RAIL_LABEL,
  areaLabel,
  areaProse,
  areaSubline,
  storyBeat,
  STORY_EMPHASIS_OPACITY,
  STORY_EMPHASIS_PIN_SCALE,
  storyEmphasis,
  storyIsCurated,
  storyMinutes,
  storyPickIdentity,
  storyPickTitle,
  storyPicks,
} from "./story-model";

/**
 * Omvisningens modell — de reglene som avgjør HVA et stopp viser.
 *
 * Testene her er de som ville fanget en drift i innsalget: hvem som plukket de
 * tre stedene, i hvilken rekkefølge de nevnes, og hvor mye av strøksteksten som
 * slipper gjennom.
 */

function poi(
  id: string,
  opts: { name?: string; walk?: number; bike?: number } = {},
): BoardPOI {
  const coordinates = { lat: 63.43, lng: 10.4 };
  return {
    id: id as BoardPOI["id"],
    name: opts.name ?? id,
    coordinates,
    categoryId: "mat" as BoardPOI["categoryId"],
    raw: {
      id,
      name: opts.name ?? id,
      coordinates,
      category: {
        id: "restaurant",
        name: "Restaurant",
        icon: "Utensils",
        color: "#c33",
      },
      travelTime:
        opts.walk === undefined && opts.bike === undefined
          ? undefined
          : {
              ...(opts.walk !== undefined ? { walk: opts.walk } : {}),
              ...(opts.bike !== undefined ? { bike: opts.bike } : {}),
            },
    } as BoardPOI["raw"],
  };
}

function category(
  pois: BoardPOI[],
  highlights: { id: string; icon?: string; color?: string }[] = [],
): BoardCategory {
  return {
    id: "mat" as BoardCategory["id"],
    label: "Mat & drikke",
    lead: "",
    body: "",
    icon: "UtensilsCrossed",
    color: "#cc3300",
    pois,
    topRankedPois: [],
    editorial: highlights.length
      ? {
          body: "",
          highlights: highlights.map((h) => ({
            id: h.id as BoardPOI["id"],
            name: h.id,
            icon: h.icon ?? "Star",
            color: h.color ?? "#123456",
          })),
        }
      : undefined,
  } as BoardCategory;
}

describe("området — rekkefølgens første brikke", () => {
  it("bruker bydelen: det er ordet kjøperen søkte på", () => {
    expect(areaLabel({ district: "Ranheim", city: "Trondheim" })).toBe(
      "Ranheim",
    );
  });

  it("faller til byen, og deretter til et ord som er sant på enhver adresse", () => {
    expect(areaLabel({ city: "Trondheim" })).toBe("Trondheim");
    expect(areaLabel({})).toBe("Nabolaget");
    // Tom eller blank streng er ikke et navn — raden skal aldri stå tom.
    expect(areaLabel({ district: "   ", city: "Trondheim" })).toBe("Trondheim");
    expect(areaLabel({ district: "", city: "" })).toBe("Nabolaget");
  });

  it("summerer dekningen slik brikkene i raden summerer den", () => {
    const cat = (n: number) => ({ pois: Array.from({ length: n }) });
    expect(areaSubline([cat(13), cat(19)])).toBe("32 steder · 2 temaer");
    expect(areaSubline([cat(4)])).toBe("4 steder · 1 tema");
    expect(areaSubline([])).toBe("0 steder · 0 temaer");
  });

  it("brikkens ord er fast, og ALDRI stedsnavnet", () => {
    // Navnet står som overskrift rett under. To like ord i to komponenter
    // to centimeter fra hverandre gjorde brikken til et sjette tema.
    expect(AREA_RAIL_LABEL).toBe("Beliggenhet");
    // Og det er et annet slags ord enn stedsnavnets nødutgang.
    expect(AREA_RAIL_LABEL).not.toBe(areaLabel({}));
  });

  it("deler introen i avsnitt, og faller tilbake på den navigerende setningen", () => {
    expect(areaProse("Ett avsnitt.\n\nEt annet.\n\n\n  Og et tredje.  ")).toEqual([
      "Ett avsnitt.",
      "Et annet.",
      "Og et tredje.",
    ]);
    // Uten kuratert tekst dikter vi ikke opp et avsnitt om strøket.
    expect(areaProse(undefined)).toEqual([AREA_LEAD]);
    expect(areaProse("   ")).toEqual([AREA_LEAD]);
  });
});

describe("storyPicks — hvem plukket de tre", () => {
  it("bruker kuratorens highlights når de finnes, uansett rekkefølge i dataene", () => {
    const cat = category(
      [
        poi("a", { walk: 12 }),
        poi("b", { walk: 3 }),
        poi("c", { walk: 7 }),
        poi("d", { walk: 1 }),
      ],
      [{ id: "a" }, { id: "c" }],
    );
    expect(storyPicks(cat, "walk").map((p) => p.id)).toEqual(["c", "a"]);
  });

  it("faller tilbake på de tre NÆRMESTE målte når kategorien er ukuratert", () => {
    const cat = category([
      poi("a", { walk: 12 }),
      poi("b", { walk: 3 }),
      poi("c", { walk: 7 }),
      poi("d", { walk: 1 }),
    ]);
    expect(storyPicks(cat, "walk").map((p) => p.id)).toEqual(["d", "b", "c"]);
  });

  it("utelater steder uten målt tid fra maskinens utvalg", () => {
    const cat = category([poi("uten"), poi("med", { walk: 9 })]);
    expect(storyPicks(cat, "walk").map((p) => p.id)).toEqual(["med"]);
  });

  it("sorterer på AKTIV modus, ikke alltid på gange", () => {
    const cat = category([
      poi("langt-å-gå", { walk: 20, bike: 4 }),
      poi("kort-å-gå", { walk: 5, bike: 9 }),
    ]);
    expect(storyPicks(cat, "bike").map((p) => p.id)).toEqual([
      "langt-å-gå",
      "kort-å-gå",
    ]);
  });

  it("hopper over en highlight som ikke finnes blant kategoriens punkter", () => {
    const cat = category(
      [poi("finnes", { walk: 4 })],
      [{ id: "borte" }, { id: "FINNES" }],
    );
    // Oppslaget er case-insensitivt — highlight-IDer og POI-IDer har driftet
    // i kasus mellom pipeline-generasjoner.
    expect(storyPicks(cat, "walk").map((p) => p.id)).toEqual(["finnes"]);
  });

  it("gir aldri mer enn tre", () => {
    const cat = category([1, 2, 3, 4, 5].map((n) => poi(`p${n}`, { walk: n })));
    expect(storyPicks(cat, "walk")).toHaveLength(3);
  });

  it("navnet avgjør likhet, så to steder med samme minutt ikke bytter plass", () => {
    const cat = category([poi("b", { walk: 5 }), poi("a", { walk: 5 })]);
    expect(storyPicks(cat, "walk").map((p) => p.id)).toEqual(["a", "b"]);
  });
});

describe("kuratert vs. ukuratert", () => {
  it("skillet ligger i HVEM som plukket, ikke i om omvisningen finnes", () => {
    expect(storyIsCurated(category([poi("a")], [{ id: "a" }]))).toBe(true);
    expect(storyIsCurated(category([poi("a")]))).toBe(false);
  });

  it("overskriften lover ikke et menneskes utvalg når maskinen plukket", () => {
    expect(storyPickTitle(category([poi("a")], [{ id: "a" }]))).toBe(
      "Verdt å merke seg",
    );
    expect(storyPickTitle(category([poi("a")]))).toBe("Nærmest hjemmefra");
  });

  it("`generated`-flagget teller som maskinens utvalg, selv med highlights", () => {
    // Regresjon (Wesselsløkka, 2026-09-01): et nivå-1-board FÅR alltid
    // highlights — `pickGeneratedHighlights` fyller dem. `storyIsCurated` så
    // bare på lengden, så maskinens tre punkter sto under «Verdt å merke seg»,
    // som er løftet om et menneskes utvalg. Flagget fantes allerede; det ble
    // bare ikke lest.
    const generated = category([poi("a")], [{ id: "a" }]);
    generated.editorial = { ...generated.editorial!, generated: true };
    expect(storyIsCurated(generated)).toBe(false);
    expect(storyPickTitle(generated)).toBe("Nærmest hjemmefra");
  });

  it("brikken arver kuratorens identitet, ellers kategoriens", () => {
    const p = poi("a");
    const curated = category(
      [p],
      [{ id: "a", icon: "Train", color: "#abcdef" }],
    );
    expect(storyPickIdentity(p, curated)).toEqual({
      icon: "Train",
      color: "#abcdef",
    });
    expect(storyPickIdentity(p, category([p]))).toEqual({
      icon: "UtensilsCrossed",
      color: "#cc3300",
    });
  });
});

describe("storyBeat — to setninger, kuttet på setningsslutt", () => {
  it("kutter etter andre setning", () => {
    expect(storyBeat("En. To. Tre. Fire.")).toBe("En. To.");
  });

  it("lar korte tekster stå urørt", () => {
    expect(storyBeat("Bare én setning.")).toBe("Bare én setning.");
  });

  it("beholder hele teksten når den ikke har setningsskiller", () => {
    expect(storyBeat("Ingen punktum her")).toBe("Ingen punktum her");
  });

  it("legger aldri på en ellipse — kuttet er usynlig", () => {
    expect(storyBeat("En. To. Tre.")).not.toContain("…");
  });

  it("tåler manglende tekst", () => {
    expect(storyBeat(undefined)).toBe("");
  });
});

describe("storyMinutes — aldri et estimat (R26)", () => {
  it("leser aktiv modus", () => {
    expect(storyMinutes(poi("a", { walk: 4, bike: 2 }), "bike")).toBe(2);
  });

  it("gir undefined når modusen mangler på punktet", () => {
    expect(storyMinutes(poi("a", { walk: 4 }), "car")).toBeUndefined();
  });

  it("siler bort en korrupt verdi", () => {
    const p = poi("a");
    (p.raw as { travelTime?: Record<string, unknown> }).travelTime = {
      walk: Number.NaN,
    };
    expect(storyMinutes(p, "walk")).toBeUndefined();
  });
});

describe("storyEmphasis — tre nivåer, ikke to", () => {
  const named = new Set(["a"]);
  it("de tre navngitte bærer scenen", () => {
    expect(storyEmphasis("a", "mat", "mat", named)).toBe("named");
  });
  it("kategorien rundt viser at dekningen finnes", () => {
    expect(storyEmphasis("b", "mat", "mat", named)).toBe("scene");
  });
  it("resten av nabolaget ligger igjen som tekstur", () => {
    expect(storyEmphasis("c", "natur", "mat", named)).toBe("texture");
  });
  it("et navngitt sted beholder vekten sin også utenfor stoppets kategori", () => {
    expect(storyEmphasis("a", "natur", "mat", named)).toBe("named");
  });

  /* Gulvet er en grense, ikke en verdi vi tuner: dempede punkter tar imot trykk
     som alle andre, og for langt ned leser de som avskrudd. */
  it("holder de dempede over 50 % — de er dempet, ikke deaktivert", () => {
    expect(STORY_EMPHASIS_OPACITY.texture).toBeGreaterThanOrEqual(0.5);
  });

  /* Opacityen bærer ikke skillet lenger — den er et hint om dybde. Tre runder
     (26/50/75 %) viste at aksen ikke kan gjøre begge jobbene: lese temaet OG se
     levende. Størrelsen gjør det. */
  it("gir temaets egne punkter full styrke, også de som ikke er navngitt", () => {
    expect(STORY_EMPHASIS_OPACITY.named).toBe(1);
    expect(STORY_EMPHASIS_OPACITY.scene).toBe(1);
    expect(STORY_EMPHASIS_OPACITY.texture).toBeGreaterThanOrEqual(0.9);
  });

  it("skiller på STØRRELSE: nabolaget rundt tegnes mindre enn temaet", () => {
    expect(STORY_EMPHASIS_PIN_SCALE.named).toBe(1);
    expect(STORY_EMPHASIS_PIN_SCALE.scene).toBe(1);
    expect(STORY_EMPHASIS_PIN_SCALE.texture).toBeLessThan(1);
    // Ikke så lite at ikonet blir uleselig — da er vi tilbake til prikken.
    expect(STORY_EMPHASIS_PIN_SCALE.texture).toBeGreaterThanOrEqual(0.6);
  });
});
