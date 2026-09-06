import { HEM_PORTFOLIO } from "@/data/portfolios/hem";
import type { Portfolio } from "@/lib/portfolio/types";

/**
 * Kjede-registeret. Strukturen er kjede-generisk (R8); bare HEM har data i v1.
 *
 * Server-only i praksis: kjedefilene importeres kun fra server components og
 * lib-kode. Ingen klientkomponent skal dra hele porteføljen inn i bundlen.
 */
const PORTFOLIOS: Record<string, Portfolio> = {
  [HEM_PORTFOLIO.slug]: HEM_PORTFOLIO,
};

/** Kjeden for en slug, eller `null` for ukjent slug. */
export function getPortfolio(slug: string): Portfolio | null {
  return PORTFOLIOS[slug] ?? null;
}

/** Alle registrerte kjede-slugs. Brukes av testene og av framtidig indeks. */
export function listPortfolioSlugs(): string[] {
  return Object.keys(PORTFOLIOS);
}
