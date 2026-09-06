import type { Portfolio } from "@/lib/portfolio/types";

/**
 * HEM (Heimdal Eiendomsmegling) — kjedens nybyggprosjekter per 2026-09-02.
 *
 * Håndskrevet, ikke en feed: femten-seksten rader lagt inn én gang før et møte
 * trenger ingen tabell og ingen migrasjon (samme presedens som
 * `board-establishing-shots.ts`). En automatisk prosjekt-feed hører til det
 * nasjonale felleskartet, som er utenfor denne flatens scope.
 *
 * Kildene er kjedens egne prosjektsider (prosjekt.hem.no, hem.no/nybygg og
 * prosjektenes egne domener). Koordinatene er hentet fra prosjektsidenes egne
 * kartpinner der de finnes, ellers geokodet fra oppgitt adresse, og deretter
 * reverse-geokodet for å bekrefte kommunen.
 *
 * To pinner er OMRÅDE-punkt, ikke byggpunkt, og bør ses over visuelt før de
 * vises fram: Gimsøya (planområdet er flere hundre meter bredt) og Solbergåsen
 * (prosjektsidens pinne er lagret på grov zoom).
 *
 * `developer` står som "ukjent" der ingen kilde oppgir utbygger. Den skal ikke
 * gjettes — feil utbygger foran en megler er verre enn ingen utbygger.
 */
export const HEM_PORTFOLIO: Portfolio = {
  slug: "hem",
  name: "HEM",
  projects: [
    {
      id: "berg-hageby",
      name: "Berg Hageby",
      lat: 63.41784,
      lng: 10.427406,
      subtitle: "Trondheim, Berg",
      chain: "HEM",
      developer: "Farga AS",
    },
    {
      id: "edoya-paradis",
      name: "Edøya Paradis",
      lat: 63.305994,
      lng: 8.175235,
      subtitle: "Smøla, Edøya",
      chain: "HEM",
      developer: "ukjent",
    },
    {
      id: "gimsoya",
      name: "Gimsøya",
      lat: 63.289471,
      lng: 10.266867,
      subtitle: "Melhus, Gimsøya",
      chain: "HEM",
      developer: "Boligbyggelaget TOBB",
    },
    {
      id: "leangen-stasjonsby",
      name: "Leangen Stasjonsby",
      lat: 63.439289,
      lng: 10.460711,
      subtitle: "Trondheim, Leangen",
      chain: "HEM",
      developer: "Frost Eiendom",
    },
    {
      id: "lundamo-park",
      name: "Lundamo Park",
      lat: 63.152473,
      lng: 10.293514,
      subtitle: "Melhus, Lundamo",
      chain: "HEM",
      developer: "ukjent",
    },
    {
      id: "melhustorget",
      name: "Melhustorget",
      lat: 63.28665,
      lng: 10.27878,
      subtitle: "Melhus sentrum",
      chain: "HEM",
      developer: "Heimdal Bolig",
    },
    {
      id: "ole-brumms-hage",
      name: "Ole Brumms Hage",
      lat: 63.284281,
      lng: 10.285656,
      subtitle: "Melhus, Lena",
      chain: "HEM",
      developer: "ukjent",
    },
    {
      id: "saga-park",
      name: "Saga Park",
      lat: 63.355061,
      lng: 10.361349,
      subtitle: "Trondheim sør, Heimdal",
      chain: "HEM",
      developer: "Heimdal Sag Gruppen og Byggteknikk Utvikling",
    },
    {
      id: "solbergasen",
      name: "Solbergåsen",
      lat: 63.35205,
      lng: 10.31034,
      subtitle: "Trondheim, Ringvål",
      chain: "HEM",
      developer: "Heimdal Bolig",
    },
    {
      id: "sollia-melhus-vest",
      name: "Sollia - Melhus Vest",
      lat: 63.275654,
      lng: 10.251293,
      subtitle: "Melhus vest",
      chain: "HEM",
      developer: "ukjent",
    },
    {
      id: "solsletta-hageby",
      name: "Solsletta Hageby",
      lat: 63.41426,
      lng: 10.473516,
      subtitle: "Trondheim øst",
      chain: "HEM",
      developer: "ukjent",
    },
    {
      id: "sundsoya",
      name: "Sundsøya",
      lat: 63.865218,
      lng: 11.303152,
      subtitle: "Inderøy",
      chain: "HEM",
      developer: "ukjent",
      board: { customerId: "placy-demo", slug: "sundsoya" },
    },
    {
      id: "svaberget",
      name: "Svaberget",
      lat: 63.922379,
      lng: 11.210544,
      subtitle: "Inderøy, Kjerknesvågen",
      chain: "HEM",
      developer: "ukjent",
    },
    {
      id: "veiholmen-panorama",
      name: "Veiholmen Panorama",
      lat: 63.511089,
      lng: 7.962738,
      subtitle: "Smøla, Veiholmen",
      chain: "HEM",
      developer: "ukjent",
    },
    {
      id: "wesselslokka",
      name: "Wesselsløkka",
      lat: 63.422074,
      lng: 10.450617,
      subtitle: "Trondheim, Brøset",
      chain: "HEM",
      developer: "Brøset Utvikling / Heimdal Bolig",
      board: { customerId: "broset-utvikling-as", slug: "wesselslokka" },
    },
    {
      id: "arnestunet",
      name: "Årnestunet",
      lat: 63.960415,
      lng: 10.223527,
      subtitle: "Åfjord, Årnes",
      chain: "HEM",
      developer: "ukjent",
    },
  ],
};
