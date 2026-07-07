// Zod-validering av Moat-2-ingest ("Innsikt"). Eid av PRD 13 (instrumentering),
// audit-herding 2026-07-06.
//
// HVORFOR: `logEvent` er en `"use server"`-action → Next.js eksponerer den som et
// POST-endepunkt en angriper kan replaye. Uten skjema-validering går `payload`,
// `projectId`, `productId` og `poiId` rett inn i INSERT mot v2.events. Innsikt-
// datasettet skal bli et salgsargument — det må ikke kunne forgiftes med vilkårlige
// felter eller sprenges med multi-MB jsonb-blobs. Dette skjemaet er den harde
// grensen FØR insert: kjent event_type → nøyaktig den typede payloaden (ukjente
// nøkler avvist, streng-lengder og array-størrelser kappet), og id-feltene tvinges
// til forventet form.
//
// KONTRAKT: skjemaet speiler `EventPayloads`/`EngagementContextEnvelope` i
// event-types.ts. Endres én, MÅ den andre følge — ellers avviser vi legitime
// events eller slipper gjennom ukjente felter.

import { z } from "zod";
import { type EventType } from "./event-types";

// --- Caps (misbruks-tak, ikke funksjonelle grenser) -------------------------
// Alle er romslige for legitim board-bruk, men stopper spam/forgiftning.
const MAX_ID_LEN = 256; // poi_id er fri TEXT (Google place-id, entur, ...) — kapp, ikke mønster-lås
const MAX_CATEGORY_ID_LEN = 128;
const MAX_LOCALE_LEN = 16;
const MAX_SEGMENT_LEN = 128;
const MAX_CATEGORIES_PRESENTED = 64; // et board viser en håndfull kategorier; 64 er raust
/**
 * Total-cap på hele den serialiserte inputen (payload + id-er). Zod validerer
 * felt-for-felt, men et dypt/bredt objekt innenfor felt-cappene kan fortsatt bli
 * stort — denne grensen er ryggraden mot multi-MB jsonb-blobs. 8 KiB er langt over
 * en reell konvolutt+payload (~hundrevis av bytes).
 */
export const MAX_SERIALIZED_INPUT_BYTES = 8 * 1024;

// --- Byggeklosser ------------------------------------------------------------
// UUID v4-formen `crypto.randomUUID()` produserer (product_id).
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Fri opaque id (poi_id): ikke-tom, kappet, ingen kontrolltegn/linjeskift
// (blokkerer smugling av rare payloads via id-feltet). Ingen streng mønster-lås —
// poi-id-er kommer fra flere kilder (Google/entur/bysykkel/generert).
const opaqueId = z
  .string()
  .min(1)
  .max(MAX_ID_LEN)
  // Avvis C0-kontrolltegn + DEL i fri-tekst-id (blokkerer smugling av rare payloads).
  .refine((s) => !/[\x00-\x1f\x7f]/.test(s), "kontrolltegn ikke tillatt");

// Kontekst-konvolutten (EngagementContextEnvelope). `.strict()` avviser ukjente
// nøkler. `categories_presented` kappes i både antall og per-element-lengde.
const contextEnvelope = z
  .object({
    mode: z.enum(["report", "event"]),
    has_3d_addon: z.boolean(),
    categories_presented: z
      .array(z.string().min(1).max(MAX_CATEGORY_ID_LEN))
      .max(MAX_CATEGORIES_PRESENTED),
    locale: z.string().min(1).max(MAX_LOCALE_LEN),
  })
  .strict();

// Konvolutten er optional i typen (bakoverkompatible/degraderte stier), men når
// den er til stede MÅ den validere. Emit-sitene sender den alltid.
const optionalContext = contextEnvelope.optional();

const categoryId = z.string().min(1).max(MAX_CATEGORY_ID_LEN);

// --- Per-event-type payloads (speiler EventPayloads) -------------------------
// Alle `.strict()` → ukjente nøkler avvises (ingen vilkårlige felter i jsonb).
const payloadByType = {
  board_viewed: z.object({ context: optionalContext }).strict(),
  category_opened: z
    .object({ category_id: categoryId, context: optionalContext })
    .strict(),
  voiceover_played: z
    .object({
      voiceover_segment: z.string().min(1).max(MAX_SEGMENT_LEN),
      context: optionalContext,
    })
    .strict(),
  poi_clicked: z
    .object({ category_id: categoryId.optional(), context: optionalContext })
    .strict(),
} as const;

// Diskriminert union over event_type: hver variant binder riktig payload-skjema.
// project_id/product_id ligger på top-level (matcher LogEventInput). poi_id er
// KUN tillatt på poi_clicked (attribusjon skal ikke lekke inn på feil event-type).
// sessionId valideres separat (form-guard i session-id.ts) og tas ikke inn her.
// Variantene skrives eksplisitt (ikke .map) så z.infer beholder de typede
// payloadene — en generisk .map() ville kollapset unionen til `unknown`.
// project_id er en OPAQUE id: rapport-boards sender boardets UUID (`project.id`),
// ikke den kanoniske `customer_slug`-formen. 2026-07-06-herdingen låste feilaktig
// dette til PROJECT_ID_SHAPE (customer_slug) og droppet DERMED stille ALLE
// rapport-board-events (board_viewed m.fl.) siden emitteren aldri sendte den
// formen. Bundet + kontrolltegn-avvist som poi_id (auditens faktiske intensjon:
// hindre oversized/injection via id-feltet), uten å mønster-låse en id som
// legitimt kommer i flere former.
const projectId = opaqueId.optional();
const productId = z.string().regex(UUID_V4_RE).optional();

export const logEventSchema = z.discriminatedUnion("eventType", [
  z
    .object({
      eventType: z.literal("board_viewed"),
      projectId,
      productId,
      payload: payloadByType.board_viewed.optional(),
    })
    .strict(),
  z
    .object({
      eventType: z.literal("category_opened"),
      projectId,
      productId,
      payload: payloadByType.category_opened.optional(),
    })
    .strict(),
  z
    .object({
      eventType: z.literal("voiceover_played"),
      projectId,
      productId,
      payload: payloadByType.voiceover_played.optional(),
    })
    .strict(),
  z
    .object({
      eventType: z.literal("poi_clicked"),
      projectId,
      productId,
      poiId: opaqueId.optional(),
      payload: payloadByType.poi_clicked.optional(),
    })
    .strict(),
]);

// Kompilerings-vakt: hvis EVENT_TYPES utvides må en ny variant legges til over,
// ellers avviser skjemaet den nye typen. Denne linjen feiler tsc ved drift.
type _AllTypesCovered =
  EventType extends z.infer<typeof logEventSchema>["eventType"] ? true : never;
const _assertAllTypesCovered: _AllTypesCovered = true;
void _assertAllTypesCovered;

/** Validert, typet insert-input (payload er ikke lenger `unknown`). */
export type ValidatedLogEventInput = z.infer<typeof logEventSchema>;

export type ParseResult =
  | { ok: true; data: ValidatedLogEventInput }
  | { ok: false; reason: string };

// Top-level LogEventInput-feltene skjemaet bryr seg om. Vi PLUKKER disse fra rå-
// inputen før parsing: ukjente top-level-nøkler (f.eks. et spoofet `session_id`
// eller `event_type` i feil casing) ignoreres stille i stedet for å velte hele
// eventet — de når uansett aldri INSERT (raden bygges felt-for-felt i logEvent).
// Payload-INNHOLDET er derimot hardt `.strict()`-guardet (der ligger jsonb-
// forgiftnings-risikoen). `sessionId` plukkes IKKE — den valideres separat i
// logEvent (form-guard, degraderer ikke dropper).
const TOP_LEVEL_KEYS = ["eventType", "projectId", "productId", "poiId", "payload"] as const;

/**
 * Validerer rå ingest-input FØR insert. Kaster ALDRI — fail-soft-kontrakten i
 * `logEvent` krever at valideringsfeil returnerer stille. Rekkefølge:
 *  1) total-størrelse (billig avvisning av multi-MB-blobs før Zod-arbeid)
 *  2) plukk kjente top-level-felt (ignorer ukjente konvolutt-nøkler)
 *  3) skjema (kjent event_type + typet payload, ukjente PAYLOAD-nøkler avvist)
 */
export function parseLogEventInput(input: unknown): ParseResult {
  // (1) Total-cap: serialiser og mål før vi lar Zod traversere et digert objekt.
  let serializedBytes: number;
  try {
    serializedBytes = Buffer.byteLength(JSON.stringify(input ?? null), "utf8");
  } catch {
    return { ok: false, reason: "input ikke serialiserbar (sirkulær?)" };
  }
  if (serializedBytes > MAX_SERIALIZED_INPUT_BYTES) {
    return {
      ok: false,
      reason: `input for stor (${serializedBytes} > ${MAX_SERIALIZED_INPUT_BYTES} bytes)`,
    };
  }
  if (typeof input !== "object" || input === null) {
    return { ok: false, reason: "input er ikke et objekt" };
  }

  // (2) Plukk kjente top-level-felt.
  const source = input as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const key of TOP_LEVEL_KEYS) {
    if (key in source) picked[key] = source[key];
  }

  // (3) Skjema. safeParse kaster aldri.
  const parsed = logEventSchema.safeParse(picked);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.issues[0]?.message ?? "ugyldig input" };
  }
  return { ok: true, data: parsed.data };
}
