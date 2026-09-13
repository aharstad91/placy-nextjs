/**
 * Formen samtalen leser kildekontrollert kunnskap i (2026-09-13).
 *
 * Typene er STRUKTURELLE med vilje. `lib/demo/nyhavna-leve/knowledge.ts` er en
 * håndskrevet TypeScript-modul med snevre literal-unioner (fire temaer, fem
 * relasjonstyper); det lokale JSON-datasettet
 * (`lib/demo/nyhavna-lokal/voice.ts`) har sine egne temaer og ingen relasjoner.
 * Begge skal kunne mate de SAMME kunnskapsverktøyene, ellers måtte
 * verktøykoden finnes i to utgaver — og da ville demoene begynt å svare ulikt
 * på samme spørsmål av grunner ingen kan se.
 *
 * Derfor: `readonly string[]` der modulen har en union, og alle felt som ikke
 * er nødvendige for et svar er valgfrie. Den håndskrevne modulen oppfyller
 * dette som den er.
 */

export interface KnowledgeSourceLike {
  id: string;
  label: string;
  page: string;
  url: string;
  checkedAt: string;
}

export interface KnowledgeFactLike {
  text: string;
  sourceId: string;
  checkedAt: string;
  verification: "confirmed" | "unresolved";
}

export interface KnowledgeRelationLike {
  type: string;
  targetEntityId: string;
  sourceId: string;
  verification: "confirmed" | "unresolved";
}

export interface KnowledgeEntityLike {
  id: string;
  name: string;
  readonly aliases: readonly string[];
  /** Temanøklene entiteten hører til — kildens egne, ikke boardets kategori-ID-er. */
  readonly themes: readonly string[];
  status: string;
  /** Kart-ID-en stedet har i boardet, eller null når det ikke kan plasseres. */
  mapPoiId: string | null;
  summary: string;
  readonly facts: readonly KnowledgeFactLike[];
  readonly relations: readonly KnowledgeRelationLike[];
}

export interface KnowledgeBase {
  readonly sources: readonly KnowledgeSourceLike[];
  readonly entities: readonly KnowledgeEntityLike[];
  /** Området selv — det stemmen svarer med når spørsmålet gjelder helheten. */
  readonly area: KnowledgeEntityLike;
}

/** Et tomt kunnskapsgrunnlag: ingen kilder, ingen steder, ingen påstander. */
export function emptyKnowledgeBase(id: string, name: string): KnowledgeBase {
  return {
    sources: [],
    entities: [],
    area: {
      id,
      name,
      aliases: [],
      themes: [],
      status: "unresolved",
      mapPoiId: null,
      summary: "",
      facts: [],
      relations: [],
    },
  };
}
