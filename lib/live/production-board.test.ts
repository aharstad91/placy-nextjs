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
    expect(source.voiceInstructions).toContain("Leangen-bukta");
    expect(source.backendInstructions).toContain("NÆRHET");
    expect(source.tools.map((tool) => tool.name)).toContain("find_places");
    expect(source.tools.map((tool) => tool.name)).toContain("get_live_departures");
  });

  it("bruker boardets eget uttalehint framfor navnebasert kompatibilitet", () => {
    const input = board();
    input.assistant = { ...input.assistant!, pronunciation: "Uttal Lillebytunet som «Lille-by-tunet»." };
    const source = buildProductionAssistantSource(input);
    expect(source.voiceInstructions).toContain("Lille-by-tunet");
    expect(source.voiceInstructions).not.toContain("Leangen-bukta");
  });

  it("faller tilbake til generisk uttale for et board uten eget hint", () => {
    // Et tredje prosjekt skal ikke arve et annet prosjekts uttalehint.
    const input = board();
    input.home = { ...input.home, name: "Lillebytunet" };
    const source = buildProductionAssistantSource(input);
    expect(source.voiceInstructions).toContain("Uttal stedsnavnet Lillebytunet naturlig på norsk.");
    expect(source.voiceInstructions).not.toContain("Leangen-bukta");
  });

  it("prioriterer faktisk nærhet foran redaksjonelle temahøydepunkter", () => {
    const input = board();
    const category = input.categories[0]!;
    const near = category.pois[0]!;
    const far = {
      ...near,
      id: "far-place" as never,
      name: "Redaksjonelt sted langt unna",
      raw: { ...near.raw, id: "far-place", name: "Redaksjonelt sted langt unna", travelTime: { walk: 35 } },
    };
    near.raw.travelTime = { walk: 4 };
    category.pois = [far, near];
    category.editorial = {
      intro: "Servering",
      body: "Servering",
      highlights: [{ id: "far-place", label: "Langt unna" }],
    } as never;
    const opened = buildProductionAssistantSource(input).createConversation()
      .execute("open_theme", { theme_id: "servering" });
    const chapter = (opened.result as { chapter: { intro: string; places: Array<{ id: string }> } }).chapter;
    expect(chapter.places.map((place) => place.id))
      .toEqual(["cafe-1", "far-place"]);
    expect(chapter.intro).toBe("Servering");
    expect(chapter.intro).not.toContain("Langt unna");
  });

  it("beholder temafortellingen samtidig som steder sorteres etter nærhet", () => {
    const input = board();
    const category = input.categories[0]!;
    category.editorial = {
      intro: "Her møtes den gamle industrien og dagens serveringssteder.",
      body: "Lengre redaksjonell tekst.",
      highlights: [],
    } as never;
    category.pois[0]!.raw.travelTime = { walk: 4 };

    const chapter = buildProductionAssistantSource(input).createConversation()
      .execute("open_theme", { theme_id: "servering" }).result as {
        chapter: { intro: string; places: Array<{ name: string }> };
      };

    expect(chapter.chapter.intro).toBe(
      "Her møtes den gamle industrien og dagens serveringssteder.",
    );
    expect(chapter.chapter.places[0]?.name).toBe("Fyr");
  });

  it("fjerner også gateadressen når prosa utelater bysuffikset", () => {
    const input = board();
    const category = input.categories[0]!;
    category.pois[0]!.address = "Lade allé 9, Trondheim";
    category.pois[0]!.raw.address = "Lade allé 9, Trondheim";
    category.editorial = {
      intro: "Fyr i Lade allé 9 serverer mat og drikke.",
      body: "Fyr ligger i Lade allé 9.",
      highlights: [],
    } as never;
    category.pois[0]!.raw.travelTime = { walk: 4 };

    const chapter = buildProductionAssistantSource(input).createConversation()
      .execute("open_theme", { theme_id: "servering" }).result as {
        chapter: { intro: string };
      };

    expect(chapter.chapter.intro).not.toContain("Lade allé 9");
    expect(chapter.chapter.intro).toContain("stedet");
  });

  it("prioriterer kildeattribuert prosjektfortelling foran reguleringsdetaljer", () => {
    const input = board();
    input.publishedKnowledge!.push(
      {
        ...input.publishedKnowledge![1]!,
        id: "story-location",
        field: "beliggenhet_beskrivelse",
        factText: "Utbygger beskriver prosjektet mellom fjorden, turstien og kollektivknutepunktet.",
        temporalKind: "marketed",
      },
      {
        ...input.publishedKnowledge![1]!,
        id: "story-homes",
        field: "bomiljo_beskrivelse",
        factText: "Utbygger beskriver bilfrie utearealer og bebyggelse som åpner seg mot landskapet.",
        temporalKind: "marketed",
      },
    );
    const facts = buildProductionAssistantSource(input).createConversation()
      .execute("get_board_facts", {}).result as { facts: Array<{ text: string }> };
    expect(facts.facts.slice(0, 2).map((fact) => fact.text)).toEqual([
      "Utbygger beskriver prosjektet mellom fjorden, turstien og kollektivknutepunktet.",
      "Utbygger beskriver bilfrie utearealer og bebyggelse som åpner seg mot landskapet.",
    ]);
  });

  it("finner kartkoblet prosjektkunnskap om et navngitt delområde", () => {
    const input = board();
    input.publishedKnowledge![0] = {
      ...input.publishedKnowledge![0]!,
      id: "claim-transittkaia-plan-3",
      sourceClaimId: "NYH-PLACE-transittkaia-plan-3",
      subjectId: "place-transittkaia",
      subjectName: "Transittkaia",
      topic: "Nyhavna som bydel",
      field: "uterom",
      factText: "Doratorget, elvepark og Transittparken er planlagte uteområder.",
      temporalKind: "planned",
    };
    input.publishedKnowledge!.push({
      ...input.publishedKnowledge![0]!,
      id: "claim-transittkaia-plan-2",
      sourceClaimId: "NYH-PLACE-transittkaia-plan-2",
      factText: "Nettsiden oppgir byggestart i 2027, forutsatt plangodkjenning.",
    });
    input.publishedKnowledge!.push({
      ...input.publishedKnowledge![0]!,
      id: "claim-transittkaia-plan-1",
      sourceClaimId: "NYH-PLACE-transittkaia-plan-1",
      field: "place_fact",
      factText: "Utbyggingen starter i sør ved brannstasjonen og skjer etappevis.",
    });

    const found = buildProductionAssistantSource(input).createConversation()
      .execute("find_project_info", {
        query: "Hva skal bygges først på Transit Kaia?",
      }).result as { matches: number; results: Array<{ text: string }> };

    expect(found.matches).toBeGreaterThan(0);
    expect(found.results[0]?.text).toBe(
      "Utbyggingen starter i sør ved brannstasjonen og skjer etappevis.",
    );
    const shortenedToolQuery = buildProductionAssistantSource(input).createConversation()
      .execute("find_project_info", { query: "Transitkaia" }).result as {
        results: Array<{ text: string }>;
      };
    expect(shortenedToolQuery.results[0]?.text).toBe(
      "Utbyggingen starter i sør ved brannstasjonen og skjer etappevis.",
    );

    const spokenName = buildProductionAssistantSource(input).createConversation()
      .execute("find_places", { query: "Transitkaia" }).result as {
        places: Array<{ name: string }>;
      };
    expect(spokenName.places[0]?.name).toBe("Transittkaia");

    const place = buildProductionAssistantSource(input).createConversation()
      .execute("get_place_facts", { poi_id: "cafe-1" }).result as {
        facts: Array<{ text: string }>;
      };
    expect(place.facts.slice(0, 3).map((fact) => fact.text)).toEqual([
      "Utbyggingen starter i sør ved brannstasjonen og skjer etappevis.",
      "Nettsiden oppgir byggestart i 2027, forutsatt plangodkjenning.",
      "Doratorget, elvepark og Transittparken er planlagte uteområder.",
    ]);
  });

  it("lar en kartkoblet filial vinne over et fjernt, generisk kjedenavn", () => {
    const input = board();
    const category = input.categories[0]!;
    category.pois[0]!.name = "Burger King";
    category.pois[0]!.raw.name = "Burger King";
    category.pois[0]!.raw.travelTime = { walk: 6 };
    const far = {
      ...category.pois[0]!,
      id: "far-burger-king" as never,
      raw: { ...category.pois[0]!.raw, id: "far-burger-king", travelTime: { walk: 28 } },
    };
    category.pois.push(far);
    input.publishedKnowledge![0] = {
      ...input.publishedKnowledge![0]!,
      subjectId: "burger-king-lade-arena",
      subjectName: "Burger King Lade Arena",
      factText: "Filialen er kartkoblet til Lade Arena.",
    };

    const found = buildProductionAssistantSource(input).createConversation()
      .execute("find_places", { query: "Burger King" });
    expect((found.result as { places: Array<{ name: string; map_poi_id: string | null }> }).places[0])
      .toMatchObject({ name: "Burger King Lade Arena", map_poi_id: "cafe-1" });
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
