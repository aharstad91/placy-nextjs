import { describe, expect, it } from "vitest";
import {
  buildingNames,
  developmentByPlaceId,
  projectDevelopment,
  BUILD_STATUS_KNOWLEDGE,
} from "@/lib/demo/local-board/development";
import { localTopicsSchema, type LocalTopic } from "@/lib/demo/local-board/schema";

/**
 * Projeksjonen er det ene stedet betydningen kan gå tapt.
 *
 * Et boligprosjekt under bygging har fire opplysninger som ligner på hverandre
 * og betyr forskjellige ting: byggestatus, åpning, tidspunkt og adgang. Testene
 * her låser at ingen av dem kan bli til en av de andre — særlig ikke til
 * «åpent», som er svaret demoen ikke har lov til å gi uten kilde.
 */

const topic = (overrides: Record<string, unknown>, development: Record<string, unknown>): LocalTopic =>
  localTopicsSchema.parse([
    {
      id: "objekt",
      title: "Objektet",
      status: "existing",
      text: "En opplysning.",
      checkedAt: "2026-09-18",
      development: { objectType: "facility", buildStatus: "existing", availability: "unknown", access: { scope: "unresolved" }, ...development },
      ...overrides,
    },
  ])[0];

describe("projeksjonen av ett utbyggingsobjekt", () => {
  it("returnerer ingenting for et vanlig tema", () => {
    const plain = localTopicsSchema.parse([
      { id: "t", title: "T", status: "existing", text: "Noe.", checkedAt: "2026-09-18" },
    ])[0];
    expect(projectDevelopment(plain)).toBeNull();
  });

  it("AE2: et ferdig bygg gjør ikke fasiliteten åpen", () => {
    const building = topic({ id: "bygg-a", title: "Bygg A" }, { objectType: "building", buildStatus: "existing", availability: "unknown" });
    const gym = topic({ id: "treningsrom", title: "Treningsrommet" }, { buildStatus: "existing", availability: "unknown" });

    const buildingProjection = projectDevelopment(building)!;
    expect(buildingProjection.statusNote).toContain("eksisterende");
    expect(buildingProjection.knowledgeStatus).toBe("existing");

    const projection = projectDevelopment(gym)!;
    // Ingen linje og ingen setning sier at noe er åpent.
    expect(projection.facts.find((f) => f.label === "Åpning")!.value).toBe("åpning ikke oppgitt");
    expect(JSON.stringify(projection)).not.toMatch(/\båpent\b|\båpnet\b(?! ennå)/);
    expect(projection.caveats).toContain(
      "Kildene sier ikke om «Treningsrommet» er åpen. Ikke slutt at den er åpen.",
    );
  });

  it("AE3: en forventet dato formidles som forventning, aldri som løfte", () => {
    const gym = topic({ id: "treningsrom", title: "Treningsrommet" }, {
      buildStatus: "under-construction",
      availability: "expected",
      timing: { text: "Q1 2027", qualifier: "expected" },
    });
    const projection = projectDevelopment(gym)!;
    expect(projection.facts).toContainEqual({ label: "Forventet tidspunkt", value: "Q1 2027" });
    expect(projection.facts).not.toContainEqual({ label: "Bekreftet tidspunkt", value: "Q1 2027" });
    expect(projection.caveats).toContain(
      "Tidspunktet «Q1 2027» er en forventning fra kilden, ikke en bekreftet dato.",
    );
    expect(projection.caveats).toContain(
      "Ingen kilde bekrefter at «Treningsrommet» er tilgjengelig ved innflytting.",
    );
    // Under bygging er ikke et åpent tilbud i kunnskapsmodellen.
    expect(projection.knowledgeStatus).toBe("planned");
    expect(BUILD_STATUS_KNOWLEDGE["under-construction"]).toBe("planned");
  });

  it("AE3: en bekreftelse for bygg A gjelder ikke bygg B", () => {
    const topics = localTopicsSchema.parse([
      { id: "bygg-a", title: "Bygg A", status: "existing", text: "Bygg A.", checkedAt: "2026-09-18",
        development: { objectType: "building", buildStatus: "existing", availability: "open", availabilityClaimId: "c1", access: { scope: "all-residents" },
          claims: [{ id: "c1", text: "Bygg A er overtatt.", sourceId: "kilde", checkedAt: "2026-09-18" }] } },
      { id: "bygg-b", title: "Bygg B", status: "planned", text: "Bygg B.", checkedAt: "2026-09-18",
        development: { objectType: "building", buildStatus: "under-construction", availability: "not-open", access: { scope: "unresolved" } } },
      { id: "sykkelrom", title: "Sykkelrommet", status: "existing", text: "Sykkelrom.", checkedAt: "2026-09-18",
        development: { objectType: "facility", buildStatus: "existing", availability: "expected", access: { scope: "named-buildings", buildingIds: ["bygg-a"] },
          moveInLinks: [{ buildingId: "bygg-a", confirmedBy: "kilde" }] } },
    ]);
    const names = buildingNames(topics);
    const facility = projectDevelopment(topics[2], names)!;
    expect(facility.facts).toContainEqual({ label: "Bekreftet ved innflytting", value: "Bygg A" });
    expect(facility.facts).toContainEqual({ label: "Adgang", value: "Bygg A" });
    // Bygg B nevnes ingen steder i objektets projeksjon.
    expect(JSON.stringify(facility)).not.toContain("Bygg B");
    // Og bygg B har sin egen projeksjon, uten bekreftelsen.
    const b = projectDevelopment(topics[1], names)!;
    expect(b.facts.some((f) => f.label === "Bekreftet ved innflytting")).toBe(false);
    expect(b.caveats).toContain("Ingen kilde bekrefter at «Bygg B» er tilgjengelig ved innflytting.");
  });

  it("sier i klartekst at et objekt som ikke er åpnet, ikke er åpnet", () => {
    const gym = topic({ id: "treningsrom", title: "Treningsrommet" }, {
      buildStatus: "under-construction",
      availability: "not-open",
    });
    const projection = projectDevelopment(gym)!;
    expect(projection.facts.find((f) => f.label === "Åpning")!.value).toBe("ikke åpnet");
    expect(projection.caveats).toContain("«Treningsrommet» er ikke åpnet ennå.");
  });

  it("et bekreftet tidspunkt står uten forventnings-forbehold", () => {
    const gym = topic({ id: "treningsrom", title: "Treningsrommet" }, {
      availability: "unknown",
      timing: { text: "Q2 2027", qualifier: "confirmed" },
    });
    const projection = projectDevelopment(gym)!;
    expect(projection.facts).toContainEqual({ label: "Bekreftet tidspunkt", value: "Q2 2027" });
    expect(projection.facts).not.toContainEqual({ label: "Forventet tidspunkt", value: "Q2 2027" });
    expect(projection.caveats.some((c) => c.includes("er en forventning fra kilden"))).toBe(false);
  });

  it("AE4: motstridende påstander blir begge stående, uten at én vinner", () => {
    const conflicted = topic({ id: "treningsrom", title: "Treningsrommet" }, {
      availability: "unknown",
      claims: [
        { id: "prospekt", text: "Treningsrom i kjelleren i bygg A.", sourceId: "kilde", checkedAt: "2026-01-02" },
        { id: "nettside", text: "Treningsrom i bygg B.", sourceId: "kilde", checkedAt: "2026-09-01" },
      ],
      conflicts: [{ claimIds: ["prospekt", "nettside"], note: "Kildene plasserer treningsrommet i hvert sitt bygg." }],
    });
    const projection = projectDevelopment(conflicted)!;
    const line = projection.caveats.find((c) => c.startsWith("Kildene spriker"))!;
    expect(line).toContain("Treningsrom i kjelleren i bygg A.");
    expect(line).toContain("Treningsrom i bygg B.");
    expect(line).toContain("Kildene plasserer treningsrommet i hvert sitt bygg.");
    // Ingen rangering: den nyeste påstanden står ikke alene.
    expect(projection.facts.some((f) => f.value.includes("bygg B"))).toBe(false);
  });

  it("bruker aldri kontrolldato som åpningsdato, og en passert dato åpner ingenting", () => {
    const past = topic({ id: "treningsrom", title: "Treningsrommet" }, {
      availability: "expected",
      timing: { text: "høsten 2024", qualifier: "expected" },
      claims: [{ id: "c1", text: "Åpning er varslet.", sourceId: "kilde", checkedAt: "2024-01-01" }],
    });
    const projection = projectDevelopment(past)!;
    expect(projection.facts.find((f) => f.label === "Åpning")!.value).toBe("åpning forventet");
    expect(projection.facts).toContainEqual({ label: "Forventet tidspunkt", value: "høsten 2024" });
    // Kontrolldatoen står ikke i noen linje som handler om åpning.
    expect(JSON.stringify(projection.facts)).not.toContain("2024-01-01");
    expect(projection.caveats).toContain(
      "Tidspunktet «høsten 2024» er en forventning fra kilden, ikke en bekreftet dato.",
    );
  });

  it("holder objekter uten kartanker utenfor stedsoppslaget", () => {
    const anchored = topic({ id: "med-anker" }, { mapAnchor: { placeId: "sted-a" } });
    const free = topic({ id: "uten-anker" }, {});
    const byPlace = developmentByPlaceId([anchored, free]);
    expect([...byPlace.keys()]).toEqual(["sted-a"]);
  });

  it("viser et eksplisitt omtrentlig anker som en linje, ikke som et kartpunkt", () => {
    const approximate = topic({ id: "uteomrade", title: "Uteområdet" }, {
      objectType: "outdoor-area",
      mapAnchor: { approximateArea: "Mellom bygg A og bygg B." },
    });
    expect(projectDevelopment(approximate)!.facts).toContainEqual({
      label: "Omtrentlig plassering",
      value: "Mellom bygg A og bygg B.",
    });
    expect(developmentByPlaceId([approximate]).size).toBe(0);
  });

  it("viser adgangsvilkår i klartekst og navngir byggene", () => {
    const topics = localTopicsSchema.parse([
      { id: "bygg-a", title: "Bygg A", status: "existing", text: "A.", checkedAt: "2026-09-18",
        development: { objectType: "building", buildStatus: "existing", availability: "unknown", access: { scope: "unresolved" } } },
      { id: "bygg-b", title: "Bygg B", status: "existing", text: "B.", checkedAt: "2026-09-18",
        development: { objectType: "building", buildStatus: "existing", availability: "unknown", access: { scope: "unresolved" } } },
      { id: "takterrasse", title: "Takterrassen", status: "existing", text: "Tak.", checkedAt: "2026-09-18",
        development: { objectType: "outdoor-area", buildStatus: "existing", availability: "unknown",
          access: { scope: "named-buildings", buildingIds: ["bygg-a", "bygg-b"], conditions: "med nøkkelbrikke" } } },
    ]);
    expect(projectDevelopment(topics[2], buildingNames(topics))!.facts).toContainEqual({
      label: "Adgang",
      value: "Bygg A og Bygg B — med nøkkelbrikke",
    });
  });
});
