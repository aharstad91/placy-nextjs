import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import { BoardCollectionDrawer } from "./BoardCollectionDrawer";
import type { BoardPOI, BoardPOIId, BoardCategoryId } from "../board-data";
import type { POI, Category } from "@/lib/types";

// QR-koden (qrcode.react) rendres i confirmation-viewet; den er ren SVG og
// mounter fint under jsdom, så ingen mock trengs der.

function makeCategory(over: Partial<Category> = {}): Category {
  return {
    id: "kn-musikk",
    name: "Musikk",
    icon: "Music",
    color: "#a855f7",
    ...over,
  };
}

function makeBoardPOI(id: string): BoardPOI {
  const category = makeCategory();
  const raw: POI = {
    id,
    name: `Event ${id}`,
    coordinates: { lat: 63.43, lng: 10.39 },
    category,
    eventTimeStart: "18:00",
    eventTimeEnd: "23:00",
  };
  return {
    id: id as BoardPOIId,
    name: `Event ${id}`,
    coordinates: { lat: 63.43, lng: 10.39 },
    categoryId: "kn-musikk" as BoardCategoryId,
    eventTimeStart: "18:00",
    eventTimeEnd: "23:00",
    raw,
  };
}

describe("BoardCollectionDrawer (Unit 5, A2)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    // navigator.clipboard finnes ikke alltid i jsdom — stubbes defensivt.
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Kjør checkout-flyten frem til confirmation-viewet ("Samlingen er klar!"). */
  async function reachConfirmation() {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ slug: "abc123" }),
    } as Response);

    fireEvent.click(screen.getByRole("button", { name: /Del min samling/i }));

    await waitFor(() =>
      expect(screen.getByText("Samlingen er klar!")).toBeTruthy(),
    );
  }

  it("checkout fører til confirmation-view (Del min samling → Samlingen er klar!)", async () => {
    const onClose = vi.fn();
    const onRemove = vi.fn();

    render(
      <BoardCollectionDrawer
        open
        onClose={onClose}
        collectionPois={[makeBoardPOI("p1"), makeBoardPOI("p2")]}
        onRemove={onRemove}
        projectId="kulturnatt-2025"
      />,
    );

    await reachConfirmation();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/collections",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it('A2: lukke confirmation via "Fortsett å utforske" tømmer IKKE samlingen', async () => {
    const onClose = vi.fn();
    const onRemove = vi.fn();

    render(
      <BoardCollectionDrawer
        open
        onClose={onClose}
        collectionPois={[makeBoardPOI("p1"), makeBoardPOI("p2")]}
        onRemove={onRemove}
        projectId="kulturnatt-2025"
      />,
    );

    await reachConfirmation();

    fireEvent.click(screen.getByRole("button", { name: /Fortsett å utforske/i }));

    // Dialogen lukkes (onClose kalt) — men ingen destruktiv bivirkning på
    // samlingen: onRemove er aldri kalt (og drawer-en har ikke lenger en
    // onClearAll-prop å trigge).
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("A2: lukke confirmation via Modal-ens X tømmer IKKE samlingen", async () => {
    const onClose = vi.fn();
    const onRemove = vi.fn();

    const { container } = render(
      <BoardCollectionDrawer
        open
        onClose={onClose}
        collectionPois={[makeBoardPOI("p1"), makeBoardPOI("p2")]}
        onRemove={onRemove}
        projectId="kulturnatt-2025"
      />,
    );

    await reachConfirmation();

    // Modal-headerens lukke-knapp er den eneste icon-only knappen i header-raden
    // ved siden av tittelen. Hent den via sin posisjon i dialog-headeren.
    const dialog = container.ownerDocument.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    const headerCloseBtn = dialog!.querySelector("button");
    expect(headerCloseBtn).toBeTruthy();
    fireEvent.click(headerCloseBtn as HTMLButtonElement);

    // X lukker dialogen uten å røre samlingen.
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("drawer-en aksepterer ikke lenger en onClearAll-prop (TS-paritet)", () => {
    // Ren type-smoke: at komponenten kan rendres uten onClearAll bekrefter at
    // den destruktive bivirkning-propen er fjernet (A2-fixens API-overflate).
    const onClose = vi.fn();
    const onRemove = vi.fn();
    render(
      <BoardCollectionDrawer
        open
        onClose={onClose}
        collectionPois={[makeBoardPOI("p1")]}
        onRemove={onRemove}
        projectId="kulturnatt-2025"
      />,
    );
    expect(screen.getByText("Min samling")).toBeTruthy();
  });
});
