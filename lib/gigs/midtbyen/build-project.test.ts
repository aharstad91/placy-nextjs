import { describe, it, expect } from "vitest";
import { transformToReportData } from "@/components/variants/report/report-data";
import { adaptBoardData } from "@/components/variants/report/board/board-data";
import { buildNeighbourhoodList } from "@/lib/board/neighbourhood-list";
import { TORVET } from "./anchor";
import { MIDTBYEN_GROUPS } from "./categories";
import {
  buildMidtbyenProject,
  buildMidtbyenProjectWithReport,
} from "./build-project";

const { project, skipped } = buildMidtbyenProjectWithReport();

describe("buildMidtbyenProject", () => {
  it("forankrer prosjektet på Torvet, ikke på første butikk", () => {
    expect(project.centerCoordinates).toEqual(TORVET);
  });

  it("tar med alle butikkene som har koordinat", () => {
    expect(skipped).toEqual([]);
    expect(project.pois).toHaveLength(147);
  });

  it("gir hver POI en kategori som finnes blant temaene", () => {
    const themeIds = new Set((project.reportConfig?.themes ?? []).map((t) => t.id));
    for (const poi of project.pois) {
      expect(themeIds.has(poi.category.id), `${poi.name} → ${poi.category.id}`).toBe(
        true,
      );
    }
  });

  it("bærer gangtiden nabolagslista sorterer på", () => {
    // buildNeighbourhoodList leser poi.raw.travelTime.walk og faller til
    // Infinity uten den. Mangler feltet, står lista alfabetisk.
    const utenGangtid = project.pois.filter((p) => p.travelTime?.walk === undefined);
    expect(utenGangtid.map((p) => p.name)).toEqual([]);
  });

  it("gir unike POI-IDer", () => {
    const ids = new Set(project.pois.map((p) => p.id));
    expect(ids.size).toBe(project.pois.length);
  });

  it("legger åpningstider i formen kart-popupen leser", () => {
    const medTider = project.pois.filter((p) => p.openingHoursJson?.weekday_text);
    expect(medTider.length).toBeGreaterThan(100);
    // computeIsOpen matcher på engelske dagnavn — norske ville stille slått av
    // åpent/stengt-merket.
    expect(medTider[0].openingHoursJson!.weekday_text![0]).toMatch(
      /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/,
    );
  });

  it("sier fra om Midtbykort på hvert punkt", () => {
    for (const poi of project.pois) {
      expect(poi.editorialHook, poi.name).toMatch(/Midtbykort/);
    }
  });

  it("holder rekkefølgen på kategoriene stabil", () => {
    const forventet = MIDTBYEN_GROUPS.map((g) => g.id).filter((id) =>
      project.pois.some((p) => p.category.id === id),
    );
    expect(project.categories.map((c) => c.id)).toEqual(forventet);
  });

  it("har INGEN lyd noe sted", () => {
    // Fraværet av lyd er selve leveransen: det fjerner omvisning-pilla OG slår
    // på nabolagsflaten. Et lydspor som snek seg inn ville byttet flate.
    const config = project.reportConfig!;
    expect(config.welcomeAudio).toBeUndefined();
    expect(config.heroAudio).toBeUndefined();
    expect(config.outroAudio).toBeUndefined();
    for (const theme of config.themes ?? []) {
      expect(theme.audio, theme.id).toBeUndefined();
      expect(theme.reelsAudio, theme.id).toBeUndefined();
    }
  });

  it("gir hvert tema en stedsbeskrivelse", () => {
    // CategoryPage viser prosa fra editorial.body eller lead. Uten tekst blir
    // drill-in-siden en bar liste.
    for (const theme of project.reportConfig?.themes ?? []) {
      expect(theme.intro?.length ?? 0, theme.id).toBeGreaterThan(40);
    }
  });

  it("gir lead og intro forskjellig tekst", () => {
    // adaptCategory deduperer brødteksten mot lead-teksten. Er de like,
    // filtreres brødteksten bort og drill-in-panelet forsvinner helt.
    for (const theme of project.reportConfig?.themes ?? []) {
      expect(theme.leadText?.length ?? 0, theme.id).toBeGreaterThan(0);
      expect(theme.leadText, theme.id).not.toBe(theme.intro);
    }
  });

  it("skriver kategoritekstene i presens uten årstall", () => {
    // Redaksjonell regel: «hva som ER der», ikke byggeår og historikk.
    for (const theme of project.reportConfig?.themes ?? []) {
      expect(theme.intro, theme.id).not.toMatch(/\b(1[0-9]{3}|20[0-9]{2})\b/);
    }
  });

  it("er deterministisk", () => {
    expect(buildMidtbyenProject().pois.map((p) => p.id)).toEqual(
      project.pois.map((p) => p.id),
    );
  });
});

describe("gjennom rapport-pipelinen", () => {
  // Antakelsen planen hviler på: at temaer med IDer rapport-pipelinen aldri har
  // sett før overlever transformToReportData uten å bli filtrert bort. Dette er
  // testen som beviser den.
  const report = transformToReportData(project);

  it("beholder alle sju kategoriene", () => {
    expect(report.themes.map((t) => t.id)).toEqual(
      project.reportConfig!.themes!.map((t) => t.id),
    );
  });

  it("mister ingen butikk på veien", () => {
    const iTemaer = report.themes.reduce((sum, t) => sum + t.allPOIs.length, 0);
    expect(iTemaer).toBe(147);
  });

  it("gir hver kategori ikon og farge fra gruppen", () => {
    for (const theme of report.themes) {
      const group = MIDTBYEN_GROUPS.find((g) => g.id === theme.id)!;
      expect(theme.icon).toBe(group.icon);
      expect(theme.color).toBe(group.color);
    }
  });
});

describe("gjennom board-adapteren", () => {
  const board = adaptBoardData(transformToReportData(project));

  it("gir board-data uten lyd og uten meglere", () => {
    expect(board.audioTourEnabled).toBe(false);
    expect(board.welcome).toBeUndefined();
    expect(board.outro).toBeUndefined();
    expect(board.home.audio).toBeUndefined();
    expect(board.brokers ?? []).toEqual([]);
    for (const category of board.categories) {
      expect(category.audio, category.id).toBeUndefined();
    }
  });

  it("setter hjem til Torvet-ankeret", () => {
    expect(board.home.coordinates).toEqual(TORVET);
    expect(board.home.district).toBe("Midtbyen");
    expect(board.home.city).toBe("Trondheim");
  });

  it("gir hver kategori et drill-in-panel", () => {
    for (const category of board.categories) {
      expect(category.editorial?.body?.length ?? 0, category.id).toBeGreaterThan(0);
    }
  });

  it("sorterer nabolagslista etter gangtid fra Torvet", () => {
    // Hele poenget med ankeret: uscopet liste, nærmeste først.
    const list = buildNeighbourhoodList(board.categories, null);
    for (const category of list.categories) {
      const walks = category.rows.map((r) => r.walkMinutes ?? Infinity);
      expect([...walks].sort((a, b) => a - b), category.id).toEqual(walks);
    }
  });

  it("gir alle 147 punktene en synlig gangtid i lista", () => {
    const list = buildNeighbourhoodList(board.categories, null);
    const rows = list.categories.flatMap((c) => c.rows);
    expect(rows.every((r) => typeof r.walkMinutes === "number")).toBe(true);
  });
});
