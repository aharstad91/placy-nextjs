/**
 * Opprett kunde (upsert), prosjekt og rapport-produkt for basic-tier rapport-board.
 *
 * Container-ID-mønster: {customer}_{slug} (speil av Wesseløkka-konvensjonen).
 * Idempotent: finnes prosjektet allerede, returneres eksisterende ID-er uten
 * å overskrive felt som er satt (merge-semantikk per gull-mønsteret).
 */

import { createServerClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils/slugify";
import {
  getDiscoveryRadius,
  getThemeDefaults,
  type ReportProfile,
  type ReportThemeDefault,
} from "@/lib/pipeline/report-defaults";
import type { ReportTier } from "@/lib/validation/report-tier-schema";

/**
 * Reservert default-kunde når ingen kunde/megler er oppgitt (PRD 3 / r03.5 AC4).
 * Gir projectId/cache-tag = `intern_<slug>` og bevarer {customer}_{slug}-invarianten.
 * No-brokerage-stien (Unit 8) mapper eksplisitt hit.
 */
export const DEFAULT_CUSTOMER = "intern";

function generateShortId(length = 7): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export interface ReportProjectOptions {
  /** Prosjektnavn, f.eks. "Vikhammer Strand" */
  name: string;
  /** Full adresse, f.eks. "Vikhammer Strand, Vikhammer, Malvik" */
  address: string;
  lat: number;
  lng: number;
  customerSlug?: string;
  /** By for radius-kalibrering */
  city?: string;
  /** Kommunenavn for logging */
  kommunenavn?: string;
  /** Oppdater koordinater selv om prosjektet finnes fra før */
  updateCoords?: boolean;
  /** Profil: "bolig" (default) eller "naering" — styrer temaer, radius,
   *  venue_type og tags. */
  profile?: ReportProfile;
  /** Deklarert leveransenivå (1/2) — skrives i initial reportConfig.
   *  Utelatt → feltet utelates (nivå 1-default-semantikk). */
  reportTier?: ReportTier;
  /** 3D-addon — eksplisitt pipeline-input (CLI `--addon-3d`, default false).
   *  Ortogonalt render-flagg, UAVHENGIG av tier (ingen validator gater 3D mot
   *  tier). Skrives til projects.has_3d_addon. Self-serve sender false. */
  has3dAddon?: boolean;
}

export interface ReportProjectResult {
  /** Container-ID: {customer}_{slug} */
  projectId: string;
  productId: string;
  customerSlug: string;
  slug: string;
  /** true = prosjektet fantes fra før */
  existed: boolean;
  /** Oppdagede advisory-meldinger (ikke feil, men ting å sjekke) */
  warnings: string[];
}

function buildReportConfig(
  themes: ReportThemeDefault[],
  discoveryRadiusMeters: number,
  reportTier?: ReportTier,
) {
  return {
    reportConfig: {
      ...(reportTier !== undefined && { reportTier }),
      themes: themes.map((t) => ({
        id: t.id,
        name: t.name,
        icon: t.icon,
        categories: t.categories,
        color: t.color,
        leadText: t.leadText,
      })),
    },
    discoveryRadiusMeters,
  };
}

export async function createReportProject(
  options: ReportProjectOptions
): Promise<ReportProjectResult> {
  const baseClient = createServerClient();
  if (!baseClient) {
    throw new Error(
      "Supabase ikke konfigurert — sjekk SUPABASE_SERVICE_ROLE_KEY i .env.local"
    );
  }
  // v2-skrivesti (PRD 3 / r03.5 AC8): all prosjekt-/produkt-insert + merge-lookup
  // går mot v2. v2-typene (PRD 1 / r01.6) lar as-any-castene fjernes (AC7).
  const db = baseClient.schema("v2");

  const customerSlug = options.customerSlug ?? DEFAULT_CUSTOMER;
  const profile = options.profile ?? "bolig";
  const isNaering = profile === "naering";
  const warnings: string[] = [];

  // 1. Upsert kunde
  const { error: custError } = await db.from("customers").upsert(
    { id: customerSlug, name: customerSlug },
    { onConflict: "id" }
  );
  if (custError) {
    throw new Error(`Kunne ikke upserte kunde: ${custError.message}`);
  }

  // 2. Bestem slug og container-ID
  const baseSlug = slugify(options.name);
  const baseProjectId = `${customerSlug}_${baseSlug}`;

  // 3. Sjekk om prosjektet allerede eksisterer
  const { data: existing } = await db.from("projects")
    .select("id, url_slug")
    .eq("customer_id", customerSlug)
    .eq("url_slug", baseSlug)
    .maybeSingle();

  if (existing) {
    // Hent product-id for eksisterende prosjekt
    const { data: existingProduct } = await db
      .from("products")
      .select("id")
      .eq("project_id", existing.id)
      .eq("product_type", "report")
      .maybeSingle();

    // Oppdater koordinater hvis --update er satt
    if (options.updateCoords) {
      const discoveryRadius = getDiscoveryRadius(options.city, profile);
      await db.from("projects")
        .update({
          center_lat: options.lat,
          center_lng: options.lng,
          discovery_circles: [
            { lat: options.lat, lng: options.lng, radiusMeters: discoveryRadius },
          ],
        })
        .eq("id", existing.id);
      warnings.push(`Koordinater oppdatert: ${options.lat}, ${options.lng}`);
    } else {
      warnings.push(
        `Prosjekt ${existing.id} eksisterer allerede — config-felt som er satt berøres ikke`
      );
    }

    if (existingProduct) {
      return {
        projectId: existing.id,
        productId: existingProduct.id,
        customerSlug,
        slug: baseSlug,
        existed: true,
        warnings,
      };
    }

    // Prosjekt finnes, men mangler report-produkt — opprett det
    const productId = crypto.randomUUID();
    const discoveryRadius = getDiscoveryRadius(options.city, profile);
    const { error: prodError } = await db.from("products").insert({
      id: productId,
      project_id: existing.id,
      product_type: "report",
      story_title: `Nabolaget rundt ${options.name}`,
      config: buildReportConfig(getThemeDefaults(profile), discoveryRadius, options.reportTier),
      version: 1,
    });
    if (prodError) {
      throw new Error(`Kunne ikke opprette rapport-produkt: ${prodError.message}`);
    }
    return {
      projectId: existing.id,
      productId,
      customerSlug,
      slug: baseSlug,
      existed: true,
      warnings,
    };
  }

  // 4. Slug-kollisjon med annet prosjekt hos samme kunde? Legg til suffix.
  let slug = baseSlug;
  let projectId = baseProjectId;

  const { data: conflictingProject } = await db.from("projects")
    .select("id")
    .eq("id", baseProjectId)
    .maybeSingle();

  if (conflictingProject) {
    const suffix = crypto.randomUUID().slice(0, 6);
    slug = `${baseSlug}-${suffix}`;
    projectId = `${customerSlug}_${slug}`;
    warnings.push(
      `Container-ID-kollisjon — bruker suffiks-slug: ${slug}`
    );
  }

  // 5. Opprett prosjekt
  const discoveryRadius = getDiscoveryRadius(options.city, profile);
  const projectInsert = {
    id: projectId,
    customer_id: customerSlug,
    name: options.name,
    url_slug: slug,
    center_lat: options.lat,
    center_lng: options.lng,
    venue_type: (isNaering ? "commercial" : "residential") as
      | "commercial"
      | "residential",
    venue_context: isNaering ? "urban" : "suburban",
    tags: [isNaering ? "Eiendom - Næring" : "Eiendom - Bolig"],
    // 3D er ortogonalt render-flagg fra eksplisitt CLI-input (--addon-3d),
    // IKKE hardkodet + uavhengig av tier (PRD 3 / r03.5 AC2). Default false.
    has_3d_addon: options.has3dAddon ?? false,
    discovery_circles: [
      { lat: options.lat, lng: options.lng, radiusMeters: discoveryRadius },
    ],
    short_id: generateShortId(),
    // v2.projects: version + default_product er NOT NULL uten default (baseline
    // 070:127,134) — sett eksplisitt. default_product=report (pipelinen lager board).
    version: 1,
    default_product: "report",
  };

  const { error: projectError } = await db.from("projects").insert(
    projectInsert
  );
  if (projectError) {
    throw new Error(`Kunne ikke opprette prosjekt: ${projectError.message}`);
  }

  // 6. Opprett rapport-produkt
  const productId = crypto.randomUUID();
  const { error: productError } = await db.from("products").insert({
    id: productId,
    project_id: projectId,
    product_type: "report",
    story_title: `Nabolaget rundt ${options.name}`,
    config: buildReportConfig(getThemeDefaults(profile), discoveryRadius, options.reportTier),
    version: 1,
  });

  if (productError) {
    // Rull tilbake prosjektet
    await db.from("projects").delete().eq("id", projectId);
    throw new Error(`Kunne ikke opprette rapport-produkt: ${productError.message}`);
  }

  return { projectId, productId, customerSlug, slug, existed: false, warnings };
}
