import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { execFileSync } from "node:child_process";
import { BoardRouteProvider, useBoardRoute } from "./board-route";
import { useRouteData } from "@/lib/map/use-route-data";
import { useBoard, useActivePOI } from "./board-state";

/**
 * Rutekilden. Poenget er at det finnes ÉN — rutelinja, tids-chipen og 3D-ruten
 * kalte tidligere `useRouteData` hver for seg, og med reisemodus ville hvert
 * modusbytte multiplisert Directions-kallene (som faktureres per request).
 */

vi.mock("@/lib/map/use-route-data", () => ({ useRouteData: vi.fn() }));
vi.mock("./board-state", () => ({ useBoard: vi.fn(), useActivePOI: vi.fn() }));

const HOME = { lat: 63.42, lng: 10.51 };
const RAW_POI = { id: "poi-1", coordinates: { lat: 63.43, lng: 10.52 } };

function setBoard(overrides: { phase?: string; travelMode?: string; poi?: unknown } = {}) {
  vi.mocked(useBoard).mockReturnValue({
    state: {
      phase: overrides.phase ?? "poi",
      travelMode: overrides.travelMode ?? "walk",
    },
    data: { home: { coordinates: HOME } },
  } as unknown as ReturnType<typeof useBoard>);
  vi.mocked(useActivePOI).mockReturnValue(
    ("poi" in overrides ? overrides.poi : { raw: RAW_POI }) as ReturnType<typeof useActivePOI>,
  );
}

function Consumer({ label }: { label: string }) {
  const { data } = useBoardRoute();
  return <span data-testid={label}>{data ? String(data.travelMinutes) : "ingen"}</span>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRouteData).mockReturnValue({ data: null, error: null });
});

describe("BoardRouteProvider", () => {
  it("henter ruta ÉN gang selv med tre konsumenter montert", () => {
    setBoard();
    render(
      <BoardRouteProvider>
        <Consumer label="linje" />
        <Consumer label="chip" />
        <Consumer label="tredimensjonal" />
      </BoardRouteProvider>,
    );

    expect(useRouteData).toHaveBeenCalledTimes(1);
  });

  it("sender aktiv modus videre til rute-hooket", () => {
    setBoard({ travelMode: "bike" });
    render(
      <BoardRouteProvider>
        <Consumer label="linje" />
      </BoardRouteProvider>,
    );

    expect(useRouteData).toHaveBeenCalledWith(RAW_POI, HOME, "bike");
  });

  it("ingen aktiv POI → hooket kalles med null (ingen fetch), ingen krasj", () => {
    setBoard({ poi: null });
    render(
      <BoardRouteProvider>
        <Consumer label="linje" />
      </BoardRouteProvider>,
    );

    expect(useRouteData).toHaveBeenCalledWith(null, HOME, "walk");
  });

  it("phase ≠ poi → ruta hentes ikke selv om en POI er valgt", () => {
    setBoard({ phase: "active" });
    render(
      <BoardRouteProvider>
        <Consumer label="linje" />
      </BoardRouteProvider>,
    );

    expect(useRouteData).toHaveBeenCalledWith(null, HOME, "walk");
  });

  it("alle konsumenter ser samme svar", () => {
    setBoard();
    vi.mocked(useRouteData).mockReturnValue({
      data: { coordinates: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }], travelMinutes: 17 },
      error: null,
    });

    const { getByTestId } = render(
      <BoardRouteProvider>
        <Consumer label="linje" />
        <Consumer label="chip" />
      </BoardRouteProvider>,
    );

    expect(getByTestId("linje").textContent).toBe("17");
    expect(getByTestId("chip").textContent).toBe("17");
  });
});

describe("useBoardRoute utenfor provider", () => {
  // Kart-lagene rendres også i tester og i flater som ikke monterer provideren.
  // En manglende rute er en gyldig tilstand, ikke en programmeringsfeil.
  it("returnerer tom rute i stedet for å kaste", () => {
    const { getByTestId } = render(<Consumer label="alene" />);
    expect(getByTestId("alene").textContent).toBe("ingen");
  });
});

describe("kilde-vakt: bare rutekilden kaller useRouteData", () => {
  it("ingen annen board-komponent importerer use-route-data", () => {
    // Regresjonsvakten for hele poenget med Unit 3. Legger noen hooket tilbake i
    // et kart-lag, dupliseres Directions-kallene igjen — stille.
    // Selve hooket, ikke `type RouteData` — 3D-rutelaget importerer typen og skal
    // fortsette å gjøre det.
    const hits = execFileSync(
      "grep",
      ["-rl", "useRouteData", "components/", "--include=*.tsx", "--include=*.ts"],
      { cwd: process.cwd(), encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .filter((path) => path && !path.includes(".test."));

    expect(hits).toEqual(["components/variants/report/board/board-route.tsx"]);
  });
});
