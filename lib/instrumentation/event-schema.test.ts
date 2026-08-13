import { describe, it, expect } from "vitest";
import { logEventSchema } from "./event-schema";

/**
 * Skjema-vakter for Utforsk-typene (migrasjon 085).
 *
 * Moat 2-data kan ikke repareres i ettertid — de 19 pre-fiks-radene i prod uten
 * kontekst-konvolutt er nettopp derfor ubrukelige. Skjemaet er siste sperre før
 * en ubrukelig rad havner i DB, så det testes eksplisitt.
 */

const CONTEXT = {
  mode: "report" as const,
  has_3d_addon: false,
  categories_presented: ["home", "mat-drikke"],
  locale: "no",
};

describe("poi_explore_opened", () => {
  it("godtar heterogen POI-ID på top-level (aldri .uuid() på POI-IDer)", () => {
    for (const poiId of [
      "google-ChIJe2pnuSJibUYRqz4D6mc_JdM",
      "entur-NSR-StopPlace-271",
      "osm-node-507054412",
      "3f8c1a90-1111-4222-8333-444455556666",
    ]) {
      const result = logEventSchema.safeParse({
        eventType: "poi_explore_opened",
        projectId: "placy-demo_sundsoya",
        poiId,
        payload: { category_id: "park", has_grounding: true, context: CONTEXT },
      });
      expect(result.success, `${poiId} skal passere`).toBe(true);
    }
  });

  it("krever has_grounding — uten det kan raden ikke skille innhold fra tilstedeværelse", () => {
    const result = logEventSchema.safeParse({
      eventType: "poi_explore_opened",
      projectId: "placy-demo_sundsoya",
      poiId: "google-abc",
      payload: { category_id: "park", context: CONTEXT },
    });
    expect(result.success).toBe(false);
  });

  it("krever payload i det hele tatt", () => {
    const result = logEventSchema.safeParse({
      eventType: "poi_explore_opened",
      projectId: "placy-demo_sundsoya",
      poiId: "google-abc",
    });
    expect(result.success).toBe(false);
  });

  it("avviser ukjente payload-nøkler (ingen jsonb-forgiftning)", () => {
    const result = logEventSchema.safeParse({
      eventType: "poi_explore_opened",
      projectId: "placy-demo_sundsoya",
      poiId: "google-abc",
      payload: {
        has_grounding: true,
        context: CONTEXT,
        // ToS-forbudt: sporing av HVILKEN kildelenke som ble klikket skal ikke
        // engang kunne uttrykkes i skjemaet.
        clicked_source_url: "https://example.com",
      },
    });
    expect(result.success).toBe(false);
  });

  it("avviser ufullstendig kontekst-konvolutt", () => {
    const result = logEventSchema.safeParse({
      eventType: "poi_explore_opened",
      projectId: "placy-demo_sundsoya",
      poiId: "google-abc",
      payload: {
        has_grounding: true,
        context: { mode: "report", locale: "no" },
      },
    });
    expect(result.success).toBe(false);
  });
});

describe("poi_outbound_clicked", () => {
  it("godtar poiId + kategori + konvolutt", () => {
    const result = logEventSchema.safeParse({
      eventType: "poi_outbound_clicked",
      projectId: "placy-demo_sundsoya",
      poiId: "osm-node-1206486493",
      payload: { category_id: "park", context: CONTEXT },
    });
    expect(result.success).toBe(true);
  });

  it("avviser ukjent event-type i nærheten av navnet", () => {
    const result = logEventSchema.safeParse({
      eventType: "poi_outbound_click",
      projectId: "placy-demo_sundsoya",
    });
    expect(result.success).toBe(false);
  });
});
