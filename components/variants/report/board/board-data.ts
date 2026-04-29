import type { POI } from "@/lib/types";
import type { ReportData, ReportTheme, ThemeIllustration } from "../report-data";

// Branded ID-typer forhindrer ID-blanding mellom theme-IDer og POI-IDer
// i state-reducer og dispatch-calls.
export type BoardCategoryId = string & { readonly __brand: "BoardCategoryId" };
export type BoardPOIId = string & { readonly __brand: "BoardPOIId" };

export interface BoardPOI {
  id: BoardPOIId;
  name: string;
  coordinates: { lat: number; lng: number };
  address?: string;
  /** Body-tekst sammensatt av editorialHook + localInsight (begge optional). */
  body?: string;
  /** Kategori-IDen POI tilhører i board-modellen — brukes når vi opener POI uten å vite hvilken kategori. */
  categoryId: BoardCategoryId;
  /** Original POI bevart for fall-through-tilgang (Google rating, photos, opening hours, etc.). */
  raw: POI;
}

export interface BoardCategory {
  id: BoardCategoryId;
  /** Kategori-navn vist i rail og som peek-eyebrow (f.eks. "Barn & Oppvekst"). */
  label: string;
  /** Original spørsmål fra theme.question (f.eks. "Er det bra for barna?"). Vist i prototype men ikke i header etter redesign. */
  question?: string;
  /** Kort lead-tekst vist i peek-card og under modal-tittel. */
  lead: string;
  /** Lengre body-tekst for reading-modal Info-tab. Sammensatt av upperNarrative eller intro+bridgeText. */
  body: string;
  /** Optional banner-illustrasjon. */
  illustration?: ThemeIllustration;
  /** Lucide ikon-navn fra report-themes (brukes i rail og marker). */
  icon: string;
  /** Kategori-farge (hex) brukt i markører, path-line, og UI-aksenter. */
  color: string;
  pois: BoardPOI[];
}

export interface BoardHome {
  name: string;
  coordinates: { lat: number; lng: number };
  address: string;
}

export interface BoardData {
  home: BoardHome;
  categories: BoardCategory[];
}

/**
 * Mapper ReportData → BoardData. Filtrerer bort tema uten POI-er (board kan ikke
 * vise tom kategori) og normaliserer feltnavn.
 *
 * Body-felt-mapping (per doc-review beslutning):
 * - lead = theme.intro || theme.leadText (kort)
 * - body = theme.upperNarrative || (theme.intro + bridgeText konkatenert)
 *
 * Hvis en kategori mangler all narrativ tekst (verken intro, leadText, eller upperNarrative),
 * faller den IKKE ut — vi viser tom Info-tab. Punkter-tab er fortsatt nyttig.
 */
export function adaptBoardData(report: ReportData): BoardData {
  const categories: BoardCategory[] = report.themes
    .filter((t) => t.allPOIs.length > 0)
    .map((t) => adaptCategory(t));

  return {
    home: {
      name: report.projectName,
      coordinates: report.centerCoordinates,
      address: report.address,
    },
    categories,
  };
}

function adaptCategory(theme: ReportTheme): BoardCategory {
  const id = theme.id as BoardCategoryId;

  // Lead: kort hook hvis eksplisitt leadText, ellers første del av intro
  const lead = theme.leadText?.trim() || theme.intro?.trim() || "";

  // Body: alle narrative bidrag konkatenert, dedupert mot lead.
  // Rekkefølge: upperNarrative (rik) → intro (basis) → bridgeText (overgang).
  const bodyParts = [
    theme.upperNarrative?.trim(),
    theme.intro?.trim(),
    theme.bridgeText?.trim(),
  ].filter((s): s is string => Boolean(s));
  const seen = new Set<string>();
  if (lead) seen.add(lead);
  const body = bodyParts
    .filter((part) => {
      if (seen.has(part)) return false;
      seen.add(part);
      return true;
    })
    .join("\n\n");

  // Fallbacks når reportConfig.themes peker på en theme-id uten bransjeprofil-base
  // (merge `{ ...undefined, ...rcTheme }` gir manglende name/icon/color).
  const label = theme.name || theme.id;
  const icon = theme.icon || "MapPin";
  const color = theme.color || "#94a3b8"; // stone-400

  return {
    id,
    label,
    question: theme.question,
    lead,
    body,
    illustration: theme.image,
    icon,
    color,
    pois: theme.allPOIs.map((p) => adaptPOI(p, id)),
  };
}

function adaptPOI(poi: POI, categoryId: BoardCategoryId): BoardPOI {
  const hook = poi.editorialHook?.trim();
  const insight = poi.localInsight?.trim();
  const body = [hook, insight].filter(Boolean).join("\n\n") || undefined;

  return {
    id: poi.id as BoardPOIId,
    name: poi.name,
    coordinates: poi.coordinates,
    address: poi.address,
    body,
    categoryId,
    raw: poi,
  };
}
