import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { DomMarker3D } from "./DomMarker3D";
import { MARKER_3D_ATTR } from "./marker-3d-selectors";
import {
  stubMaps3DLibrary,
  makeFakeMap3D,
  FAKE_ALTITUDE_MODE,
} from "./__tests__/gmp-marker-harness";
import type { Map3DInstance } from "./map-view-3d";

afterEach(cleanup);

/** Markøren opprettes bak en await, så render må flushes asynkront. */
async function renderMarker(props: Partial<Parameters<typeof DomMarker3D>[0]> = {}) {
  const map = makeFakeMap3D();
  const view = render(
    <DomMarker3D
      map3d={map as unknown as Map3DInstance}
      lat={63.43}
      lng={10.5}
      altitude={18}
      {...props}
    >
      <div data-testid="innhold">Grillstadfjæra</div>
    </DomMarker3D>,
  );
  await act(async () => {});
  return { map, view };
}

const marker = (map: HTMLElement) =>
  map.querySelector("gmp-marker, gmp-marker-interactive") as HTMLElement | null;

describe("DomMarker3D — tagnavn og montering", () => {
  it("uten onClick monteres den non-interaktive markøren", async () => {
    stubMaps3DLibrary();
    const { map } = await renderMarker();
    expect(map.querySelector("gmp-marker")).toBeTruthy();
    expect(map.querySelector("gmp-marker-interactive")).toBeNull();
  });

  it("med onClick monteres den interaktive markøren", async () => {
    stubMaps3DLibrary();
    const { map } = await renderMarker({ onClick: () => {} });
    expect(map.querySelector("gmp-marker-interactive")).toBeTruthy();
  });

  it("markøren er BARN av kartet — et søsken-overlay ville forsvunnet fra film", async () => {
    stubMaps3DLibrary();
    const { map } = await renderMarker();
    expect(marker(map)!.parentElement).toBe(map);
  });

  it("bærer gate-attributtet, så markør-tapp ikke leses som kamera-grep", async () => {
    stubMaps3DLibrary();
    const { map } = await renderMarker();
    expect(marker(map)!.hasAttribute(MARKER_3D_ATTR)).toBe(true);
  });

  it("barna havner i light DOM som ekte tekst — ikke i et <template>", async () => {
    stubMaps3DLibrary();
    const { map } = await renderMarker();
    const el = marker(map)!;
    expect(el.querySelector("template")).toBeNull();
    expect(el.textContent).toContain("Grillstadfjæra");
  });

  it("mangler MarkerElement i Maps-versjonen, bailer den stille uten fallback", async () => {
    // Kanalen er upinnet, så dette er en reell tilstand. Å falle tilbake til den
    // rasteriserte typen ville gitt to markørgenerasjoner samtidig.
    stubMaps3DLibrary(["MarkerElement", "MarkerInteractiveElement"]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { map } = await renderMarker();
    expect(marker(map)).toBeNull();
    expect(map.querySelector("gmp-marker-3d, gmp-marker-3d-interactive")).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("uten kart-instans monteres ingenting, og ingenting kaster", async () => {
    stubMaps3DLibrary();
    const view = render(
      <DomMarker3D map3d={null} lat={63.43} lng={10.5} altitude={18}>
        <div>x</div>
      </DomMarker3D>,
    );
    await act(async () => {});
    expect(view.container.textContent).toBe("");
  });
});

describe("DomMarker3D — properties", () => {
  it("setter posisjon som separate felter (LatLngAltitude har gettere)", async () => {
    stubMaps3DLibrary();
    const { map } = await renderMarker();
    const el = marker(map) as unknown as { position: Record<string, number> };
    expect(el.position).toEqual({ lat: 63.43, lng: 10.5, altitude: 18 });
  });

  it("setter RELATIVE_TO_GROUND, så markøren følger terrenget", async () => {
    stubMaps3DLibrary();
    const { map } = await renderMarker();
    const el = marker(map) as unknown as { altitudeMode: string };
    expect(el.altitudeMode).toBe(FAKE_ALTITUDE_MODE.RELATIVE_TO_GROUND);
  });

  it("oppdaterer posisjon uten å remounte elementet", async () => {
    stubMaps3DLibrary();
    const map = makeFakeMap3D();
    const props = (lat: number) => ({
      map3d: map as unknown as Map3DInstance,
      lat,
      lng: 10.5,
      altitude: 18,
      children: <div>x</div>,
    });
    const view = render(<DomMarker3D {...props(63.43)} />);
    await act(async () => {});
    const first = marker(map);

    view.rerender(<DomMarker3D {...props(63.44)} />);
    await act(async () => {});

    expect(marker(map)).toBe(first);
    const el = first as unknown as { position: Record<string, number> };
    expect(el.position.lat).toBe(63.44);
  });

  it("skriver zIndex som CSS — MarkerElement har ingen zIndex-prop", async () => {
    stubMaps3DLibrary();
    const { map } = await renderMarker({ zIndex: 42 });
    expect(marker(map)!.style.zIndex).toBe("42");
  });

  it("setter title for skjermlesere, og tom streng når den mangler", async () => {
    stubMaps3DLibrary();
    const a = await renderMarker({ title: "Sjøparken" });
    expect((marker(a.map) as unknown as { title: string }).title).toBe("Sjøparken");
    cleanup();
    const b = await renderMarker();
    expect((marker(b.map) as unknown as { title: string }).title).toBe("");
  });
});

describe("DomMarker3D — klikk og levetid", () => {
  it("gmp-click utløser handleren", async () => {
    stubMaps3DLibrary();
    const onClick = vi.fn();
    const { map } = await renderMarker({ onClick });
    act(() => {
      marker(map)!.dispatchEvent(new Event("gmp-click", { bubbles: true }));
    });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("klikket utløser handleren ÉN gang, ikke to", async () => {
    // Barna ligger i light DOM, så React-handlere inne i markøren virker nå.
    // Wrapperen eksponerer derfor bare gmp-click — begge stier ville dobbelt-åpnet
    // POI-en.
    stubMaps3DLibrary();
    const onClick = vi.fn();
    const { map } = await renderMarker({ onClick });
    act(() => {
      marker(map)!.dispatchEvent(new Event("gmp-click", { bubbles: true }));
    });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("en ny handler-identitet re-oppretter ikke elementet", async () => {
    stubMaps3DLibrary();
    const map = makeFakeMap3D();
    const props = (fn: () => void) => ({
      map3d: map as unknown as Map3DInstance,
      lat: 63.43,
      lng: 10.5,
      altitude: 18,
      onClick: fn,
      children: <div>x</div>,
    });
    const first = vi.fn();
    const view = render(<DomMarker3D {...props(first)} />);
    await act(async () => {});
    const el = marker(map);

    const second = vi.fn();
    view.rerender(<DomMarker3D {...props(second)} />);
    await act(async () => {});

    expect(marker(map)).toBe(el);
    act(() => {
      el!.dispatchEvent(new Event("gmp-click", { bubbles: true }));
    });
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it("faller onClick bort, BEHOLDES elementet — et typebytte etterlater spøkelser", async () => {
    stubMaps3DLibrary();
    const map = makeFakeMap3D();
    const base = {
      map3d: map as unknown as Map3DInstance,
      lat: 63.43,
      lng: 10.5,
      altitude: 18,
      children: <div>x</div>,
    };
    const view = render(<DomMarker3D {...base} onClick={() => {}} />);
    await act(async () => {});
    const el = marker(map);
    expect(el!.tagName.toLowerCase()).toBe("gmp-marker-interactive");

    view.rerender(<DomMarker3D {...base} />);
    await act(async () => {});

    expect(marker(map)).toBe(el);
    expect(el!.tagName.toLowerCase()).toBe("gmp-marker-interactive");
  });

  it("unmount fjerner elementet fra kartet", async () => {
    stubMaps3DLibrary();
    const { map, view } = await renderMarker();
    expect(marker(map)).toBeTruthy();
    view.unmount();
    expect(marker(map)).toBeNull();
  });
});
