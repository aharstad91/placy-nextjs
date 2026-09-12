/**
 * Kildene demoen bygger på — Nyhavna Utviklings egne «Leve»-sider.
 *
 * HVORFOR EN EGEN FIL: hver påstand i demoen skal kunne følges tilbake til
 * siden den står på, og lenken skal være den SPESIFIKKE siden, ikke forsiden.
 * Ligger URL-ene spredt i innholdsfila, drifter de fra hverandre i det øyeblikk
 * noen retter én av dem.
 *
 * Hentet 2026-09-11. Sidene er Nyhavna Utviklings, og demoen gjengir deres ord
 * som sitat eller tett sammendrag med synlig kildehenvisning — den erstatter
 * dem ikke.
 */

import type { EditorialSource } from "@/lib/types";

export const NYHAVNA_LEVE: EditorialSource = {
  label: "nyhavna.no",
  url: "https://nyhavna.no/leve/",
  page: "Opplev Nyhavna",
};

export const NYHAVNA_SERVERING: EditorialSource = {
  label: "nyhavna.no",
  url: "https://nyhavna.no/leve/cafe-og-restauranter/",
  page: "Café og restauranter",
};

export const NYHAVNA_PARK: EditorialSource = {
  label: "nyhavna.no",
  url: "https://nyhavna.no/leve/park-og-promenade/",
  page: "Park og promenade",
};

export const NYHAVNA_KULTUR: EditorialSource = {
  label: "nyhavna.no",
  url: "https://nyhavna.no/leve/kunst-og-kultur/",
  page: "Kunst og kultur",
};

/** Datoen sidene ble lest. Vises i demoens kildefotnote. */
export const HENTET_DATO = "11. september 2026";
