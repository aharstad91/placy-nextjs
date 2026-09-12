/**
 * Fletter Nyhavnas «Leve»-innhold inn i det EKSISTERENDE Nyhavna-boardet.
 *
 * ## Hvorfor fletting og ikke et nytt board
 *
 * Demoens påstand er at kundens eget innhold blir lettere å forstå når det
 * knyttes til stedene i kartet — ikke at vi lager et nytt kart ved siden av.
 * Derfor er dette det samme boardet, med de samme 1 432 punktene, de samme
 * reisetidene og den samme kartmotoren; Nyhavnas tre temaer legger seg FØRST i
 * temaraden, og resten står som før bak dem.
 *
 * ## Hvorfor ingenting skrives til Supabase
 *
 * POI-poolen (`v2.pois`) er DELT mellom alle kunder, og det finnes ingen
 * prosjekt-lokal overstyring av POI-tekst. En demo uten kundebestilling skal
 * ikke legge rader i en produksjonspool for å se bra ut på ett møte. Flettingen
 * skjer derfor i minnet, på vei fra `getCachedReportProduct` til boardet, og
 * den eksisterende demoen på `/rapport-board` er byte-identisk med før.
 *
 * Det har en pris som er verdt å kjenne: demo-POI-ene har ingen precomputede
 * reisetider fra pipelinen, så minuttene på dem er hentet med Mapbox Matrix i
 * `scripts/nyhavna-leve-travel-times.ts` og bakt inn i `travel-times.ts`. De er
 * målte tall, ikke estimater — boardets regel er at et minutt-tall aldri skal
 * gjettes.
 */

import type { Project, ReportThemeConfig } from "@/lib/types";
import { LEVE_CATEGORIES, LEVE_GEOMETRY, LEVE_POIS, LEVE_THEMES } from "./content";
import { LEVE_TRAVEL_TIMES } from "./travel-times";

/** Kunden og prosjektet demoen gjelder. Alt annet avvises av ruta. */
export const LEVE_CUSTOMER = "nyhavna-utvikling";
export const LEVE_PROJECT = "nyhavna";

/**
 * Bygger demo-varianten av prosjektet.
 *
 * Rent: tar et `Project` og gir et nytt, uten å mutere det som kom inn. Det er
 * ikke pedanteri — `getCachedReportProduct` deler objektet via Next-cachen, og
 * en mutasjon her ville lekket inn i `/rapport-board` for neste leser.
 */
export function buildLeveProject(project: Project): Project {
  const leveThemes: ReportThemeConfig[] = LEVE_THEMES.map((t) => ({
    id: t.id,
    name: t.name,
    icon: t.icon,
    color: t.color,
    categories: [t.categoryId],
    leadText: t.leadText,
    editorial: {
      body: t.body,
      // Utvalget er ALLE stedene i temaet — demoen har få nok av dem til at
      // «verdt å merke seg» og «alt vi har» er samme liste. Rekkefølgen er
      // den i innholdsfila, altså kildens egen.
      highlightPoiIds: LEVE_POIS.filter(
        (p) => p.category.id === t.categoryId,
      ).map((p) => p.id),
      source: t.source,
      unplaced: t.ikkePlassert,
    },
  }));

  const levePois = LEVE_POIS.map((p) => {
    const travelTime = LEVE_TRAVEL_TIMES[p.id];
    return travelTime ? { ...p, travelTime } : p;
  });

  return {
    ...project,
    // Nyhavnas egne temaer først. Raden scroller, så de sju generiske står
    // uendret bak dem — poenget er at kundens innhold er overskriften, ikke at
    // nabolaget forsvinner.
    pois: [...levePois, ...project.pois],
    categories: [...LEVE_CATEGORIES, ...project.categories],
    reportConfig: {
      ...project.reportConfig,
      themes: [...leveThemes, ...(project.reportConfig?.themes ?? [])],
      curatedGeometry: LEVE_GEOMETRY,
      // Boardet har ingen `district`, så områdestoppet het «Nabolaget». Bydelen
      // er ordet Nyhavna selv bruker om seg, og det er ordet som skal stå.
      district: project.reportConfig?.district ?? "Nyhavna",
      city: project.reportConfig?.city ?? "Trondheim",
      // Demoen er ikke en boligannonse — megler-plassholderen hører ikke hjemme
      // på et områdekart for en utbygger.
      hideBrokerCard: true,
    },
  };
}
