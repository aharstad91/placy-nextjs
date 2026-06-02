import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { CameraWaypointAuthor } from "./CameraWaypointAuthor";

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeText.mockClear();
  Object.assign(navigator, { clipboard: { writeText } });
});

const mockMap = (overrides: Record<string, unknown> = {}) => ({
  center: { lat: 63.431234, lng: 10.391234 },
  range: 512.7,
  tilt: 61.4,
  heading: 199.6,
  ...overrides,
});

/** Parser den genererte `"key": {...},`-snutten til et objekt. */
function parseSnippet(json: string): Record<string, { a: unknown; b?: unknown }> {
  return JSON.parse("{" + json.replace(/,\s*$/, "") + "}");
}

describe("CameraWaypointAuthor", () => {
  it("fanger live-kamera til A og kopierer gyldig kategori-JSON", async () => {
    const { getByText } = render(
      <CameraWaypointAuthor map3dInstance={mockMap()} activeCategoryId="mat-drikke" />,
    );
    fireEvent.click(getByText(/Lagre A/));
    fireEvent.click(getByText(/Kopier kategori-JSON/));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const parsed = parseSnippet(writeText.mock.calls[0][0] as string);
    expect(parsed["mat-drikke"].a).toMatchObject({
      lat: 63.431234,
      lng: 10.391234,
      range: 513,
      tilt: 61,
      heading: 200,
    });
    expect(parsed["mat-drikke"].b).toBeUndefined();
  });

  it("inkluderer b når B også er fanget", async () => {
    const { getByText } = render(
      <CameraWaypointAuthor map3dInstance={mockMap()} activeCategoryId="transport" />,
    );
    fireEvent.click(getByText(/Lagre A/));
    fireEvent.click(getByText(/Lagre B/));
    fireEvent.click(getByText(/Kopier kategori-JSON/));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const parsed = parseSnippet(writeText.mock.calls[0][0] as string);
    expect(parsed["transport"].b).toBeDefined();
  });

  it("støtter lat/lng som metoder (eldre Google-typer)", async () => {
    const methodMap = mockMap({ center: { lat: () => 1.5, lng: () => 2.5 } });
    const { getByText } = render(
      <CameraWaypointAuthor map3dInstance={methodMap} activeCategoryId="x" />,
    );
    fireEvent.click(getByText(/Lagre A/));
    fireEvent.click(getByText(/Kopier kategori-JSON/));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const parsed = parseSnippet(writeText.mock.calls[0][0] as string);
    expect(parsed["x"].a).toMatchObject({ lat: 1.5, lng: 2.5 });
  });

  it("Kopier er disabled før A er fanget", () => {
    const { getByText } = render(
      <CameraWaypointAuthor map3dInstance={mockMap()} activeCategoryId="x" />,
    );
    expect((getByText(/Kopier kategori-JSON/) as HTMLButtonElement).disabled).toBe(true);
  });

  it("Lagre-knappene er disabled uten map-instans", () => {
    const { getByText } = render(
      <CameraWaypointAuthor map3dInstance={null} activeCategoryId="x" />,
    );
    expect((getByText(/Lagre A/) as HTMLButtonElement).disabled).toBe(true);
    expect((getByText(/Lagre B/) as HTMLButtonElement).disabled).toBe(true);
  });
});
