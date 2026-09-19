import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BoardData } from "@/components/variants/report/board/board-data";
import {
  boardKnowledgeBase,
  buildProductionAssistantSource,
} from "@/lib/live/production-board";
import { spokenBoardProjection } from "@/lib/realtime/spoken-projection";
import type { LiveTransportClient } from "@/lib/realtime/live-transport";

function board(): BoardData {
  const raw = {
    id: "cafe-1",
    name: "Fyr",
    address: "Lade allé 9",
    coordinates: { lat: 63.44, lng: 10.45 },
    enturStopplaceId: "NSR:StopPlace:123",
    category: { id: "cafe", name: "Kafé", icon: "Coffee", color: "#000" },
  };
  return {
    projectId: "project-1",
    projectCustomer: "customer",
    projectSlug: "leangenbukta",
    contentVersion: "version-1",
    assistant: { enabled: true, name: "Anja", guided: true },
    home: {
      name: "Leangenbukta",
      address: "Haakon VIIs gate 14",
      coordinates: { lat: 63.44, lng: 10.46 },
      heroIntro: "Prosjektet ligger i Haakon VIIs gate 14.",
    },
    globalFaq: [{ id: "address-in-faq", question: "Hvor ligger Fyr?", answer: "Fyr ligger i Lade allé 9.", source: "deterministic" }],
    categories: [
      {
        id: "servering" as never,
        label: "Servering",
        lead: "Besøk Fyr i Lade allé 9.",
        body: "Servering ved Lade allé 9.",
        icon: "Coffee",
        color: "#000",
        pois: [
          {
            id: "cafe-1" as never,
            name: "Fyr",
            address: "Lade allé 9",
            categoryId: "servering" as never,
            coordinates: raw.coordinates,
            icon: "Coffee",
            color: "#000",
            raw,
          },
        ],
        topRankedPois: [],
      },
    ],
    poisById: new Map([["cafe-1", raw]]),
    publishedKnowledge: [
      {
        id: "claim-place",
        poiId: "cafe-1",
        projectId: "project-1",
        scope: "project",
        subjectId: "fyr",
        subjectName: "Fyr",
        topic: "Servering",
        field: "concept",
        factText: "Serverer mat og drikke.",
        confidence: "high",
        sourceUrls: ["https://example.com/fyr"],
        sourceTitles: ["Fyr"],
        reviewStatus: "approved",
        temporalKind: "existing",
        reusableAcrossBoards: false,
        mappingStatus: "mapped",
      },
      {
        id: "claim-project",
        projectId: "project-1",
        scope: "project",
        subjectId: "planned-kindergarten",
        subjectName: "Planlagt barnehage",
        topic: "Oppvekst",
        field: "status",
        factText: "Tomten er regulert, men byggestart er ikke dokumentert.",
        confidence: "high",
        sourceUrls: ["https://example.com/plan"],
        sourceTitles: ["Reguleringsplan"],
        reviewStatus: "approved",
        temporalKind: "regulated",
        reusableAcrossBoards: false,
        mappingStatus: "not_applicable",
      },
      {
        id: "claim-unmapped-place",
        projectId: "project-1",
        scope: "global_place",
        subjectId: "place-without-pin",
        subjectName: "Et revidert sted uten kartpunkt",
        topic: "Servering",
        field: "concept",
        factText: "Stedet er kildekontrollert, men kartkoblingen er ikke bekreftet.",
        confidence: "high",
        sourceUrls: ["https://example.com/unmapped"],
        sourceTitles: ["Primærkilde"],
        reviewStatus: "approved",
        temporalKind: "existing",
        reusableAcrossBoards: true,
        mappingStatus: "unmapped",
      },
    ],
    audioTourEnabled: false,
  };
}

describe("production board assistant source", () => {
  it("leser boardet uten Next-requestcache fordi tjenesten kjører som sidecar", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/live/production-board.ts"),
      "utf8",
    );
    expect(source).toContain('from "@/lib/data-server"');
    expect(source).not.toContain("cached-board-reads");
    expect(source).not.toContain("getCachedReportProduct");
  });

  it("bygger kildegrunnlag av publishedKnowledge uten demoidentitet", () => {
    const source = buildProductionAssistantSource(board());
    expect(source.contentVersion).toBe("version-1");
    expect(source.backendInstructions).toContain("Leangenbukta");
    expect(source.backendInstructions).not.toContain("Nyhavna");
    expect(source.voiceInstructions).toContain("Anja");
    expect(source.tools.map((tool) => tool.name)).toContain("find_places");
    expect(source.tools.map((tool) => tool.name)).toContain("get_live_departures");
  });

  it("beholder prosjektfakta uten falsk kart-ID", () => {
    const knowledge = boardKnowledgeBase(board());
    expect(knowledge.area.facts.map((fact) => fact.text)).toContain(
      "Tomten er regulert, men byggestart er ikke dokumentert.",
    );
    expect(knowledge.entities[0]?.mapPoiId).toBe("cafe-1");
    expect(knowledge.entities).toContainEqual(expect.objectContaining({
      id: "place-without-pin",
      mapPoiId: null,
      facts: [expect.objectContaining({
        text: "Stedet er kildekontrollert, men kartkoblingen er ikke bekreftet.",
      })],
    }));
  });

  it("avviser boards uten eksplisitt assistent-opt-in", () => {
    const input = board();
    input.assistant = { enabled: false };
    expect(() => buildProductionAssistantSource(input)).toThrow(
      "Assistenten er ikke aktivert",
    );
  });

  it("beholder adresse visuelt, men fjerner den fra alle normale modellflater", () => {
    const input = board();
    const spoken = spokenBoardProjection(input);
    expect(input.categories[0]?.pois[0]?.address).toBe("Lade allé 9");
    expect(JSON.stringify(spoken)).not.toContain("Lade allé 9");
    expect(JSON.stringify(spoken)).not.toContain("Haakon VIIs gate 14");

    const source = buildProductionAssistantSource(input);
    const conversation = source.createConversation();
    const normal = [
      conversation.execute("find_places", { query: "Fyr" }),
      conversation.execute("get_place_facts", { poi_id: "cafe-1" }),
      conversation.execute("get_board_facts", {}),
      conversation.execute("open_theme", { theme_id: "servering" }),
    ];
    expect(JSON.stringify({ instructions: source.backendInstructions, normal })).not.toContain("Lade allé 9");
    expect(JSON.stringify(normal)).not.toContain("Haakon VIIs gate 14");
  });

  it("gir adresse bare gjennom eksplisitt, servervalidert adresseverktøy", () => {
    const source = buildProductionAssistantSource(board());
    expect(source.tools.map((tool) => tool.name)).toContain("get_place_address");
    const conversation = source.createConversation();
    expect(conversation.execute("get_place_address", { poi_id: "cafe-1", purpose: "address" }).result)
      .toEqual({ id: "cafe-1", name: "Fyr", address: "Lade allé 9", purpose: "address" });
    expect(conversation.execute("get_place_address", { poi_id: "cafe-1", purpose: "curiosity" }).result)
      .toHaveProperty("error");
    expect(conversation.execute("get_place_address", { poi_id: "unknown", purpose: "address" }).result)
      .toHaveProperty("error");
  });

  it("bruker live Entur for validerte boardsteder og beholder turens returpunkt", async () => {
    const client: LiveTransportClient = {
      departures: vi.fn(async () => ({
        stopPlace: { id: "NSR:StopPlace:123", name: "Leangenbukta" },
        fetchedAt: "2026-09-19T08:00:00.000Z",
        quays: [{ quayId: "NSR:Quay:1", departures: [{
          departureTime: "2026-09-19T08:06:00+02:00",
          expectedDepartureTime: "2026-09-19T08:05:00+02:00",
          actualDepartureTime: "2026-09-19T08:06:00+02:00",
          isRealtime: true,
          destination: "Sentrum",
          lineCode: "2",
          transportMode: "bus",
        }] }],
        departures: [],
      })),
      trip: vi.fn(async () => ({
        fetchedAt: "2026-09-19T08:00:00.000Z",
        trips: [{ duration: 14, walkDistance: 180, legs: [{ mode: "bus", distance: 3000, duration: 10, lineCode: "2", from: "Leangenbukta", to: "Fyr" }] }],
      })),
    };
    const conversation = buildProductionAssistantSource(board(), client).createConversation();
    conversation.execute("set_interests", { interests: ["mat"], theme_ids: ["servering"] });
    conversation.execute("note_detour", { about: "buss" });

    const departures = (await conversation.execute("get_live_departures", { poi_id: "cafe-1" })).result;
    expect(client.departures).toHaveBeenCalledWith("NSR:StopPlace:123", 5);
    expect(departures).toMatchObject({
      live: true,
      fetched_at: "2026-09-19T08:00:00.000Z",
      departures: [{
        line: "2",
        direction: "Sentrum",
        expected_departure_time: "2026-09-19T08:05:00+02:00",
        actual_departure_time: "2026-09-19T08:06:00+02:00",
      }],
    });

    const trip = (await conversation.execute("plan_live_transit_trip", { destination_poi_id: "cafe-1" })).result;
    expect(client.trip).toHaveBeenCalledWith(board().home.coordinates, board().categories[0].pois[0].coordinates, 3);
    expect(trip).toMatchObject({ live: true, destination: { poi_id: "cafe-1", name: "Fyr" }, trips: [{ duration: 14 }] });
    expect(conversation.execute("return_to_tour", {}).result).toMatchObject({ ok: true, chapter: { theme_id: "servering" } });
  });
});
