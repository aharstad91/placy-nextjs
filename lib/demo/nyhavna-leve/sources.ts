/**
 * Kildene demoen bygger på — Nyhavna Utviklings egne «Leve»-sider.
 *
 * HVORFOR EN EGEN FIL: hver påstand i demoen skal kunne følges tilbake til
 * siden den står på, og lenken skal være den SPESIFIKKE siden, ikke forsiden.
 * Ligger URL-ene spredt i innholdsfila, drifter de fra hverandre i det øyeblikk
 * noen retter én av dem.
 *
 * Kontrollert på nytt 2026-09-12. Sidene er Nyhavna Utviklings, og demoen
 * bruker korte sammendrag med synlig kildehenvisning.
 */

import type { EditorialSource } from "@/lib/types";

export const NYHAVNA_LEVE: EditorialSource = {
  label: "nyhavna.no",
  url: "https://nyhavna.no/leve/",
  page: "Opplev Nyhavna",
};

/** Stabile ID-er brukt av kunnskapsmanifestets feltvise kildehenvisninger. */
export const NYHAVNA_SOURCE_IDS = {
  leve: "nyhavna-leve",
  servering: "nyhavna-servering",
  park: "nyhavna-park-promenade",
  kultur: "nyhavna-kunst-kultur",
} as const;

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
export const HENTET_DATO = "12. september 2026";
export const HENTET_DATO_ISO = "2026-09-12";
