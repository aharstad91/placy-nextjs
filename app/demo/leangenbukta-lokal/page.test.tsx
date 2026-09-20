import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { BoardData } from "@/components/variants/report/board/board-data";
import type { Project } from "@/lib/types";

/**
 * Ruta for den lokale Leangenbukta-demoen.
 *
 * Testen mounter ikke kartet: `ReportReelsPage` drar med seg Mapbox og WebGL.
 * Den byttes mot en lett stub, slik at det som faktisk måles her er rutas to
 * jobber — å stenge i produksjon, og å sende datasettets eget board videre.
 */

const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFoundMock() }));

vi.mock("@/components/variants/report/reels/ReportReelsPage", () => ({
  default: ({
    project,
    boardData,
    boardMode,
    layout,
    placePanel,
  }: {
    project: Project;
    boardData?: BoardData;
    boardMode?: string;
    layout?: string;
    placePanel?: boolean;
  }) => (
    <div
      data-testid="report-stub"
      data-board-mode={boardMode}
      data-layout={layout}
      data-place-panel={String(Boolean(placePanel))}
      data-dataset={boardData?.demoDataset}
      data-hide-broker={String(project.reportConfig?.hideBrokerCard)}
      data-categories={boardData?.categories.map((category) => category.id).join(",")}
    >
      {boardData?.home.name}
    </div>
  ),
}));

import LeangenbuktaLokalPage from "@/app/demo/leangenbukta-lokal/page";

beforeEach(() => {
  notFoundMock.mockClear();
  vi.stubEnv("NODE_ENV", "development");
});
afterEach(() => vi.unstubAllEnvs());

describe("/demo/leangenbukta-lokal", () => {
  it("finnes ikke i produksjon", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(LeangenbuktaLokalPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it("rendrer Leangenbuktas eget board i bolig-skallet i utvikling", async () => {
    const { getByTestId } = render(await LeangenbuktaLokalPage());
    const stub = getByTestId("report-stub");
    expect(stub).toHaveTextContent("Leangenbukta");
    expect(stub.dataset.dataset).toBe("leangenbukta-lokal");
    // Bolig-skallet, ikke event-modus; innrammet desktop; felles detaljpanel.
    expect(stub.dataset.boardMode).toBe("report");
    expect(stub.dataset.layout).toBe("framed");
    expect(stub.dataset.placePanel).toBe("true");
    // Ingen oppdiktet megler på en demo som starter tom.
    expect(stub.dataset.hideBroker).toBe("true");
    expect(stub.dataset.categories?.split(",")).toHaveLength(8);
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
