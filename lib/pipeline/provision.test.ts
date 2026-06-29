import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

vi.mock("@/lib/pipeline/geocode", () => ({
  geocodeAddress: vi.fn(),
  getKommunenummer: vi.fn(),
  meetsGeocodeConfidence: vi.fn(() => true),
}));
vi.mock("@/lib/pipeline/create-report-project", () => ({ createReportProject: vi.fn() }));
vi.mock("@/lib/pipeline/import-public-pois", () => ({ importPublicPois: vi.fn() }));
vi.mock("@/lib/pipeline/enrich-report-pois", async (orig) => ({
  ...(await orig<typeof import("@/lib/pipeline/enrich-report-pois")>()),
  enrichReportPois: vi.fn(),
}));
vi.mock("@/lib/pipeline/validate-report-trust", () => ({ validateReportTrust: vi.fn() }));
vi.mock("@/lib/pipeline/hydrate-report", () => ({ hydrateReport: vi.fn() }));
vi.mock("@/lib/pipeline/inherit-area-editorial", () => ({ inheritAreaEditorial: vi.fn() }));
vi.mock("@/lib/pipeline/provision-acceptance", () => ({ runAcceptanceCheck: vi.fn() }));

import { geocodeAddress, getKommunenummer } from "@/lib/pipeline/geocode";
import { createReportProject } from "@/lib/pipeline/create-report-project";
import { importPublicPois } from "@/lib/pipeline/import-public-pois";
import { enrichReportPois } from "@/lib/pipeline/enrich-report-pois";
import { validateReportTrust } from "@/lib/pipeline/validate-report-trust";
import { hydrateReport } from "@/lib/pipeline/hydrate-report";
import { inheritAreaEditorial } from "@/lib/pipeline/inherit-area-editorial";
import { runAcceptanceCheck } from "@/lib/pipeline/provision-acceptance";
import { provisionReportBoard } from "./provision";

const m = {
  geocode: vi.mocked(geocodeAddress),
  kommune: vi.mocked(getKommunenummer),
  project: vi.mocked(createReportProject),
  publicPois: vi.mocked(importPublicPois),
  enrich: vi.mocked(enrichReportPois),
  trust: vi.mocked(validateReportTrust),
  hydrate: vi.mocked(hydrateReport),
  editorial: vi.mocked(inheritAreaEditorial),
  acceptance: vi.mocked(runAcceptanceCheck),
};

function setHappyDefaults(existed = false) {
  m.geocode.mockResolvedValue([
    { placeName: "Adr", lat: 63.4, lng: 10.4, confidence: 1, city: "Trondheim" },
  ]);
  m.kommune.mockResolvedValue({ kommunenummer: "5001", kommunenavn: "Trondheim" });
  m.project.mockResolvedValue({
    projectId: "intern_x", productId: "prod-1", customerSlug: "intern", slug: "x",
    existed, warnings: [],
  });
  m.publicPois.mockResolvedValue({ counts: { nsr: 1, barnehagefakta: 1, overpass: 1 }, warnings: [] });
  m.enrich.mockResolvedValue({ google: { total: 20, new: 20, updated: 0, byCategory: {} }, warnings: [] });
  m.trust.mockResolvedValue({ scored: 10, skipped: 0, skippedPublic: 5, stillNull: [], warnings: [] });
  m.hydrate.mockResolvedValue({ productPoisLinked: 20, featuredMarked: 6, categoriesPopulated: 8, warnings: [] });
  m.editorial.mockResolvedValue({
    skipped: true, areaName: "", themesInherited: [], highlights: { kept: 0, dropped: [] }, warnings: [],
  });
  m.acceptance.mockResolvedValue({ ok: true, findings: [], urls: { local: "l", prod: "p" } });
}

const BASE = {
  name: "X", address: "Adr", customer: "intern", profile: "bolig" as const,
  has3dAddon: false, allowUpdate: false,
};

describe("provisionReportBoard (orkestrator-kjerne)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHappyDefaults();
  });

  it("AC4: kjernen importerer ikke readline/stdin (TTY-løs)", () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "provision.ts"), "utf8");
    expect(src).not.toMatch(/from\s+["']readline["']/);
    expect(src).not.toContain("process.stdin");
  });

  it("confirmCoords gitt → kjernen geocoder IKKE (CLI har resolvet)", async () => {
    const result = await provisionReportBoard({ ...BASE, confirmCoords: { lat: 1, lng: 2 }, placeName: "P" });
    expect(m.geocode).not.toHaveBeenCalled();
    expect(result.acceptance?.ok).toBe(true);
    expect(result.projectId).toBe("intern_x");
  });

  it("uten confirmCoords → kjernen geocoder selv (self-serve)", async () => {
    await provisionReportBoard(BASE);
    expect(m.geocode).toHaveBeenCalledWith("Adr");
  });

  it("existed && !allowUpdate → aborted, ingen discovery/writes nedstrøms", async () => {
    setHappyDefaults(true);
    const result = await provisionReportBoard({ ...BASE, confirmCoords: { lat: 1, lng: 2 } });
    expect(result.aborted?.reason).toBe("exists");
    expect(m.publicPois).not.toHaveBeenCalled();
    expect(m.enrich).not.toHaveBeenCalled();
    expect(m.acceptance).not.toHaveBeenCalled();
  });

  it("nærings-profil → hopper over offentlige POI (importPublicPois ikke kalt)", async () => {
    await provisionReportBoard({ ...BASE, profile: "naering", confirmCoords: { lat: 1, lng: 2 } });
    expect(m.publicPois).not.toHaveBeenCalled();
    // men Google-discovery kjører fortsatt
    expect(m.enrich).toHaveBeenCalled();
  });

  it("AC1: stegene kjører i ratifisert rekkefølge (project→enrich→trust→hydrate→editorial→acceptance)", async () => {
    const order: string[] = [];
    m.project.mockImplementation(async () => { order.push("project"); return {
      projectId: "intern_x", productId: "prod-1", customerSlug: "intern", slug: "x", existed: false, warnings: [],
    }; });
    m.publicPois.mockImplementation(async () => { order.push("public"); return { counts: { nsr: 0, barnehagefakta: 0, overpass: 0 }, warnings: [] }; });
    m.enrich.mockImplementation(async () => { order.push("enrich"); return { google: { total: 0, new: 0, updated: 0, byCategory: {} }, warnings: [] }; });
    m.trust.mockImplementation(async () => { order.push("trust"); return { scored: 0, skipped: 0, skippedPublic: 0, stillNull: [], warnings: [] }; });
    m.hydrate.mockImplementation(async () => { order.push("hydrate"); return { productPoisLinked: 0, featuredMarked: 0, categoriesPopulated: 0, warnings: [] }; });
    m.editorial.mockImplementation(async () => { order.push("editorial"); return { skipped: true, areaName: "", themesInherited: [], highlights: { kept: 0, dropped: [] }, warnings: [] }; });
    m.acceptance.mockImplementation(async () => { order.push("acceptance"); return { ok: true, findings: [], urls: { local: "l", prod: "p" } }; });

    await provisionReportBoard({ ...BASE, confirmCoords: { lat: 1, lng: 2 } });

    expect(order).toEqual(["project", "public", "enrich", "trust", "hydrate", "editorial", "acceptance"]);
  });
});
