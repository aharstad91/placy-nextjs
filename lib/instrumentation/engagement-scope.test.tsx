// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

const { logEventMock } = vi.hoisted(() => ({
  logEventMock: vi.fn(),
}));

vi.mock("./log-event", () => ({
  logEvent: logEventMock,
}));

import {
  EngagementProvider,
  useEngagement,
  useEngagementEmitter,
} from "./engagement-scope";
import type { EngagementContextEnvelope } from "./event-types";
import type { TravelMode } from "@/lib/types";

const ENVELOPE: EngagementContextEnvelope = {
  mode: "report",
  has_3d_addon: true,
  categories_presented: ["home", "hverdagsliv", "mat-drikke"],
  locale: "no",
  travel_mode: "walk",
};

beforeEach(() => {
  logEventMock.mockReset();
  logEventMock.mockResolvedValue(undefined);
});

describe("useEngagementEmitter", () => {
  it("emit merger project_id + session + kontekst-konvolutt inn i hvert event (P0 #1/#2)", () => {
    const { result } = renderHook(() =>
      useEngagementEmitter({ projectId: "proj-1", envelope: ENVELOPE }),
    );
    result.current.emit("poi_clicked", {
      poiId: "poi-9",
      payload: { category_id: "mat-drikke" },
    });

    expect(logEventMock).toHaveBeenCalledOnce();
    const input = logEventMock.mock.calls[0][0];
    expect(input.eventType).toBe("poi_clicked");
    expect(input.projectId).toBe("proj-1"); // P0 #2: aldri uattribuert
    expect(input.poiId).toBe("poi-9");
    expect(input.payload.category_id).toBe("mat-drikke");
    expect(input.payload.context).toEqual(ENVELOPE); // P0 #1: konvolutt på alt
    expect(typeof input.sessionId).toBe("string");
  });

  it("SAMME session-id på tvers av events i én økt (P0 #3)", () => {
    const { result } = renderHook(() =>
      useEngagementEmitter({ projectId: "proj-1", envelope: ENVELOPE }),
    );
    result.current.emit("board_viewed");
    result.current.emit("category_opened", {
      payload: { category_id: "home" },
    });
    const [a, b] = logEventMock.mock.calls.map((c) => c[0]);
    expect(a.sessionId).toBeDefined();
    expect(a.sessionId).toBe(b.sessionId);
  });

  it("session-id overlever at konvolutten endres (locale-bytte splitter ikke økten)", () => {
    const { result, rerender } = renderHook(
      ({ envelope }: { envelope: EngagementContextEnvelope }) =>
        useEngagementEmitter({ projectId: "proj-1", envelope }),
      { initialProps: { envelope: ENVELOPE } },
    );
    result.current.emit("board_viewed");
    rerender({ envelope: { ...ENVELOPE, locale: "en" } });
    result.current.emit("category_opened", {
      payload: { category_id: "home" },
    });
    const [a, b] = logEventMock.mock.calls.map((c) => c[0]);
    expect(a.sessionId).toBe(b.sessionId);
    expect(b.payload.context.locale).toBe("en"); // ny konvolutt, samme økt
  });

  it("to separate mounts (to besøk) → ULIKE session-id-er", () => {
    const first = renderHook(() =>
      useEngagementEmitter({ projectId: "proj-1", envelope: ENVELOPE }),
    );
    first.result.current.emit("board_viewed");
    first.unmount();
    const second = renderHook(() =>
      useEngagementEmitter({ projectId: "proj-1", envelope: ENVELOPE }),
    );
    second.result.current.emit("board_viewed");
    const [a, b] = logEventMock.mock.calls.map((c) => c[0]);
    expect(a.sessionId).not.toBe(b.sessionId);
  });

  it("emit er fire-and-forget: rejected logEvent velter ikke kalleren", () => {
    logEventMock.mockRejectedValue(new Error("nettverk nede"));
    const { result } = renderHook(() =>
      useEngagementEmitter({ projectId: "proj-1", envelope: ENVELOPE }),
    );
    expect(() => result.current.emit("board_viewed")).not.toThrow();
  });
});

describe("useEngagement (provider-konsum)", () => {
  it("emit-site under provider bruker delt emitter (scope når alle sites)", () => {
    const wrapper = ({ children }: { children: ReactNode }) => {
      function Root({ children: inner }: { children: ReactNode }) {
        const emitter = useEngagementEmitter({
          projectId: "proj-42",
          envelope: ENVELOPE,
        });
        return (
          <EngagementProvider emitter={emitter}>{inner}</EngagementProvider>
        );
      }
      return <Root>{children}</Root>;
    };
    const { result } = renderHook(() => useEngagement(), { wrapper });
    result.current.emit("voiceover_played", {
      payload: { voiceover_segment: "natur" },
    });
    const input = logEventMock.mock.calls[0][0];
    expect(input.projectId).toBe("proj-42");
    expect(input.payload.context).toEqual(ENVELOPE);
  });

  it("utenfor provider → no-op (dropper eventet, kaster ALDRI)", () => {
    const { result } = renderHook(() => useEngagement());
    expect(() => result.current.emit("board_viewed")).not.toThrow();
    expect(logEventMock).not.toHaveBeenCalled();
  });
});

/**
 * R14: reisemodus i konvolutten, LEST VED EMIT.
 *
 * Verdien kan ikke fryses ved mount — et `poi_clicked` i bil-modus er et annet
 * signal enn samme klikk i gå-modus, og det er nettopp forskjellen Moat 2 skal
 * kunne lese. Refen finnes fordi `EngagementProvider` omslutter
 * `BoardProvider`, så emitteren bygges utenfor board-tilstanden.
 */
describe("useEngagementEmitter — reisemodus i konvolutten (R14)", () => {
  it("uten ref brukes konvoluttens egen verdi", () => {
    const { result } = renderHook(() =>
      useEngagementEmitter({ projectId: "p1", envelope: ENVELOPE }),
    );
    result.current.emit("board_viewed");

    expect(logEventMock.mock.calls[0][0].payload.context).toMatchObject({
      travel_mode: "walk",
    });
  });

  it("med ref leses modusen ved EMIT, ikke ved mount", () => {
    const travelModeRef = { current: "walk" as TravelMode };
    const { result } = renderHook(() =>
      useEngagementEmitter({ projectId: "p1", envelope: ENVELOPE, travelModeRef }),
    );

    // Modusen endres ETTER at emitteren er bygget — uten ref-lesing ville
    // eventet båret "walk".
    travelModeRef.current = "car";
    result.current.emit("poi_clicked", { poiId: "poi-1" });

    expect(logEventMock.mock.calls[0][0].payload.context).toMatchObject({
      travel_mode: "car",
    });
  });

  it("to emits med ulik modus mellom seg bærer hver sin verdi", () => {
    const travelModeRef = { current: "walk" as TravelMode };
    const { result } = renderHook(() =>
      useEngagementEmitter({ projectId: "p1", envelope: ENVELOPE, travelModeRef }),
    );

    result.current.emit("board_viewed");
    travelModeRef.current = "bike";
    result.current.emit("poi_clicked", { poiId: "poi-1" });

    const modes = logEventMock.mock.calls.map(
      ([arg]) => arg.payload.context.travel_mode,
    );
    expect(modes).toEqual(["walk", "bike"]);
  });

  it("resten av konvolutten er urørt av modus-overstyringen", () => {
    const travelModeRef = { current: "car" as TravelMode };
    const { result } = renderHook(() =>
      useEngagementEmitter({ projectId: "p1", envelope: ENVELOPE, travelModeRef }),
    );
    result.current.emit("board_viewed");

    expect(logEventMock.mock.calls[0][0].payload.context).toEqual({
      ...ENVELOPE,
      travel_mode: "car",
    });
  });
});
