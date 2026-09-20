import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearEnturCache, EnturClientError, fetchEnturDepartures } from "@/lib/entur/client";

const response = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { "content-type": "application/json" },
});

const body = {
  data: {
    stopPlace: {
      id: "NSR:StopPlace:1",
      name: "Leangenbukta",
      quays: [{
        id: "NSR:Quay:1",
        estimatedCalls: [{
          expectedDepartureTime: "2026-09-19T10:00:00+02:00",
          actualDepartureTime: "2026-09-19T10:02:00+02:00",
          realtime: true,
          destinationDisplay: { frontText: "Sentrum" },
          serviceJourney: { line: { publicCode: "2", transportMode: "bus", presentation: { colour: "0055aa" } } },
        }],
      }],
    },
  },
};

describe("shared Entur client", () => {
  beforeEach(clearEnturCache);

  it("normaliserer planlagt og faktisk tid og beholder hentetid gjennom cache", async () => {
    const fetcher = vi.fn(async () => response(body));
    let current = new Date("2026-09-19T08:00:00.000Z");
    const now = () => current;
    const first = await fetchEnturDepartures("NSR:StopPlace:1", 5, { fetcher, now });
    current = new Date("2026-09-19T08:00:10.000Z");
    const cached = await fetchEnturDepartures("NSR:StopPlace:1", 5, { fetcher, now });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first.fetchedAt).toBe("2026-09-19T08:00:00.000Z");
    expect(cached.fetchedAt).toBe(first.fetchedAt);
    expect(cached.departures[0]).toMatchObject({
      departureTime: "2026-09-19T10:02:00+02:00",
      expectedDepartureTime: "2026-09-19T10:00:00+02:00",
      actualDepartureTime: "2026-09-19T10:02:00+02:00",
      isRealtime: true,
    });
  });

  it("klassifiserer timeout og delvis GraphQL-svar uten gamle data", async () => {
    const timeout = vi.fn(async () => { throw new DOMException("sent", "TimeoutError"); });
    await expect(fetchEnturDepartures("NSR:StopPlace:1", 5, { fetcher: timeout, cacheTtlMs: 0 }))
      .rejects.toMatchObject({ code: "timeout" } satisfies Partial<EnturClientError>);

    const partial = vi.fn(async () => response({ ...body, errors: [{ message: "delvis" }] }));
    await expect(fetchEnturDepartures("NSR:StopPlace:1", 5, { fetcher: partial, cacheTtlMs: 0 }))
      .rejects.toMatchObject({ code: "partial" } satisfies Partial<EnturClientError>);
  });
});
