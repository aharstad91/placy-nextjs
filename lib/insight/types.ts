// Innsikt (Moat 2) — typer for rapport-laget. Eid av innsiktsrapporten
// (`app/eiendom/[customer]/[project]/innsikt`).
//
// PERSONVERN-KONTRAKT (G5 + PRD 1 «NY tabell — events»): rapport-laget leser
// ALDRI `session_id`. Alt under er aggregater over ikke-PII-kolonner. Det
// betyr også at sekvens-signaler (hvilken kategori ble åpnet FØRST i en økt)
// ikke kan beregnes her — de krever en SQL-side aggregering som grupperer på
// session_id uten å returnere den. Se `aggregate.ts` for hva som ER mulig.

import type { EventType } from "@/lib/instrumentation/event-types";
import type { TravelMode } from "@/lib/types";

/** Én rad fra v2.events, uten session_id. `payload` er den validerte jsonb-en. */
export interface InsightEventRow {
  event_type: EventType;
  poi_id: string | null;
  payload: Record<string, unknown> | null;
  /** ISO-tidsstempel (created_at). */
  created_at: string;
}

/** Oppslag fra id → visningsnavn, bygd fra boardets egne data. */
export interface InsightLabels {
  /** Tema-id (category_opened.category_id) → visningsnavn + boardets ikon/farge. Bevarer boardets rekkefølge. */
  categories: Array<{ id: string; label: string; icon?: string; color?: string }>;
  /** POI-id → navn + temaet POI-et hører til på boardet. */
  pois: Map<string, { name: string; categoryId?: string }>;
  /** FAQ-spørsmåls-id → spørsmålstekst + temaet spørsmålet hører til (utelatt = global). */
  faq: Map<string, { question: string; categoryId?: string }>;
}

export interface CategoryInsight {
  id: string;
  label: string;
  /** Lucide-ikonnavn og hex-farge fra boardet — så rapporten ser ut som boardet. */
  icon?: string;
  color?: string;
  opens: number;
  /** Åpninger i forrige periode av samme lengde. */
  prevOpens: number;
  /** Andel av alle kategori-åpninger på boardet (0–1). */
  share: number;
  /** Samme andel på tvers av alle andre boards i vinduet (0–1); null uten grunnlag. */
  baselineShare: number | null;
  /** share − baselineShare i prosentpoeng; null uten grunnlag. */
  deltaPp: number | null;
  /** Plassen kategorien ble VIST på (1-basert, mest brukte rekkefølge); null om ukjent. */
  presentedPosition: number | null;
}

export interface PoiInsight {
  id: string;
  name: string;
  categoryId: string | null;
  categoryLabel: string | null;
  clicks: number;
  explores: number;
  outbound: number;
  /** clicks + explores i forrige periode. */
  prevTotal: number;
}

/** Ett spørsmål boardet VISER — også de som aldri er åpnet (opens = 0). */
export interface FaqInsight {
  id: string;
  question: string;
  categoryId: string | null;
  categoryLabel: string | null;
  opens: number;
  prevOpens: number;
}

export interface SourceInsight {
  /** Kanalnavn fra `?src=`; `direkte` når ingen kilde. */
  source: string;
  views: number;
  share: number;
  prevViews: number;
}

export interface DailyPoint {
  /** YYYY-MM-DD i Europe/Oslo. */
  date: string;
  views: number;
  /** Alle hendelser utenom board_viewed — «hvor mye de gjorde». */
  interactions: number;
}

export interface InsightReport {
  window: { since: string; until: string; days: number };
  /** Antall åpninger av boardet (board_viewed). Brukes som «økter» i MVP. */
  views: number;
  interactions: number;
  /** Under terskelen vises tallene som «for tidlig» — ikke prosenter. */
  threshold: { minViews: number; reached: boolean };
  /** Forrige periode av samme lengde — grunnlag for endrings-pilene. */
  previous: { views: number; interactions: number; daily: DailyPoint[] };
  daily: DailyPoint[];
  /** Åpninger per time siste 24 t (indeks 0 = for 23 t siden, 23 = nå). */
  hourly: number[];
  categories: CategoryInsight[];
  /** Alle steder med minst én handling, sortert. Visningen kutter selv. */
  pois: PoiInsight[];
  /** Alle viste spørsmål (katalog + kurator + globale), også de med 0 åpninger. */
  faq: FaqInsight[];
  sources: SourceInsight[];
  travelModes: Record<TravelMode, number>;
  /** Andel interaksjoner med 3D aktivt (0–1); null uten grunnlag. */
  threeDShare: number | null;
}
