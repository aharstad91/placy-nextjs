import { getPortfolio } from "@/lib/portfolio/portfolios";
import { resolvePortfolioBoards } from "@/lib/portfolio/resolve-boards";
import { fitPortfolioCamera, type PortfolioCamera } from "@/lib/portfolio/fit-camera";
import type { ResolvedPortfolioProject } from "@/lib/portfolio/types";

/**
 * Visningsmodellen for prosjektlista — ren, og bevisst SMAL.
 *
 * Typen bærer navn, undertittel, utbygger, board-status og lenke. Ingenting
 * annet: kartet skal ikke vise pris, volumtrapp eller salgsargumenter, og en
 * type uten feltene er en sterkere garanti enn en regel i en plan.
 */
export interface PortfolioRow {
  id: string;
  name: string;
  subtitle?: string;
  developer: string;
  /** Har prosjektet et levende Placy-board bak seg? */
  hasBoard: boolean;
  /** Satt kun når `hasBoard` er sant. */
  href?: string;
  /** Teksten som gjør skillet mellom de to tilstandene synlig (R4). */
  statusLabel: string;
}

export const BOARD_LABEL = "Åpne nabolagskart";
export const NO_BOARD_LABEL = "Ikke satt opp ennå";

/**
 * Radene i kjedefilas egen rekkefølge (alfabetisk på navn i HEM-fila).
 * Rekkefølgen er datalagets valg, ikke visningslagets — da kan Andreas styre
 * den ved å flytte en linje, uten å røre en sorteringsfunksjon.
 */
export function buildPortfolioRows(
  projects: ResolvedPortfolioProject[],
): PortfolioRow[] {
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    subtitle: project.subtitle,
    developer: project.developer,
    hasBoard: Boolean(project.boardUrl),
    href: project.boardUrl,
    statusLabel: project.boardUrl ? BOARD_LABEL : NO_BOARD_LABEL,
  }));
}

/** Alt siden trenger. `null` betyr 404. */
export interface PortfolioPageData {
  chainName: string;
  projects: ResolvedPortfolioProject[];
  rows: PortfolioRow[];
  camera: PortfolioCamera;
}

/**
 * Sidedata for en kjede-slug, eller `null` når ruten skal svare 404.
 *
 * To tilfeller gir `null`: ukjent kjede, og registrert kjede uten prosjekter.
 * Det siste er ikke teoretisk — en kjedefil under arbeid kan stå tom, og et
 * kart uten pins har ingen innramming å regne ut (`fitPortfolioCamera` gir
 * `null` for tom liste). Bedre 404 enn en tom flate foran en megler.
 */
export async function buildPortfolioPageData(
  slug: string,
): Promise<PortfolioPageData | null> {
  const portfolio = getPortfolio(slug);
  if (!portfolio || portfolio.projects.length === 0) return null;

  const projects = await resolvePortfolioBoards(portfolio.projects);
  const camera = fitPortfolioCamera(projects);
  if (!camera) return null;

  return {
    chainName: portfolio.name,
    projects,
    rows: buildPortfolioRows(projects),
    camera,
  };
}
