import type { Coordinates } from "@/lib/types";

/**
 * Demoens faste ankerpunkt.
 *
 * Midtbyen-katalogen har ingen «hjem» slik en boligrapport har — den er en
 * katalog, ikke en eiendom. Men hele nivå-1-flaten måler fra ett punkt:
 * gangtidene i sheeten, sorteringen av lista og kartets startutsnitt. Uten et
 * anker faller lista tilbake til inndata-rekkefølgen (alfabetisk), som ser ut
 * som en feil.
 *
 * Torvet er valgt fordi det er Midtbyens faktiske midtpunkt og fordi «ti
 * minutter fra Torvet» er en strekning enhver i Trondheim kan bedømme selv.
 *
 * Koordinatet er slått opp mot Google Places 2026-08-06 («Torvet, Trondheim»,
 * `ChIJ_____poxbUYR67tHXH9Q2_Y`).
 */
export const TORVET: Coordinates = { lat: 63.43032, lng: 10.39492 };

/**
 * Hvor langt fra Torvet en oppføring kan ligge og fortsatt være «Midtbyen».
 *
 * Brukes som treffkontroll når en butikk mangler koordinat og må stedfestes med
 * et navnesøk: uten den ville «Shine» eller «Transit» kunnet matche en butikk
 * med samme navn i en annen by. Alle 138 oppføringene med kjent koordinat
 * ligger godt innenfor.
 */
export const MIDTBYEN_RADIUS_METERS = 1500;
