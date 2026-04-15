import type { POI, Category } from "@/lib/types";

/**
 * Pilotkonfig for Wesselsløkka-rapportens 3D-kart.
 * Kamera er låst over fast senter; kun heading kan endres.
 * POIer er dummy-data for MVP — erstattes med ekte rapport-data i fase 2.
 */

/** Fast kamera-senter og lås-bounds rundt Wesselsløkka. */
export const WESSELSLOKKA_CENTER = {
  lat: 63.42,
  lng: 10.463,
  altitude: 0,
};

/**
 * Deklarative lås-grenser for Map3D-props.
 * Ingen native minRange/maxRange → range lås via snap-back event-listener.
 */
export const WESSELSLOKKA_CAMERA_LOCK = {
  // range = avstand fra kamera til center (meter)
  range: 900,
  // tilt konvensjon: 0° = rett ned, 90° = horisontal. 45° = bird's eye.
  tilt: 45,
  // Bounds holder center-panoreringen stramt rundt center — snap-back catches det som slipper gjennom.
  bounds: {
    south: 63.4195,
    north: 63.4205,
    west: 10.4625,
    east: 10.4635,
  },
} as const;

/** Rapportens tab-kategorier (i visningsrekkefølge). */
export const WESSELSLOKKA_TAB_IDS = [
  "alle",
  "oppvekst",
  "mat",
  "natur",
  "transport",
  "trening",
] as const;

export type WesselslokkaTabId = (typeof WESSELSLOKKA_TAB_IDS)[number];

export const WESSELSLOKKA_TAB_LABELS: Record<WesselslokkaTabId, string> = {
  alle: "Alle",
  oppvekst: "Oppvekst",
  mat: "Mat & Drikke",
  natur: "Natur",
  transport: "Transport",
  trening: "Trening",
};

/** Category-definisjoner — delt mellom POI-objektet og tab-filter. */
const CAT_OPPVEKST: Category = {
  id: "oppvekst",
  name: "Oppvekst",
  icon: "GraduationCap",
  color: "#3b82f6",
};
const CAT_MAT: Category = {
  id: "mat",
  name: "Mat & Drikke",
  icon: "UtensilsCrossed",
  color: "#f59e0b",
};
const CAT_NATUR: Category = {
  id: "natur",
  name: "Natur",
  icon: "TreePine",
  color: "#10b981",
};
const CAT_TRANSPORT: Category = {
  id: "transport",
  name: "Transport",
  icon: "Bus",
  color: "#8b5cf6",
};
const CAT_TRENING: Category = {
  id: "trening",
  name: "Trening",
  icon: "Dumbbell",
  color: "#ef4444",
};

/**
 * 15 dummy-POIer spredt rundt Wesselsløkka (~500-800m radius).
 * Navn er realistiske for området; lat/lng er tilnærminger.
 */
export const WESSELSLOKKA_POIS: POI[] = [
  // — Oppvekst (4) —
  {
    id: "wl-oppv-1",
    name: "Strindheim skole",
    coordinates: { lat: 63.423, lng: 10.469 },
    category: CAT_OPPVEKST,
    description: "Barneskole 1.–7. trinn, ca 450 elever.",
  },
  {
    id: "wl-oppv-2",
    name: "Brøset barnehage",
    coordinates: { lat: 63.418, lng: 10.458 },
    category: CAT_OPPVEKST,
    description: "Kommunal barnehage med utegruppe.",
  },
  {
    id: "wl-oppv-3",
    name: "Strinda videregående",
    coordinates: { lat: 63.425, lng: 10.465 },
    category: CAT_OPPVEKST,
    description: "Studiespesialisering og idrettslinje.",
  },
  {
    id: "wl-oppv-4",
    name: "Nidelven lekeplass",
    coordinates: { lat: 63.417, lng: 10.466 },
    category: CAT_OPPVEKST,
    description: "Nyoppusset lekeplass med sandkasse og klatretårn.",
  },

  // — Mat & Drikke (3) —
  {
    id: "wl-mat-1",
    name: "Bakklandet Bakeri",
    coordinates: { lat: 63.419, lng: 10.461 },
    category: CAT_MAT,
    description: "Håndverksbakeri med surdeigsbrød og kanelbolle.",
    googleRating: 4.6,
    googleReviewCount: 312,
  },
  {
    id: "wl-mat-2",
    name: "Café Løkka",
    coordinates: { lat: 63.421, lng: 10.462 },
    category: CAT_MAT,
    description: "Nabolagscafé med brunsj og lunsjmeny.",
    googleRating: 4.4,
    googleReviewCount: 187,
  },
  {
    id: "wl-mat-3",
    name: "Trattoria Strinda",
    coordinates: { lat: 63.422, lng: 10.467 },
    category: CAT_MAT,
    description: "Italiensk pizzeria med steinovn.",
    googleRating: 4.5,
    googleReviewCount: 421,
  },

  // — Natur (3) —
  {
    id: "wl-natur-1",
    name: "Brøsetmarka",
    coordinates: { lat: 63.416, lng: 10.455 },
    category: CAT_NATUR,
    description: "Skogsområde med tursti og lysløype.",
  },
  {
    id: "wl-natur-2",
    name: "Ladestien",
    coordinates: { lat: 63.427, lng: 10.47 },
    category: CAT_NATUR,
    description: "Kyststi langs Trondheimsfjorden.",
  },
  {
    id: "wl-natur-3",
    name: "Leangen park",
    coordinates: { lat: 63.423, lng: 10.457 },
    category: CAT_NATUR,
    description: "Bydelspark med benker og lekeområde.",
  },

  // — Transport (3) —
  {
    id: "wl-trans-1",
    name: "Strindheim holdeplass",
    coordinates: { lat: 63.421, lng: 10.465 },
    category: CAT_TRANSPORT,
    description: "Rute 3, 6, 22 mot sentrum.",
  },
  {
    id: "wl-trans-2",
    name: "Lademoen stasjon",
    coordinates: { lat: 63.432, lng: 10.435 },
    category: CAT_TRANSPORT,
    description: "Lokaltog mot Trondheim S.",
  },
  {
    id: "wl-trans-3",
    name: "Bysykkel — Brøset",
    coordinates: { lat: 63.42, lng: 10.46 },
    category: CAT_TRANSPORT,
    description: "10 låseplasser.",
  },

  // — Trening (2) —
  {
    id: "wl-tren-1",
    name: "Sats Strindheim",
    coordinates: { lat: 63.424, lng: 10.468 },
    category: CAT_TRENING,
    description: "Treningssenter med gruppetimer.",
  },
  {
    id: "wl-tren-2",
    name: "Brøset utetreningspark",
    coordinates: { lat: 63.418, lng: 10.452 },
    category: CAT_TRENING,
    description: "Utendørs apparatpark, åpent hele døgnet.",
  },
];

/** Filtrér POIer basert på aktiv tab. */
export function filterPoisByTab(
  pois: POI[],
  tabId: WesselslokkaTabId,
): POI[] {
  if (tabId === "alle") return pois;
  return pois.filter((poi) => poi.category.id === tabId);
}
