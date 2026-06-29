import { describe, it, expect } from "vitest";
import type { Project, POI, ReportThemeConfig } from "@/lib/types";
import { applyTranslations } from "./apply-translations";
import type { TranslationMap } from "@/lib/supabase/translations";

// SIGNATUR-FORANKRING (r05.7 / §10 Q3): faktisk kode-signatur er
// `applyTranslations(project, locale, translations)` — `project` FØRST
// (apply-translations.ts:13), IKKE brief-rekkefølgen `(locale, project, ...)`.
// Alle kall under bruker den ratifiserte (project, locale, translations)-formen.

// applyTranslations only reads project.id, project.pois[].{id,editorialHook,localInsight}
// and project.reportConfig.{heroIntro,themes[].{id,bridgeText}} — the rest of the
// Project surface is irrelevant, so we cast a minimal fixture (same idiom as
// report-themes.test.ts).
function makePoi(overrides: Partial<POI> = {}): POI {
  return {
    id: "poi-1",
    name: "Test POI",
    coordinates: { lat: 0, lng: 0 },
    category: { id: "cat", name: "Cat", icon: "Coffee", color: "#000" },
    editorialHook: "NO hook",
    localInsight: "NO insight",
    ...overrides,
  };
}

function rcTheme(id: string, overrides: Partial<ReportThemeConfig> = {}): ReportThemeConfig {
  return { id, name: id, icon: "Coffee", categories: [], color: "#000", ...overrides };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "prod-1",
    name: "Test Project",
    customer: "test",
    urlSlug: "test",
    productType: "report",
    centerCoordinates: { lat: 0, lng: 0 },
    story: {} as Project["story"],
    pois: [makePoi()],
    categories: [],
    reportConfig: {
      heroIntro: "NO hero",
      themes: [rcTheme("transport", { bridgeText: "NO bridge" })],
    },
    ...overrides,
  } as Project;
}

describe("applyTranslations — signature & passthrough", () => {
  it("has the actual signature (project, locale, translations) — project FIRST", () => {
    // If the signature were (locale, project, translations), passing the Project
    // as the first arg would make the `locale === 'no'` guard compare a Project
    // object (never 'no'), and the overlay below would not land on the POI.
    const project = makeProject();
    const map: TranslationMap = { "poi:poi-1:editorial_hook": "EN hook" };
    const out = applyTranslations(project, "en", map);
    expect(out.pois[0].editorialHook).toBe("EN hook");
  });

  it("returns project unchanged when locale is 'no' (locale is the 2nd arg)", () => {
    const project = makeProject();
    const map: TranslationMap = { "poi:poi-1:editorial_hook": "EN hook" };
    const out = applyTranslations(project, "no", map);
    expect(out).toBe(project); // same identity — early return
  });

  it("returns project unchanged when the translation map is empty", () => {
    const project = makeProject();
    const out = applyTranslations(project, "en", {});
    expect(out).toBe(project); // same identity — early return
  });
});

describe("applyTranslations — overlay keys (§5.3)", () => {
  it("overlays poi editorial_hook and local_insight, falling back to NO originals", () => {
    const project = makeProject({
      pois: [makePoi({ id: "p1" }), makePoi({ id: "p2" })],
    });
    const map: TranslationMap = {
      "poi:p1:editorial_hook": "EN hook 1",
      // p1 local_insight intentionally missing → falls back to NO original
      "poi:p2:local_insight": "EN insight 2",
    };
    const out = applyTranslations(project, "en", map);
    expect(out.pois[0].editorialHook).toBe("EN hook 1");
    expect(out.pois[0].localInsight).toBe("NO insight"); // fallback to NO
    expect(out.pois[1].editorialHook).toBe("NO hook"); // fallback to NO
    expect(out.pois[1].localInsight).toBe("EN insight 2");
  });

  it("overlays report hero_intro keyed by project.id", () => {
    const project = makeProject();
    const out = applyTranslations(project, "en", {
      "report:prod-1:hero_intro": "EN hero",
    });
    expect(out.reportConfig?.heroIntro).toBe("EN hero");
  });

  it("keeps NO hero_intro when no translation key is present", () => {
    const project = makeProject();
    const out = applyTranslations(project, "en", {
      "poi:poi-1:editorial_hook": "EN hook",
    });
    expect(out.reportConfig?.heroIntro).toBe("NO hero");
  });
});

describe("applyTranslations — bridge_text product-specific → generic fallback (§5.3)", () => {
  it("prefers the product-specific key (theme:<projectId>_<themeId>:bridge_text)", () => {
    const project = makeProject();
    const out = applyTranslations(project, "en", {
      "theme:prod-1_transport:bridge_text": "EN bridge (product-specific)",
      "theme:transport:bridge_text": "EN bridge (generic)",
    });
    expect(out.reportConfig?.themes?.[0].bridgeText).toBe(
      "EN bridge (product-specific)"
    );
  });

  it("falls back to the generic key when no product-specific key exists", () => {
    const project = makeProject();
    const out = applyTranslations(project, "en", {
      "theme:transport:bridge_text": "EN bridge (generic)",
    });
    expect(out.reportConfig?.themes?.[0].bridgeText).toBe(
      "EN bridge (generic)"
    );
  });

  it("retains the NO original bridgeText when neither key is present", () => {
    const project = makeProject();
    const out = applyTranslations(project, "en", {
      "poi:poi-1:editorial_hook": "EN hook",
    });
    expect(out.reportConfig?.themes?.[0].bridgeText).toBe("NO bridge");
  });
});

describe("applyTranslations — reportConfig absent", () => {
  it("leaves reportConfig undefined when project has none", () => {
    const project = makeProject({ reportConfig: undefined });
    const out = applyTranslations(project, "en", {
      "poi:poi-1:editorial_hook": "EN hook",
    });
    expect(out.reportConfig).toBeUndefined();
    expect(out.pois[0].editorialHook).toBe("EN hook");
  });
});
