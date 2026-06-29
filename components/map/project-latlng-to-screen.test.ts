import { describe, it, expect } from "vitest";
import { projectLatLngToScreen } from "./project-latlng-to-screen";

/**
 * AC1 (Unit 06.2): projectLatLngToScreen er den ENE korrekte FOV-baserte
 * perspektiv-projeksjonen. Disse testene LÅSER de bærende invariantene mot drift:
 * FOV_Y_RAD=35° (via focal-lengde), return null bak kamera, koord relativt til
 * kart-elementets hjørne, og try/catch → null.
 */

interface Map3dOverrides {
  width?: number;
  height?: number;
  center?: { lat: number; lng: number } | undefined;
  heading?: number;
  tilt?: number;
  range?: number;
  throwOnRect?: boolean;
}

function makeMap3d(o: Map3dOverrides = {}) {
  const width = o.width ?? 800;
  const height = o.height ?? 600;
  return {
    getBoundingClientRect() {
      if (o.throwOnRect) throw new Error("no rect");
      return {
        width,
        height,
        left: 0,
        top: 0,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON() {},
      } as DOMRect;
    },
    // center settes betinget slik at "manglende center" kan testes
    ...("center" in o ? { center: o.center } : { center: { lat: 0, lng: 0 } }),
    heading: o.heading ?? 0,
    tilt: o.tilt ?? 0,
    range: o.range ?? 1200,
  };
}

describe("projectLatLngToScreen — kjerne-invarianter (AC1)", () => {
  it("punkt == center med tilt=0 projiserer til kart-elementets midte", () => {
    const m = makeMap3d({ center: { lat: 0, lng: 0 }, tilt: 0, range: 1200 });
    const p = projectLatLngToScreen(m, 0, 0, 18);
    expect(p).not.toBeNull();
    // dxEast=dyNorth=0 → xCam=yCam=0 → screen = (width/2, height/2)
    expect(p!.x).toBeCloseTo(400, 6);
    expect(p!.y).toBeCloseTo(300, 6);
  });

  it("returnerer null når center mangler", () => {
    const m = makeMap3d({ center: undefined });
    expect(projectLatLngToScreen(m, 10, 10)).toBeNull();
  });

  it("returnerer null når punktet er bak kameraet (zCam <= 1)", () => {
    // tilt=0 → zCam = range - altitude. range=10, altitude=18 → zCam=-8 <= 1
    const m = makeMap3d({ center: { lat: 0, lng: 0 }, tilt: 0, range: 10 });
    expect(projectLatLngToScreen(m, 0, 0, 18)).toBeNull();
  });

  it("returnerer null (try/catch) når getBoundingClientRect kaster", () => {
    const m = makeMap3d({ throwOnRect: true });
    expect(projectLatLngToScreen(m, 1, 1)).toBeNull();
  });

  it("LÅSER FOV_Y_RAD=35° via focal-lengde på et øst-forskjøvet punkt", () => {
    // center lat=0 → metersPerDegLng = 111320 (cos 0 = 1).
    // lng=+0.001 → dxEast=111.32 m, dyNorth=0; tilt=0,range=1200,altitude=0.
    // focal = 600 / (2*tan(35°/2)) = 951.4796 (KUN sann for FOV=35°).
    // screenX = 400 + focal*111.32/1200 = 488.27. Drift i FOV bryter denne.
    const m = makeMap3d({ center: { lat: 0, lng: 0 }, tilt: 0, range: 1200 });
    const p = projectLatLngToScreen(m, 0, 0.001, 0);
    expect(p).not.toBeNull();
    expect(p!.x).toBeCloseTo(488.27, 1);
    expect(p!.y).toBeCloseTo(300, 6); // ingen nord/sør-forskyvning

    // Rekonstruert focal fra resultatet = 35°-FOV-focal for height=600
    const focalImplied = ((p!.x - 400) * 1200) / 111.32;
    expect(focalImplied).toBeCloseTo(951.48, 1);
  });

  it("nord/sør-konvensjon: punkt nord for center havner over midten, sør under", () => {
    const m = makeMap3d({ center: { lat: 0, lng: 0 }, tilt: 0, range: 1200 });
    const north = projectLatLngToScreen(m, 0.001, 0, 18);
    const south = projectLatLngToScreen(m, -0.001, 0, 18);
    expect(north).not.toBeNull();
    expect(south).not.toBeNull();
    expect(north!.y).toBeLessThan(300); // forward>0 → over midten
    expect(south!.y).toBeGreaterThan(300);
    expect(north!.x).toBeCloseTo(400, 6); // ingen øst/vest-forskyvning
    expect(south!.x).toBeCloseTo(400, 6);
  });

  it("koordinater er relative til kart-elementets størrelse (skalerer med rect)", () => {
    const small = makeMap3d({ width: 400, height: 300 });
    const p = projectLatLngToScreen(small, 0, 0, 18);
    expect(p!.x).toBeCloseTo(200, 6); // width/2
    expect(p!.y).toBeCloseTo(150, 6); // height/2
  });
});
