import { describe, it, expect } from "vitest";
import {
  TAXI_CATEGORY,
  TAXI_STANDS,
  taxiStandId,
  taxiStandsWithin,
} from "./taxi-stands";
import { calculateDistance } from "@/lib/utils/geo";

/** Strindfjordvegen 10, Ranheim — boardet som avdekket at `taxi` var tom. */
const STRINDFJORDVEGEN = { lat: 63.435107, lng: 10.505335 };

describe("taxi-stands (Trondheim parkering)", () => {
  it("datasettet har holdeplasser, alle med navn og koordinater i Trondheim", () => {
    expect(TAXI_STANDS.length).toBeGreaterThan(20);
    for (const stand of TAXI_STANDS) {
      expect(stand.navn.trim().length).toBeGreaterThan(0);
      // Grov Trondheims-boks — fanger opp en KMZ som har byttet
      // koordinatrekkefølge (lat/lng snudd gir 10.4/63.4 og feiler her).
      expect(stand.lat).toBeGreaterThan(63.2);
      expect(stand.lat).toBeLessThan(63.6);
      expect(stand.lng).toBeGreaterThan(10.2);
      expect(stand.lng).toBeLessThan(10.7);
    }
  });

  it("id-en er stabil og slugifisert fra navnet", () => {
    expect(taxiStandId({ navn: "Bispegata - Nidarosdomen", lat: 0, lng: 0 })).toBe(
      "taxi-tk-bispegata-nidarosdomen"
    );
  });

  it("id-ene er unike — to holdeplasser kan ikke overskrive hverandre", () => {
    const ids = TAXI_STANDS.map(taxiStandId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Skonnertvegen ligger innenfor Strindfjordvegen 10 sin radius og er nærmest", () => {
    // Selve funnet: holdeplassen ligger ~150 m fra boligen, og boardet viste
    // den ikke fordi ingen kilde produserte kategorien `taxi`.
    const nearby = taxiStandsWithin(
      STRINDFJORDVEGEN.lat,
      STRINDFJORDVEGEN.lng,
      2500,
      calculateDistance
    );
    expect(nearby[0].navn).toBe("Skonnertvegen");
    expect(nearby[0].distanceMeters).toBeLessThan(300);
  });

  it("sorterer nærmest først og klipper på radius", () => {
    const wide = taxiStandsWithin(STRINDFJORDVEGEN.lat, STRINDFJORDVEGEN.lng, 3000, calculateDistance);
    const narrow = taxiStandsWithin(STRINDFJORDVEGEN.lat, STRINDFJORDVEGEN.lng, 500, calculateDistance);

    expect(narrow.length).toBeLessThan(wide.length);
    for (let i = 1; i < wide.length; i++) {
      expect(wide[i].distanceMeters).toBeGreaterThanOrEqual(wide[i - 1].distanceMeters);
    }
    expect(wide.every((s) => s.distanceMeters <= 3000)).toBe(true);
  });

  it("utenfor Trondheim gir tom liste — ikke en feil", () => {
    // Straumen (Inderøy): datasettet er kommunens eget, og «ingen data her»
    // skal ha definert oppførsel.
    expect(taxiStandsWithin(63.87, 11.0, 2500, calculateDistance)).toEqual([]);
  });

  it("kategori-ikonet finnes i begge ikonkartene (ellers rendres MapPin)", async () => {
    const { getIcon } = await import("@/lib/utils/map-icons");
    const { getFilledIcon } = await import("@/lib/utils/map-icons-filled");
    expect(getIcon(TAXI_CATEGORY.icon)).not.toBe(getIcon("finnes-ikke"));
    expect(getFilledIcon(TAXI_CATEGORY.icon)).not.toBe(getFilledIcon("finnes-ikke"));
  });
});
