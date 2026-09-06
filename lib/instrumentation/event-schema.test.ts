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

/**
 * `travel_mode` i konvolutten (R14).
 *
 * Denne vakten finnes fordi `contextEnvelope` er `.strict()` OG `logEvent` er
 * fail-soft: hadde feltet manglet i skjemaet mens typen krevde det, ville ALLE
 * events blitt avvist uten en eneste feilmelding. Et nytt konvolutt-felt må
 * utvides på begge steder i samme commit.
 */
describe("faq_opened", () => {
  it("godtar faq_id + kategori + konvolutt", () => {
    const result = logEventSchema.safeParse({
      eventType: "faq_opened",
      projectId: "placy-demo_sundsoya",
      payload: { faq_id: "skolekrets", category_id: "barn-oppvekst", context: CONTEXT },
    });
    expect(result.success).toBe(true);
  });

  it("godtar global FAQ uten kategori", () => {
    const result = logEventSchema.safeParse({
      eventType: "faq_opened",
      payload: { faq_id: "til-byen", context: CONTEXT },
    });
    expect(result.success).toBe(true);
  });

  it("avviser manglende payload — uten faq_id er det ingenting å aggregere", () => {
    expect(logEventSchema.safeParse({ eventType: "faq_opened" }).success).toBe(false);
  });

  it("avviser poi_id på top-level (attribusjonen hører ikke til FAQ)", () => {
    const result = logEventSchema.safeParse({
      eventType: "faq_opened",
      poiId: "osm-1",
      payload: { faq_id: "skolekrets" },
    });
    expect(result.success).toBe(false);
  });
});

describe("kontekst-konvoluttens source (inngangskilde)", () => {
  const withContext = (context: Record<string, unknown>) =>
    logEventSchema.safeParse({ eventType: "board_viewed", payload: { context } });

  it.each(["qr", "finn", "mail", "some-story_2"])("godtar %s", (source) => {
    expect(withContext({ ...CONTEXT, source }).success).toBe(true);
  });

  it("utelatt → godtas (de fleste økter har ingen kilde)", () => {
    expect(withContext(CONTEXT).success).toBe(true);
  });

  it.each(["FINN", "fra facebook", "x".repeat(33), ""])("avviser %j", (source) => {
    expect(withContext({ ...CONTEXT, source }).success).toBe(false);
  });
});

describe("kontekst-konvoluttens travel_mode", () => {
  const withContext = (context: Record<string, unknown>) =>
    logEventSchema.safeParse({
      eventType: "board_viewed",
      payload: { context },
    });

  it.each(["walk", "bike", "car"])("godtar %s", (travel_mode) => {
    expect(withContext({ ...CONTEXT, travel_mode }).success).toBe(true);
  });

  it("mangler feltet → godtas og defaultes til gå (klient på forrige bundle)", () => {
    const parsed = withContext(CONTEXT);
    expect(parsed.success).toBe(true);
    expect(
      (parsed.data?.payload as { context: { travel_mode: string } }).context
        .travel_mode,
    ).toBe("walk");
  });

  it("ukjent modus avvises (ingen vilkårlig streng inn i basen)", () => {
    expect(withContext({ ...CONTEXT, travel_mode: "helikopter" }).success).toBe(
      false,
    );
    expect(withContext({ ...CONTEXT, travel_mode: 3 }).success).toBe(false);
  });

  it("full konvolutt med modus bevarer de andre feltene", () => {
    const parsed = withContext({ ...CONTEXT, travel_mode: "car" });
    expect(
      (parsed.data?.payload as { context: Record<string, unknown> }).context,
    ).toEqual({ ...CONTEXT, travel_mode: "car" });
  });
});

describe("isochrones_toggled (migrasjon 091)", () => {
  it("godtar av/på-tilstanden", () => {
    const result = logEventSchema.safeParse({
      eventType: "isochrones_toggled",
      projectId: "broset-utvikling-as_wesselslokka",
      payload: { enabled: true },
    });
    expect(result.success).toBe(true);
  });

  it("krever payload — et event uten tilstand er verdiløst som signal", () => {
    const result = logEventSchema.safeParse({
      eventType: "isochrones_toggled",
      projectId: "broset-utvikling-as_wesselslokka",
    });
    expect(result.success).toBe(false);
  });

  it("avviser et ukjent felt (skjemaet er strengt)", () => {
    const result = logEventSchema.safeParse({
      eventType: "isochrones_toggled",
      projectId: "broset-utvikling-as_wesselslokka",
      payload: { enabled: true, travel_mode: "walk" },
    });
    expect(result.success).toBe(false);
  });

  it("bærer ikke poi_id — konturene hører til boardet, ikke til ett sted", () => {
    const result = logEventSchema.safeParse({
      eventType: "isochrones_toggled",
      projectId: "broset-utvikling-as_wesselslokka",
      poiId: "google-abc",
      payload: { enabled: false },
    });
    expect(result.success).toBe(false);
  });
});
