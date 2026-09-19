import { describe, expect, it, vi } from "vitest";
import type { BoardData } from "@/components/variants/report/board/board-data";
import { EnturClientError } from "@/lib/entur/client";
import { createLiveTransportExecutor, type LiveTransportClient } from "@/lib/realtime/live-transport";

const board = {
  home: { name: "Leangenbukta", address: "Haakon VIIs gate 14", coordinates: { lat: 63.44, lng: 10.46 } },
  categories: [{
    id: "transport",
    label: "Transport",
    lead: "",
    body: "",
    icon: "Bus",
    color: "#00f",
    pois: [
      {
        id: "stop-1",
        name: "Leangenbukta holdeplass",
        categoryId: "transport",
        coordinates: { lat: 63.441, lng: 10.461 },
        icon: "Bus",
        color: "#00f",
        raw: {
          id: "stop-1",
          name: "Leangenbukta holdeplass",
          coordinates: { lat: 63.441, lng: 10.461 },
          category: { id: "bus", name: "Buss", icon: "Bus", color: "#00f" },
          enturStopplaceId: "NSR:StopPlace:1",
        },
      },
      {
        id: "place-2",
        name: "Kontoret",
        categoryId: "transport",
        coordinates: { lat: 63.43, lng: 10.40 },
        icon: "MapPin",
        color: "#00f",
        raw: {
          id: "place-2",
          name: "Kontoret",
          coordinates: { lat: 63.43, lng: 10.40 },
          category: { id: "other", name: "Sted", icon: "MapPin", color: "#00f" },
        },
      },
    ],
    topRankedPois: [],
  }],
  poisById: new Map(),
} as unknown as BoardData;

const unusedClient = (): LiveTransportClient => ({
  departures: vi.fn(),
  trip: vi.fn(),
});

describe("live transport boundary", () => {
  it("avviser vilkårlig ID og sted uten Entur-kobling før nettverkskall", async () => {
    const client = unusedClient();
    const execute = createLiveTransportExecutor(board, client);
    expect(await execute("get_live_departures", { poi_id: "NSR:StopPlace:evil" })).toHaveProperty("error");
    expect(await execute("get_live_departures", { poi_id: "place-2" })).toHaveProperty("error");
    expect(client.departures).not.toHaveBeenCalled();
  });

  it("avklarer uklart reisemål gjennom servervalidert poi_id", async () => {
    const client = unusedClient();
    const execute = createLiveTransportExecutor(board, client);
    expect(await execute("plan_live_transit_trip", { destination_poi_id: "byen" })).toMatchObject({
      error: expect.stringMatching(/konkret sted|Ukjent mål/),
    });
    expect(client.trip).not.toHaveBeenCalled();
  });

  it("gir ærlig live-feil uten å returnere gammel rutetabell", async () => {
    const client: LiveTransportClient = {
      departures: vi.fn(async () => { throw new EnturClientError("timeout", "for sent"); }),
      trip: vi.fn(),
    };
    const result = await createLiveTransportExecutor(board, client)("get_live_departures", { poi_id: "stop-1" });
    expect(result).toEqual({
      live: false,
      error: "timeout",
      note: "Jeg fikk ikke hentet levende kollektivdata nå. Jeg bruker ikke eldre research som om den var sanntid.",
    });
    expect(result).not.toHaveProperty("departures");
  });
});
