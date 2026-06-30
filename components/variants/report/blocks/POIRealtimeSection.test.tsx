import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { join } from "path";
import { readFileSync } from "fs";
import { POIRealtimeSection } from "./POIRealtimeSection";
import type { RealtimeData } from "@/lib/hooks/useRealtimeData";

vi.mock("@/lib/utils/format-time", () => ({
  formatRelativeDepartureTime: (iso: string) => `T:${iso}`,
}));

const EMPTY: RealtimeData = {
  loading: false,
  error: null,
  lastUpdated: null,
};

const LOADING: RealtimeData = {
  loading: true,
  error: null,
  lastUpdated: null,
};

const ENTUR: RealtimeData["entur"] = {
  stopName: "Trondheim S",
  departures: [
    { departureTime: "2026-06-30T12:01:00Z", isRealtime: true, destination: "Lerkendal", lineCode: "5", transportMode: "bus", lineColor: "#e81010" },
    { departureTime: "2026-06-30T12:03:00Z", isRealtime: false, destination: "Lade", lineCode: "6", transportMode: "bus" },
    { departureTime: "2026-06-30T12:05:00Z", isRealtime: true, destination: "Heimdal", lineCode: "10", transportMode: "bus", lineColor: "#0066cc" },
    { departureTime: "2026-06-30T12:10:00Z", isRealtime: true, destination: "Elgeseter", lineCode: "1", transportMode: "bus" },
  ],
};

const BYSYKKEL_OPEN: RealtimeData["bysykkel"] = {
  availableBikes: 4,
  availableDocks: 8,
  isOpen: true,
};

const BYSYKKEL_CLOSED: RealtimeData["bysykkel"] = {
  availableBikes: 0,
  availableDocks: 0,
  isOpen: false,
};

const HYRE: RealtimeData["hyre"] = {
  stationName: "Byhavn",
  numVehiclesAvailable: 2,
};

describe("POIRealtimeSection", () => {
  describe("empty state", () => {
    it("returns null when no data and not loading", () => {
      const { container } = render(<POIRealtimeSection realtimeData={EMPTY} />);
      expect(container.firstChild).toBeNull();
    });

    it("returns null when entur has zero departures and no other data", () => {
      const data: RealtimeData = {
        ...EMPTY,
        entur: { stopName: "X", departures: [] },
      };
      const { container } = render(<POIRealtimeSection realtimeData={data} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("skeleton state", () => {
    it("renders skeleton when loading && !hasAny", () => {
      const { container } = render(<POIRealtimeSection realtimeData={LOADING} />);
      expect(container.querySelector(".animate-pulse")).not.toBeNull();
    });

    it("does NOT render skeleton when loading but data already present", () => {
      const data: RealtimeData = { ...LOADING, hyre: HYRE };
      const { container } = render(<POIRealtimeSection realtimeData={data} />);
      expect(container.querySelector(".animate-pulse")).toBeNull();
    });
  });

  describe("entur departures", () => {
    it("renders top 3 departures when 4 are present", () => {
      const { getAllByText, queryByText } = render(
        <POIRealtimeSection realtimeData={{ ...EMPTY, entur: ENTUR }} />,
      );
      expect(getAllByText(/Lerkendal|Lade|Heimdal/).length).toBe(3);
      expect(queryByText("Elgeseter")).toBeNull();
    });

    it("renders line code for each departure", () => {
      const { getByText } = render(
        <POIRealtimeSection realtimeData={{ ...EMPTY, entur: ENTUR }} />,
      );
      expect(getByText("5")).not.toBeNull();
      expect(getByText("6")).not.toBeNull();
      expect(getByText("10")).not.toBeNull();
    });

    it("applies lineColor style to departure with lineColor set", () => {
      const { getByText } = render(
        <POIRealtimeSection realtimeData={{ ...EMPTY, entur: ENTUR }} />,
      );
      const lineEl = getByText("5");
      // jsdom normalises hex → rgb; check colour is applied (non-empty style)
      expect(lineEl.getAttribute("style")).toBeTruthy();
    });

    it("applies no color style when lineColor is absent", () => {
      const { getByText } = render(
        <POIRealtimeSection realtimeData={{ ...EMPTY, entur: ENTUR }} />,
      );
      const lineEl = getByText("6");
      expect(lineEl.getAttribute("style") ?? "").not.toContain("color:");
    });

    it("renders green dot for realtime departure, gray for scheduled", () => {
      const { container } = render(
        <POIRealtimeSection realtimeData={{ ...EMPTY, entur: ENTUR }} />,
      );
      const dots = container.querySelectorAll("span.rounded-full");
      const greenDots = Array.from(dots).filter((d) => d.className.includes("bg-green-500"));
      const grayDots = Array.from(dots).filter((d) => d.className.includes("bg-gray-300"));
      expect(greenDots.length).toBe(2); // dep 0 + dep 2 are realtime
      expect(grayDots.length).toBe(1); // dep 1 is scheduled
    });

    it("calls formatRelativeDepartureTime for each departure", () => {
      const { getByText } = render(
        <POIRealtimeSection realtimeData={{ ...EMPTY, entur: ENTUR }} />,
      );
      expect(getByText("T:2026-06-30T12:01:00Z")).not.toBeNull();
    });
  });

  describe("bysykkel", () => {
    it("renders available bikes and docks when open", () => {
      const { getByText } = render(
        <POIRealtimeSection realtimeData={{ ...EMPTY, bysykkel: BYSYKKEL_OPEN }} />,
      );
      expect(getByText(/4 ledige sykler/)).not.toBeNull();
      expect(getByText(/8 ledige låser/)).not.toBeNull();
    });

    it("does not show Stengt when isOpen=true", () => {
      const { queryByText } = render(
        <POIRealtimeSection realtimeData={{ ...EMPTY, bysykkel: BYSYKKEL_OPEN }} />,
      );
      expect(queryByText("(Stengt)")).toBeNull();
    });

    it("shows Stengt when isOpen=false", () => {
      const { getByText } = render(
        <POIRealtimeSection realtimeData={{ ...EMPTY, bysykkel: BYSYKKEL_CLOSED }} />,
      );
      expect(getByText("(Stengt)")).not.toBeNull();
    });
  });

  describe("hyre", () => {
    it("renders available car count", () => {
      const { getByText } = render(
        <POIRealtimeSection realtimeData={{ ...EMPTY, hyre: HYRE }} />,
      );
      expect(getByText("2 biler ledige")).not.toBeNull();
    });
  });

  describe("presentation purity (AC3 + AC6)", () => {
    it("renders no <img> elements", () => {
      const data: RealtimeData = {
        ...EMPTY,
        entur: ENTUR,
        bysykkel: BYSYKKEL_OPEN,
        hyre: HYRE,
      };
      const { container } = render(<POIRealtimeSection realtimeData={data} />);
      expect(container.querySelectorAll("img").length).toBe(0);
    });

    it("component source contains no fetch() calls (no business logic)", () => {
      const src = readFileSync(
        join(process.cwd(), "components/variants/report/blocks/POIRealtimeSection.tsx"),
        "utf8",
      );
      expect(src).not.toContain("fetch(");
      expect(src).not.toContain("supabase");
      expect(src).not.toContain("useEffect");
    });
  });
});
