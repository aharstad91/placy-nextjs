import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Project, ReportThemeConfig } from "@/lib/types";
import { getReportThemes } from "./report-themes";
import { BRANSJEPROFILER, GLOBAL_DISABLED_REPORT_THEMES } from "@/lib/themes";

// Globalt-deaktiverte temaer påvirker alle test-baselines. Vi lagrer original-
// listen og setter den til tom under tester for å verifisere isolerte filter-
// scenarier. Sett tilbake i afterEach.
const ORIGINAL_GLOBAL_DISABLED = [...GLOBAL_DISABLED_REPORT_THEMES];

beforeEach(() => {
  GLOBAL_DISABLED_REPORT_THEMES.length = 0;
});

afterEach(() => {
  GLOBAL_DISABLED_REPORT_THEMES.length = 0;
  GLOBAL_DISABLED_REPORT_THEMES.push(...ORIGINAL_GLOBAL_DISABLED);
});

// --- Test fixtures -----------------------------------------------------------
// Minimal Project — getReportThemes leser kun `tags` og `reportConfig?.themes`.
// Resten av prosjekt-feltene er irrelevante for tema-resolusjon-logikken.
function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "test-project",
    name: "Test Project",
    customer: "test",
    urlSlug: "test",
    productType: "report",
    centerCoordinates: { lat: 0, lng: 0 },
    story: {} as Project["story"],
    pois: [],
    categories: [],
    tags: ["Eiendom - Bolig"],
    ...overrides,
  } as Project;
}

function rcTheme(id: string, overrides: Partial<ReportThemeConfig> = {}): ReportThemeConfig {
  return {
    id,
    name: id,
    icon: "Coffee",
    categories: [],
    color: "#000",
    ...overrides,
  };
}

// --- Tests -------------------------------------------------------------------

describe("getReportThemes — disabledThemes filter", () => {
  it("returnerer alle bransjeprofil-temaer når ingen flagg er satt", () => {
    // beforeEach har nullstilt GLOBAL_DISABLED_REPORT_THEMES — Bolig-profilen
    // har heller ingen per-profil disabledThemes, så alle temaer returneres.
    const project = makeProject({ tags: ["Eiendom - Bolig"] });
    const themes = getReportThemes(project);
    expect(themes).toHaveLength(BRANSJEPROFILER["Eiendom - Bolig"].themes.length);
    expect(themes.map((t) => t.id)).toContain("opplevelser");
  });

  it("globalt flagg filtrerer for tagged Bolig-prosjekt", () => {
    GLOBAL_DISABLED_REPORT_THEMES.push("opplevelser");
    const project = makeProject({ tags: ["Eiendom - Bolig"] });
    const themes = getReportThemes(project);
    expect(themes.map((t) => t.id)).not.toContain("opplevelser");
    expect(themes).toHaveLength(BRANSJEPROFILER["Eiendom - Bolig"].themes.length - 1);
  });

  it("globalt flagg filtrerer for untagged legacy-prosjekt", () => {
    // Untagged prosjekt → fallback-profil → uten globalt flagg ville
    // "opplevelser" (via alias kultur-opplevelser) vært synlig. Globalt flagg
    // skal også fange dette tilfellet.
    GLOBAL_DISABLED_REPORT_THEMES.push("opplevelser");
    const project = makeProject({
      tags: [],
      reportConfig: {
        themes: [
          rcTheme("hverdagsliv"),
          rcTheme("opplevelser"),
          rcTheme("mat-drikke"),
        ],
      },
    });
    const themes = getReportThemes(project);
    expect(themes.map((t) => t.id)).toEqual(["hverdagsliv", "mat-drikke"]);
  });

  it("filtrerer ut deaktivert tema fra default bransjeprofil-temaer", () => {
    // Midlertidig override av Bolig-profilen i test — verifiserer filteret.
    const original = BRANSJEPROFILER["Eiendom - Bolig"].features;
    BRANSJEPROFILER["Eiendom - Bolig"].features = {
      ...(original ?? {}),
      disabledThemes: ["opplevelser"],
    };
    try {
      const project = makeProject({ tags: ["Eiendom - Bolig"] });
      const themes = getReportThemes(project);
      expect(themes.map((t) => t.id)).not.toContain("opplevelser");
      expect(themes).toHaveLength(BRANSJEPROFILER["Eiendom - Bolig"].themes.length - 1);
    } finally {
      BRANSJEPROFILER["Eiendom - Bolig"].features = original;
    }
  });

  it("filtrerer ut deaktivert tema fra reportConfig-override", () => {
    const original = BRANSJEPROFILER["Eiendom - Bolig"].features;
    BRANSJEPROFILER["Eiendom - Bolig"].features = {
      ...(original ?? {}),
      disabledThemes: ["opplevelser"],
    };
    try {
      const project = makeProject({
        tags: ["Eiendom - Bolig"],
        reportConfig: {
          themes: [
            rcTheme("hverdagsliv"),
            rcTheme("opplevelser"),
            rcTheme("mat-drikke"),
          ],
        },
      });
      const themes = getReportThemes(project);
      expect(themes.map((t) => t.id)).toEqual(["hverdagsliv", "mat-drikke"]);
    } finally {
      BRANSJEPROFILER["Eiendom - Bolig"].features = original;
    }
  });

  it("filtrerer flere temaer samtidig", () => {
    const original = BRANSJEPROFILER["Eiendom - Bolig"].features;
    BRANSJEPROFILER["Eiendom - Bolig"].features = {
      ...(original ?? {}),
      disabledThemes: ["opplevelser", "trening-aktivitet"],
    };
    try {
      const project = makeProject({ tags: ["Eiendom - Bolig"] });
      const themes = getReportThemes(project);
      expect(themes.map((t) => t.id)).not.toContain("opplevelser");
      expect(themes.map((t) => t.id)).not.toContain("trening-aktivitet");
      expect(themes).toHaveLength(BRANSJEPROFILER["Eiendom - Bolig"].themes.length - 2);
    } finally {
      BRANSJEPROFILER["Eiendom - Bolig"].features = original;
    }
  });

  it("matcher legacy alias — å deaktivere 'opplevelser' filtrerer også 'kultur-opplevelser'", () => {
    // Setting disabledThemes på Bolig (canonical id "opplevelser") og passer
    // inn et reportConfig som bruker legacy "kultur-opplevelser"-id-en.
    // Resolveren skal mappe legacy-id-en til "opplevelser" før filteret kjøres.
    const original = BRANSJEPROFILER["Eiendom - Bolig"].features;
    BRANSJEPROFILER["Eiendom - Bolig"].features = {
      ...(original ?? {}),
      disabledThemes: ["opplevelser"],
    };
    try {
      const project = makeProject({
        tags: ["Eiendom - Bolig"],
        reportConfig: {
          themes: [
            rcTheme("hverdagsliv"),
            rcTheme("kultur-opplevelser"), // legacy alias
          ],
        },
      });
      const themes = getReportThemes(project);
      expect(themes.map((t) => t.id)).toEqual(["hverdagsliv"]);
    } finally {
      BRANSJEPROFILER["Eiendom - Bolig"].features = original;
    }
  });

  it("matcher legacy alias i andre retning — å deaktivere 'kultur-opplevelser' filtrerer 'opplevelser'", () => {
    // Hvis utvikler ved et uhell putter legacy id-en i disabledThemes,
    // skal den også resolve til canonical id og filtrere riktig.
    const original = BRANSJEPROFILER["Eiendom - Bolig"].features;
    BRANSJEPROFILER["Eiendom - Bolig"].features = {
      ...(original ?? {}),
      disabledThemes: ["kultur-opplevelser"],
    };
    try {
      const project = makeProject({ tags: ["Eiendom - Bolig"] });
      const themes = getReportThemes(project);
      expect(themes.map((t) => t.id)).not.toContain("opplevelser");
    } finally {
      BRANSJEPROFILER["Eiendom - Bolig"].features = original;
    }
  });

  it("er en no-op når disabled theme-id ikke matcher noe eksisterende tema", () => {
    const original = BRANSJEPROFILER["Eiendom - Bolig"].features;
    BRANSJEPROFILER["Eiendom - Bolig"].features = {
      ...(original ?? {}),
      disabledThemes: ["nonexistent-theme"],
    };
    try {
      const project = makeProject({ tags: ["Eiendom - Bolig"] });
      const themes = getReportThemes(project);
      expect(themes).toHaveLength(BRANSJEPROFILER["Eiendom - Bolig"].themes.length);
    } finally {
      BRANSJEPROFILER["Eiendom - Bolig"].features = original;
    }
  });

  it("er en no-op når disabledThemes er tom array", () => {
    const original = BRANSJEPROFILER["Eiendom - Bolig"].features;
    BRANSJEPROFILER["Eiendom - Bolig"].features = {
      ...(original ?? {}),
      disabledThemes: [],
    };
    try {
      const project = makeProject({ tags: ["Eiendom - Bolig"] });
      const themes = getReportThemes(project);
      expect(themes).toHaveLength(BRANSJEPROFILER["Eiendom - Bolig"].themes.length);
    } finally {
      BRANSJEPROFILER["Eiendom - Bolig"].features = original;
    }
  });

  it("påvirker ikke andre bransjeprofiler", () => {
    // disabledThemes settes kun på Bolig — Næring skal være uberørt.
    const originalBolig = BRANSJEPROFILER["Eiendom - Bolig"].features;
    BRANSJEPROFILER["Eiendom - Bolig"].features = {
      ...(originalBolig ?? {}),
      disabledThemes: ["opplevelser"],
    };
    try {
      const naeringProject = makeProject({ tags: ["Eiendom - Næring"] });
      const naeringThemes = getReportThemes(naeringProject);
      // Næring-profilen har 5 temaer og ingen "opplevelser" — listen skal være intakt.
      expect(naeringThemes).toHaveLength(BRANSJEPROFILER["Eiendom - Næring"].themes.length);
    } finally {
      BRANSJEPROFILER["Eiendom - Bolig"].features = originalBolig;
    }
  });
});
