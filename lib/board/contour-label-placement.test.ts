import { describe, expect, it } from "vitest";
import { chooseContourLabels, type ScreenRect } from "./contour-label-placement";
import type { IsochroneMinutes } from "@/lib/types";

const RECT: ScreenRect = { left: 0, top: 0, right: 1000, bottom: 800 };

/** Kandidater som ligger på gitte y-verdier når de projiseres (lat = y). */
function contour(minutes: IsochroneMinutes, ys: number[]) {
  return { minutes, points: ys.map((y) => [500, y] as [number, number]) };
}

/** lat brukes som y, lng som x — én-til-én, så testene leser som geometri. */
const project = (lng: number, lat: number) => ({ x: lng, y: lat });

describe("chooseContourLabels", () => {
  it("velger første kandidat som er innenfor det synlige rektangelet", () => {
    // −900 og −100 er over skjermkanten. Det var nøyaktig feilen: 10- og
    // 15-minutters-etiketten lå på y=−330 og y=−812 i Satelitt.
    const slots = chooseContourLabels(
      [contour("15", [-900, -100, 300])],
      project,
      RECT,
    );
    expect(slots).toEqual([{ minutes: "15", lng: 500, lat: 300 }]);
  });

  it("hopper over konturen helt når ingen kandidat er på skjermen", () => {
    // En etikett klemt mot kanten ville påstått at linja ligger der kanten er.
    expect(
      chooseContourLabels([contour("15", [-900, -400])], project, RECT),
    ).toEqual([]);
  });

  it("holder etikettene fra hverandre — to konturer på samme sted", () => {
    // En ås rett nord: 10 og 15 min når ikke lenger enn 5 min gjør.
    const slots = chooseContourLabels(
      [contour("5", [300, 320]), contour("10", [300, 400])],
      project,
      RECT,
    );
    expect(slots.map((s) => s.lat)).toEqual([300, 400]);
  });

  it("lar to etiketter stå på samme høyde når de er langt fra hverandre i x", () => {
    const slots = chooseContourLabels(
      [
        { minutes: "5", points: [[100, 300]] },
        { minutes: "10", points: [[900, 300]] },
      ],
      project,
      RECT,
    );
    expect(slots).toHaveLength(2);
  });

  it("respekterer venstre inset — kartet ligger under sidekolonnen", () => {
    // Et punkt bak panelet er tegnet men usett, og ville blitt valgt fremfor
    // et som faktisk vises.
    const slots = chooseContourLabels(
      [{ minutes: "5", points: [[100, 300], [600, 300]] }],
      project,
      { ...RECT, left: 420 },
    );
    expect(slots[0].lng).toBe(600);
  });

  it("hopper over punkter projeksjonen ikke kan plassere (bak kameraet)", () => {
    const slots = chooseContourLabels(
      [contour("5", [300, 400])],
      (lng, lat) => (lat === 300 ? null : { x: lng, y: lat }),
      RECT,
    );
    expect(slots[0].lat).toBe(400);
  });

  it("gir tom liste uten kandidater", () => {
    expect(chooseContourLabels([], project, RECT)).toEqual([]);
  });
});
