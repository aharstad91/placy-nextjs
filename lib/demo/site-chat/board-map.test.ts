import { describe, expect, it } from "vitest";
import type { BoardCategory, BoardData, BoardPOI } from "@/components/variants/report/board/board-data";
import {
  boardMapStateNote,
  createBoardMapPort,
  faqAnswerPlainText,
} from "@/lib/demo/site-chat/board-map";

/**
 * `createBoardMapPort` og hjelperne rundt den, isolert fra backend-løkka.
 *
 * `backend.test.ts` dekker `highlight_places` gjennom hele Responses-løkka
 * (U4-serien i "Boardets agentmodus"-describen); resten av porten —
 * `show_place`, `show_category`, `set_travel_mode`, `clear_highlights`, et
 * ukjent verktøynavn — og de to fristående hjelperne (`boardMapStateNote`,
 * `faqAnswerPlainText`) har ingen tester ennå. `server-only` (importert av
 * `board-map.ts`) er aliaset til en no-op-stubb i `vitest.config.ts`, samme
 * mekanisme `backend.test.ts` allerede lener seg på — ingen egen mock trengs
 * her.
 */

function poi(
  id: string,
  categoryId: string,
  extra: Partial<BoardPOI["raw"]> = {},
): BoardPOI {
  const coordinates = { lat: 63.43, lng: 10.4 };
  return {
    id: id as BoardPOI["id"],
    name: id,
    coordinates,
    categoryId: categoryId as BoardPOI["categoryId"],
    icon: "MapPin",
    color: "#94a3b8",
    raw: {
      id,
      name: id,
      coordinates,
      category: { id: "cat", name: "Kategori", icon: "MapPin", color: "#94a3b8" },
      ...extra,
    } as BoardPOI["raw"],
  };
}

function boardData(): BoardData {
  // «naer» har lagrede reisetider for walk/bike, aldri car — dekker både
  // «gyldig reisemåte med data» og «gyldig reisemåte uten NOEN lagrede tider»
  // uten å måtte bygge to separate board-fixturer.
  const naer = poi("naer", "mat", { travelTime: { walk: 3, bike: 2 } });
  const fjern = poi("fjern", "mat", {});

  const categories = [
    {
      id: "mat" as BoardCategory["id"],
      label: "Mat & drikke",
      question: "Hvor spiser jeg?",
      lead: "",
      body: "",
      icon: "UtensilsCrossed",
      color: "#cc3300",
      pois: [naer, fjern],
      topRankedPois: [],
    },
    {
      id: "natur" as BoardCategory["id"],
      label: "Natur & friluft",
      question: "Kommer jeg ut i naturen?",
      lead: "",
      body: "",
      icon: "TreePine",
      color: "#2f6f4f",
      pois: [],
      topRankedPois: [],
    },
  ] as unknown as BoardCategory[];

  const poisById = new Map<string, { id: string }>([
    ["naer", { id: "naer" }],
    ["fjern", { id: "fjern" }],
  ]);

  return {
    projectSlug: "test",
    home: {
      name: "Test",
      address: "Testveien 1",
      coordinates: { lat: 63.43, lng: 10.4 },
    },
    categories,
    poisById,
    audioTourEnabled: false,
  } as unknown as BoardData;
}

describe("createBoardMapPort — show_place", () => {
  it("kjent ID gir et direktiv med stedets kart-ID", () => {
    const port = createBoardMapPort(boardData());
    const { result, directive } = port.execute("show_place", { poi_id: "naer" });
    expect(result).toEqual({ ok: true, shown: "naer", poi_id: "naer" });
    expect(directive).toEqual({ name: "show_place", args: { poi_id: "naer" } });
  });

  it("ukjent ID gir en feilmelding til modellen, uten direktiv", () => {
    const port = createBoardMapPort(boardData());
    const { result, directive } = port.execute("show_place", {
      poi_id: "finnes-ikke",
    });
    expect(directive).toBeNull();
    expect(result).toMatchObject({ error: expect.any(String) });
  });
});

describe("createBoardMapPort — show_category", () => {
  it("kjent tema-ID gir et direktiv", () => {
    const port = createBoardMapPort(boardData());
    const { result, directive } = port.execute("show_category", {
      category_id: "mat",
    });
    expect(result).toEqual({ ok: true, shown: "Mat & drikke", category_id: "mat" });
    expect(directive).toEqual({
      name: "show_category",
      args: { category_id: "mat" },
    });
  });

  it("ukjent tema-ID gir feil uten direktiv", () => {
    const port = createBoardMapPort(boardData());
    const { result, directive } = port.execute("show_category", {
      category_id: "finnes-ikke",
    });
    expect(directive).toBeNull();
    expect(result).toMatchObject({ error: expect.any(String) });
  });
});

describe("createBoardMapPort — set_travel_mode", () => {
  it("gyldig reisemåte med lagrede tider gir et direktiv (walk)", () => {
    const port = createBoardMapPort(boardData());
    const { result, directive } = port.execute("set_travel_mode", { mode: "walk" });
    expect(result).toEqual({ ok: true, shown: "Reisemåte: walk" });
    expect(directive).toEqual({ name: "set_travel_mode", args: { mode: "walk" } });
  });

  it("gyldig reisemåte med lagrede tider gir et direktiv (bike)", () => {
    const port = createBoardMapPort(boardData());
    const { result, directive } = port.execute("set_travel_mode", { mode: "bike" });
    expect(result).toEqual({ ok: true, shown: "Reisemåte: bike" });
    expect(directive).toEqual({ name: "set_travel_mode", args: { mode: "bike" } });
  });

  it("ukjent reisemåte gir feil uten direktiv", () => {
    const port = createBoardMapPort(boardData());
    const { result, directive } = port.execute("set_travel_mode", { mode: "fly" });
    expect(directive).toBeNull();
    expect(result).toMatchObject({ error: expect.any(String) });
  });

  it("gyldig reisemåte uten NOEN lagrede tider på boardet gir feil uten direktiv (car)", () => {
    const port = createBoardMapPort(boardData());
    const { result, directive } = port.execute("set_travel_mode", { mode: "car" });
    expect(directive).toBeNull();
    expect(result).toMatchObject({ error: expect.any(String) });
  });
});

describe("createBoardMapPort — clear_highlights og ukjent verktøy", () => {
  it("clear_highlights gir alltid et direktiv", () => {
    const port = createBoardMapPort(boardData());
    const { result, directive } = port.execute("clear_highlights", {});
    expect(result).toEqual({ ok: true, shown: "Fremhevingen er fjernet" });
    expect(directive).toEqual({ name: "clear_highlights", args: {} });
  });

  it("et ukjent verktøynavn gir feil uten direktiv", () => {
    const port = createBoardMapPort(boardData());
    const { result, directive } = port.execute("teleport_home", {});
    expect(directive).toBeNull();
    expect(result).toMatchObject({ error: expect.stringContaining("teleport_home") });
  });
});

describe("boardMapStateNote", () => {
  it("null/undefined tilstand gir ingen linje", () => {
    const board = boardData();
    expect(boardMapStateNote(board, null)).toBeNull();
    expect(boardMapStateNote(board, undefined)).toBeNull();
  });

  it("bygger én linje med tema, valgt sted og reisemåte når alt er kjent", () => {
    const note = boardMapStateNote(boardData(), {
      selectedCategoryId: "mat",
      selectedPlaceId: "naer",
      travelMode: "walk",
    });
    expect(note).toBe("Kartet nå: tema Mat & drikke, valgt sted naer, reisemåte walk.");
  });

  it("ukjente tema-/sted-ID-er ignoreres — reisemåten står alltid igjen", () => {
    const note = boardMapStateNote(boardData(), {
      selectedCategoryId: "finnes-ikke",
      selectedPlaceId: "finnes-ikke",
      travelMode: "bike",
    });
    expect(note).toBe("Kartet nå: reisemåte bike.");
  });
});

describe("faqAnswerPlainText", () => {
  it("fjerner lenkemarkeringen, beholder teksten, og henter ut den gyldige POI-ID-en", () => {
    const { text, poiIds } = faqAnswerPlainText(
      boardData(),
      "Du finner [nærbutikken](poi:naer) rett rundt hjørnet.",
    );
    expect(text).toBe("Du finner nærbutikken rett rundt hjørnet.");
    expect(poiIds).toEqual(["naer"]);
  });

  it("en referanse til et sted som ikke er på boardet blir ren tekst — degradert, ikke sensurert", () => {
    const { text, poiIds } = faqAnswerPlainText(
      boardData(),
      "Se [et sted som ikke finnes](poi:finnes-ikke) i nærheten.",
    );
    expect(text).toBe("Se et sted som ikke finnes i nærheten.");
    expect(poiIds).toEqual([]);
  });

  it("svar uten lenker returneres uendret, uten POI-ID-er", () => {
    const { text, poiIds } = faqAnswerPlainText(boardData(), "Vanlig svar uten lenker.");
    expect(text).toBe("Vanlig svar uten lenker.");
    expect(poiIds).toEqual([]);
  });
});
