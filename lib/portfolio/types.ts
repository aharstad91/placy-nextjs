/**
 * Porteføljekartets datamodell — én meglerkjedes nybyggprosjekter som pins.
 *
 * Merkingen (`chain`, `developer`) er BEVISST uavhengig av hvilken kunde et
 * eventuelt board er registrert på: Wesselsløkka-boardet ligger på kunden
 * `broset-utvikling-as` og Sundsøya på `placy-demo`, men begge selges av HEM.
 * Er kjeden utledet av kunde-id-en, faller begge ut av HEM-kartet.
 */

export interface PortfolioBoardRef {
  /** Kunde-id boardet er registrert på i `v2.projects.customer_id`. */
  customerId: string;
  /** `v2.projects.url_slug`. */
  slug: string;
}

export interface PortfolioProject {
  /** Stabil id innenfor kjeden. Brukes som React-key og som valgt-id. */
  id: string;
  /** Prosjektnavn slik kjeden selv skriver det. */
  name: string;
  lat: number;
  lng: number;
  /** Bydel eller kommune — lista viser den under navnet. */
  subtitle?: string;
  /** Meglerkjeden som selger prosjektet. */
  chain: string;
  /** Utbygger. `"ukjent"` når ingen kilde oppgir den — aldri gjettet. */
  developer: string;
  /**
   * Peker til et eksisterende Placy-board. Er den satt uten at raden finnes i
   * `v2.projects`, rendres prosjektet som pin uten lenke — ikke som død lenke
   * (se `resolve-boards`).
   */
  board?: PortfolioBoardRef;
}

export interface Portfolio {
  /** URL-segmentet: `/portefolje/<slug>`. */
  slug: string;
  /** Visningsnavn i sidetittelen. */
  name: string;
  projects: PortfolioProject[];
}

/**
 * Prosjekt etter board-oppslaget. `boardUrl` er satt KUN når board-referansen
 * traff en rad i `v2.projects`.
 */
export interface ResolvedPortfolioProject extends PortfolioProject {
  boardUrl?: string;
}

/** Norges bounding-boks — valideringsgrense for håndskrevne koordinater. */
export const NORWAY_BOUNDS = {
  minLat: 57.9,
  maxLat: 71.3,
  minLng: 4.3,
  maxLng: 31.2,
} as const;

export function isInsideNorway(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= NORWAY_BOUNDS.minLat &&
    lat <= NORWAY_BOUNDS.maxLat &&
    lng >= NORWAY_BOUNDS.minLng &&
    lng <= NORWAY_BOUNDS.maxLng
  );
}
