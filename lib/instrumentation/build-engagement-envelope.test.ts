import { describe, it, expect } from "vitest";
import { buildEngagementEnvelope } from "./build-engagement-envelope";

/**
 * Regresjonsvakt for kanal-attribusjonen (R19, Unit 5): src → konvolutt. Dette er
 * PRs sentrale Moat-2-verdi — uten denne testen kunne src falle ut av konvolutten
 * (droppet spread / dep) uten at noen test feiler, og FINN/embed/QR ville
 * kollapse i datasettet.
 */

describe("buildEngagementEnvelope", () => {
  const base = {
    eventMode: false,
    has3dAddon: true,
    categoriesPresented: ["home", "mat-drikke"],
    locale: "no",
  };

  it("src='embed' → konvolutten bærer src='embed'", () => {
    const env = buildEngagementEnvelope({ ...base, src: "embed" });
    expect(env.src).toBe("embed");
    expect(env.mode).toBe("report");
  });

  it("src='finn' og src='qr' bæres verbatim", () => {
    expect(buildEngagementEnvelope({ ...base, src: "finn" }).src).toBe("finn");
    expect(buildEngagementEnvelope({ ...base, src: "qr" }).src).toBe("qr");
  });

  it("uten src → feltet UTELATES (ingen 'unknown'-støy)", () => {
    const env = buildEngagementEnvelope(base);
    expect("src" in env).toBe(false);
    expect(env.src).toBeUndefined();
  });

  it("eventMode=true → mode='event'; ellers 'report'", () => {
    expect(buildEngagementEnvelope({ ...base, eventMode: true }).mode).toBe("event");
    expect(buildEngagementEnvelope({ ...base, eventMode: false }).mode).toBe("report");
  });

  it("bærer has_3d_addon, categories_presented og locale uendret", () => {
    const env = buildEngagementEnvelope({ ...base, src: "embed" });
    expect(env.has_3d_addon).toBe(true);
    expect(env.categories_presented).toEqual(["home", "mat-drikke"]);
    expect(env.locale).toBe("no");
  });
});
