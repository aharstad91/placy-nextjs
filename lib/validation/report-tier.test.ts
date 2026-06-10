import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ReportConfig, ReportThemeConfig } from "@/lib/types";
import { getCameraTour } from "@/components/variants/report/board/camera-tours";
import {
  validateReportTier,
  summarizeTierFindings,
  type ReportTierFinding,
} from "./report-tier";

// ─── Hjelpere ───────────────────────────────────────────────────────────────

function errors(findings: ReportTierFinding[]): ReportTierFinding[] {
  return findings.filter((f) => f.level === "error");
}

function errorChecks(findings: ReportTierFinding[]): Set<string> {
  return new Set(errors(findings).map((f) => f.check));
}

function fullAudio(id: string) {
  return { manus: `Manus for ${id}.`, url: `/audio/test/${id}.mp3` };
}

function theme(
  id: string,
  overrides: Partial<ReportThemeConfig> = {},
): ReportThemeConfig {
  return {
    id,
    name: id,
    icon: "map-pin",
    categories: [id],
    color: "#000000",
    editorial: { body: `Kuratert tekst om ${id}.` },
    audio: fullAudio(id),
    reelsAudio: fullAudio(`${id}-reels`),
    ...overrides,
  };
}

/** Komplett nivå 3-config, StasjonsKvartalet-formet. */
function completeTier3Config(themeIds = ["transport", "mat-drikke"]): ReportConfig {
  return {
    reportTier: 3,
    audioTourEnabled: true,
    assets: { brand: true },
    welcomeAudio: fullAudio("welcome"),
    heroAudio: fullAudio("hjem"),
    outroAudio: fullAudio("outro"),
    themes: themeIds.map((id) => theme(id)),
  };
}

const CAMERA_TOUR = {
  transport: {
    a: { lat: 63.43, lng: 10.4, range: 1000, tilt: 50, heading: 200 },
  },
};

// ─── Pre-løft Grilstad-fixture (R4-falsifikasjonsbevis) ─────────────────────

interface GrilstadFixture {
  slug: string;
  has3dAddon: boolean | null;
  cameraToursEntry: boolean;
  poiIds: string[];
  reportConfig: ReportConfig;
}

const grilstad = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "__fixtures__", "grilstad-pre-lift.json"),
    "utf-8",
  ),
) as unknown as GrilstadFixture;

describe("validateReportTier — falsifikasjon mot pre-løft Grilstad", () => {
  it("deklarert nivå 3 feiler med nøyaktig de fire reelle manglene", () => {
    // Camera-status er FROSSET i fixturen (cameraToursEntry: false) — live
    // getCameraTour-oppslag ville brutt beviset når Unit 6 legger inn entryen.
    const findings = validateReportTier({
      slug: grilstad.slug,
      reportConfig: { ...grilstad.reportConfig, reportTier: 3 },
      has3dAddon: grilstad.has3dAddon ?? undefined,
      cameraTour: grilstad.cameraToursEntry ? CAMERA_TOUR : undefined,
      poiIds: grilstad.poiIds,
    });

    expect(errorChecks(findings)).toEqual(
      new Set(["reels-vo", "camera-tours", "has3d-addon", "brand-assets"]),
    );
    // Alle 7 temaer mangler reels-VO-url (manus finnes, mp3 er ikke generert)
    const reels = errors(findings).filter((f) => f.check === "reels-vo");
    expect(reels).toHaveLength(7);
    for (const f of reels) expect(f.detail).toContain("mangler url");

    // Allerede til stede pre-løft → skal IKKE rapporteres som mangler:
    // editorial (alle 7), audio-tur (alle 7 + welcome/hero/outro), audioTourEnabled.
    expect(errorChecks(findings).has("editorial")).toBe(false);
    expect(errorChecks(findings).has("tour-audio")).toBe(false);
    expect(errorChecks(findings).has("audio-tour-enabled")).toBe(false);

    // Alle highlightPoiIds resolver mot POI-poolen → ingen warnings.
    expect(findings.filter((f) => f.level === "warning")).toHaveLength(0);
  });

  it("samme tilstand deklarert nivå 2 består (ærlig re-deklarering)", () => {
    const findings = validateReportTier({
      slug: grilstad.slug,
      reportConfig: { ...grilstad.reportConfig, reportTier: 2 },
      has3dAddon: grilstad.has3dAddon ?? undefined,
      cameraTour: undefined,
      poiIds: grilstad.poiIds,
    });
    expect(errors(findings)).toEqual([]);
  });
});

// ─── Kjerne-scenarier ───────────────────────────────────────────────────────

describe("validateReportTier — nivå 1", () => {
  it("nivå 1-config uten editorial/audio består", () => {
    const findings = validateReportTier({
      slug: "basic",
      reportConfig: {
        reportTier: 1,
        themes: [theme("transport", { editorial: undefined, audio: undefined, reelsAudio: undefined })],
      },
    });
    expect(errors(findings)).toEqual([]);
  });

  it("manglende reportTier valideres som nivå 1 (ingen krav)", () => {
    const findings = validateReportTier({
      slug: "undeclared",
      reportConfig: { themes: [theme("transport", { editorial: undefined })] },
    });
    expect(errors(findings)).toEqual([]);
  });

  it("manglende reportConfig valideres som nivå 1", () => {
    expect(errors(validateReportTier({ slug: "empty" }))).toEqual([]);
  });
});

describe("validateReportTier — nivå 2", () => {
  it("editorial på alle temaer består", () => {
    const findings = validateReportTier({
      slug: "ok2",
      reportConfig: { reportTier: 2, themes: [theme("a"), theme("b")] },
    });
    expect(errors(findings)).toEqual([]);
  });

  it("editorial på 6 av 7 temaer feiler og navngir temaet som mangler", () => {
    const themes = ["a", "b", "c", "d", "e", "f"].map((id) => theme(id));
    themes.push(theme("transport", { editorial: undefined }));
    const findings = validateReportTier({
      slug: "partial2",
      reportConfig: { reportTier: 2, themes },
    });
    const errs = errors(findings);
    expect(errs).toHaveLength(1);
    expect(errs[0].check).toBe("editorial");
    expect(errs[0].detail).toContain("transport");
  });

  it("tom body uten highlights teller ikke som editorial", () => {
    const findings = validateReportTier({
      slug: "empty-body",
      reportConfig: {
        reportTier: 2,
        themes: [theme("a", { editorial: { body: "   " } })],
      },
    });
    expect(errorChecks(findings)).toEqual(new Set(["editorial"]));
  });

  it("nivå ≥2 uten temaer feiler", () => {
    const findings = validateReportTier({
      slug: "no-themes",
      reportConfig: { reportTier: 2 },
    });
    expect(errorChecks(findings)).toEqual(new Set(["editorial"]));
  });
});

describe("validateReportTier — nivå 3", () => {
  const base = () => ({
    slug: "stasjonskvartalet",
    reportConfig: completeTier3Config(),
    has3dAddon: true,
    cameraTour: CAMERA_TOUR,
  });

  it("komplett nivå 3-config består", () => {
    expect(errors(validateReportTier(base()))).toEqual([]);
  });

  it("audio med manus men uten url feiler (manus-only mellom Steg 8c.1 og 8c.2)", () => {
    const input = base();
    input.reportConfig.themes![0].audio = { manus: "Bare manus, ingen mp3." };
    const findings = validateReportTier(input);
    const errs = errors(findings);
    expect(errs).toHaveLength(1);
    expect(errs[0].check).toBe("tour-audio");
    expect(errs[0].detail).toContain("mangler url");
  });

  it("komplett audio men audioTourEnabled false/mangler feiler", () => {
    const input = base();
    input.reportConfig.audioTourEnabled = false;
    expect(errorChecks(validateReportTier(input))).toEqual(
      new Set(["audio-tour-enabled"]),
    );
    delete input.reportConfig.audioTourEnabled;
    expect(errorChecks(validateReportTier(input))).toEqual(
      new Set(["audio-tour-enabled"]),
    );
  });

  it("manglende welcome/hero/outro-url feiler per spor", () => {
    const input = base();
    input.reportConfig.outroAudio = { manus: "Outro uten mp3." };
    const errs = errors(validateReportTier(input));
    expect(errs).toHaveLength(1);
    expect(errs[0].check).toBe("tour-audio");
    expect(errs[0].detail).toContain("outro");
  });

  it("tom camera-tour-entry teller som manglende", () => {
    const input = base();
    input.cameraTour = {} as typeof CAMERA_TOUR;
    expect(errorChecks(validateReportTier(input))).toEqual(
      new Set(["camera-tours"]),
    );
  });

  it("assets.brand false/mangler feiler", () => {
    const input = base();
    input.reportConfig.assets = { brand: false };
    expect(errorChecks(validateReportTier(input))).toEqual(
      new Set(["brand-assets"]),
    );
  });
});

describe("validateReportTier — ugyldig deklarasjon", () => {
  it.each([[4], ["3"], [0]])("reportTier %j avvises", (bad) => {
    const findings = validateReportTier({
      slug: "bad",
      reportConfig: { reportTier: bad } as unknown as ReportConfig,
    });
    expect(errorChecks(findings)).toEqual(new Set(["invalid-tier"]));
  });
});

describe("validateReportTier — highlight-resolusjon", () => {
  it("ukjent highlightPoiId gir warning som navngir id-en", () => {
    const findings = validateReportTier({
      slug: "hl",
      reportConfig: {
        reportTier: 2,
        themes: [
          theme("a", {
            editorial: { body: "Tekst.", highlightPoiIds: ["poi-1", "poi-ghost"] },
          }),
        ],
      },
      poiIds: ["poi-1"],
    });
    expect(errors(findings)).toEqual([]);
    const warnings = findings.filter((f) => f.level === "warning");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].check).toBe("highlight-poi");
    expect(warnings[0].detail).toContain("poi-ghost");
  });

  it("uten poiIds hoppes sjekken over (Supabase-driver uten POI-pool)", () => {
    const findings = validateReportTier({
      slug: "no-pool",
      reportConfig: {
        reportTier: 2,
        themes: [
          theme("a", {
            editorial: { body: "Tekst.", highlightPoiIds: ["poi-ghost"] },
          }),
        ],
      },
    });
    expect(findings).toEqual([]);
  });
});

describe("summarizeTierFindings", () => {
  it("oppsummerer i «deklarert nivå 3, mangler: …»-stil", () => {
    const findings: ReportTierFinding[] = [
      { level: "error", check: "camera-tours", detail: "x" },
      { level: "error", check: "has3d-addon", detail: "y" },
      { level: "error", check: "has3d-addon", detail: "z" },
      { level: "warning", check: "highlight-poi", detail: "w" },
    ];
    expect(summarizeTierFindings(3, findings)).toBe(
      "deklarert nivå 3, mangler: camera-tours, has3d-addon",
    );
    expect(summarizeTierFindings(3, [])).toBe("nivå 3 OK");
    expect(summarizeTierFindings(undefined, [])).toBe("nivå 1 OK");
  });
});

// ─── Kjørepunkt 2: sveip over lokale JSON-prosjekter ────────────────────────

describe("lokale prosjekter (data/projects)", () => {
  it("alle prosjekter med reportConfig består validatoren", () => {
    const root = path.join(__dirname, "..", "..", "data", "projects");
    const files = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .flatMap((d) =>
        fs
          .readdirSync(path.join(root, d.name))
          .filter((f) => f.endsWith(".json") && !f.endsWith(".input.json"))
          .map((f) => path.join(root, d.name, f)),
      );
    expect(files.length).toBeGreaterThan(0);

    let checked = 0;
    for (const file of files) {
      const project = JSON.parse(fs.readFileSync(file, "utf-8")) as {
        urlSlug?: string;
        has3dAddon?: boolean;
        reportConfig?: ReportConfig;
        pois?: { id: string }[];
      };
      if (!project.reportConfig) continue;
      checked++;
      const slug = project.urlSlug ?? path.basename(file, ".json");
      const findings = validateReportTier({
        slug,
        reportConfig: project.reportConfig,
        has3dAddon: project.has3dAddon,
        cameraTour: getCameraTour(slug),
        poiIds: project.pois?.map((p) => p.id),
      });
      expect
        .soft(errors(findings), `${file}: ${summarizeTierFindings(project.reportConfig.reportTier, findings)}`)
        .toEqual([]);
    }
    expect(checked).toBeGreaterThan(0);
  });
});
