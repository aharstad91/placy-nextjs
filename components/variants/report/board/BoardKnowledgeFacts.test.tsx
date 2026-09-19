import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PublishedKnowledge } from "@/lib/types";
import { BoardKnowledgeFacts } from "./BoardKnowledgeFacts";

afterEach(cleanup);

function fact(overrides: Partial<PublishedKnowledge> = {}): PublishedKnowledge {
  return {
    id: "claim-1",
    projectId: "project-1",
    scope: "project",
    subjectId: "planned-kindergarten",
    subjectName: "Barnehage i prosjektet",
    topic: "Oppvekst",
    field: "status",
    factText: "Tomten er regulert, men byggestart er ikke dokumentert.",
    confidence: "high",
    sourceUrls: ["https://trondheim.kommune.no/plan"],
    sourceTitles: ["Trondheim kommune"],
    reviewStatus: "approved",
    temporalKind: "regulated",
    reusableAcrossBoards: false,
    mappingStatus: "not_applicable",
    ...overrides,
  };
}

describe("BoardKnowledgeFacts", () => {
  it("viser prosjektfakta uten kartpunkt med status og kildelenke", () => {
    const { getByTestId, getByText } = render(
      <BoardKnowledgeFacts knowledge={[fact()]} />,
    );

    expect(getByText("Barnehage i prosjektet")).toBeTruthy();
    expect(getByText(/byggestart er ikke dokumentert/)).toBeTruthy();
    expect(getByTestId("knowledge-status-regulated").textContent).toBe(
      "Regulert",
    );
    expect(getByTestId("knowledge-source-link").getAttribute("href")).toBe(
      "https://trondheim.kommune.no/plan",
    );
  });

  it("dupliserer ikke fakta som tilhører et konkret kartpunkt", () => {
    const { queryByTestId } = render(
      <BoardKnowledgeFacts knowledge={[fact({ poiId: "poi-1" })]} />,
    );

    expect(queryByTestId("board-knowledge-facts")).toBeNull();
  });

  it("rendrer ingenting uten reviderte prosjektfakta", () => {
    const { queryByTestId } = render(<BoardKnowledgeFacts />);
    expect(queryByTestId("board-knowledge-facts")).toBeNull();
  });
});
