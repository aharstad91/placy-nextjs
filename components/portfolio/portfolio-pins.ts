import type { MapView3DSite } from "@/components/map/map-view-3d";
import type { ResolvedPortfolioProject } from "@/lib/portfolio/types";

/**
 * Chip-modellen porteføljekartet tegner — ren funksjon, ingen kart-avhengighet.
 *
 * Kartlaget tar ingen beslutning om tilstand; det tegner det det får. Da kan
 * hele tilstandslogikken testes uten WebGL, og de tre tilstandene kan ikke
 * drifte fra det lista viser.
 */

/**
 * Disc-størrelse på oversiktsutsnittet, som andel av chip-ens intrinsiske 52 px.
 *
 * Full størrelse er feil her: oversikten spenner ~165 km, og i Melhus-klyngen
 * ligger tre prosjekter under 2 km fra hverandre — noen få piksler på skjermen.
 * En 52 px disc ville smeltet dem til én flate. En liten disc holder dem synlig
 * som separate punkt.
 *
 * MERK likevel at små discs IKKE gjør en tett klynge trykkbar punkt for punkt:
 * på 390 px ligger Melhustorget og Sollia ~3 px fra hverandre, og ingen
 * chip-størrelse løser det. Det er nettopp derfor lista er den pålitelige
 * trykkflaten, og kartet gjenkjennelsen.
 */
export const OVERVIEW_PIN_SCALE = 0.42;

/** Navnet skal være lesbart selv om disc-en er liten — egen skala. */
export const OVERVIEW_LABEL_SCALE = 0.95;

export interface PortfolioPinState {
  /** Prosjektet som er valgt i lista eller klikket i kartet. */
  selectedId?: string | null;
  /** Prosjektet pekeren står over, i lista eller på kartet. */
  hoveredId?: string | null;
}

export function buildPortfolioPins(
  projects: ResolvedPortfolioProject[],
  { selectedId = null, hoveredId = null }: PortfolioPinState = {},
): MapView3DSite[] {
  return projects.map((project) => {
    const selected = project.id === selectedId;
    return {
      id: project.id,
      lat: project.lat,
      lng: project.lng,
      name: project.name,
      // Alltid en streng: chip-en faller ellers tilbake til boardets
      // «Nybygg 2028», som ville vært en påstand om årstall vi ikke har.
      subtitle: project.subtitle ?? project.chain,
      tone: project.boardUrl ? "board" : "muted",
      selected,
      // Navn bare på den ene chip-en som er valgt eller hovret. Chip-en har
      // ingen kollisjonshåndtering, så navn på alle 16 ville blitt ett teppe.
      showName: selected || project.id === hoveredId,
      scale: OVERVIEW_PIN_SCALE,
      labelScale: OVERVIEW_LABEL_SCALE,
    };
  });
}

/**
 * Hvilken motor kartet skal rendre.
 *
 * `MapView3D` viser bare en tekst-tilstand uten WebGL, og den delbare lenka har
 * ingen i rommet til å redde et tomt kart. Aldri begge samtidig: to WebGL-
 * kontekster på samme side er den dokumenterte iOS-krasjen.
 */
export function selectMapEngine(webglAvailable: boolean): "3d" | "2d" {
  return webglAvailable ? "3d" : "2d";
}
