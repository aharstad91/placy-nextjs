/** Registration of the supplied 1600 × 1000 Wesselsløkka situation plan.
 * Control points were read from north-up satellite imagery. Source pixels
 * keep buildings and streets aligned independently of the address pin.
 */
type Point = readonly [number, number];

export const WESSELSLOKKA_CONTROL_POINTS = [
  { name: "Brøsetvegen / Sigurd Munns veg", pixel: [111, 768], coordinate: [10.4496894971, 63.4218342068] },
  { name: "Brøsetvegen ved nordspissen av feltet", pixel: [858, 54], coordinate: [10.4567706734, 63.4244368447] },
  { name: "Rundkjøring Tungasletta", pixel: [1350, 770], coordinate: [10.4607323086, 63.4215660552] },
] as const;

// Affine registration; projection differences are below image precision here.
export function sitePlanCoordinate([x, y]: Point): [number, number] {
  const [a, b, c] = WESSELSLOKKA_CONTROL_POINTS;
  const bx = b.pixel[0] - a.pixel[0];
  const by = b.pixel[1] - a.pixel[1];
  const cx = c.pixel[0] - a.pixel[0];
  const cy = c.pixel[1] - a.pixel[1];
  const determinant = bx * cy - by * cx;
  const u = ((x - a.pixel[0]) * cy - (y - a.pixel[1]) * cx) / determinant;
  const v = (bx * (y - a.pixel[1]) - by * (x - a.pixel[0])) / determinant;
  return [
    a.coordinate[0] + u * (b.coordinate[0] - a.coordinate[0]) + v * (c.coordinate[0] - a.coordinate[0]),
    a.coordinate[1] + u * (b.coordinate[1] - a.coordinate[1]) + v * (c.coordinate[1] - a.coordinate[1]),
  ];
}

/**
 * To uavhengige holdepunkter som ikke inngår i tilpasningen, og som derfor kan
 * felle registreringen hvis noen flytter på et kontrollpunkt:
 *
 * 1. Planens søndre kollektivgate faller sammen med Brøsetjordet slik OSM
 *    tegner den (way 1502590316). Sjekkpunktene under er avlest fra den.
 * 2. OSM har allerede et grovt plassholder-omriss for prosjektet
 *    (way 1502590318, `building=construction` + `construction=apartments`,
 *    merket «very approximate position / size»). A1/A2/B lander oppå det.
 *
 * Begge er bildeuavhengige kilder. Registreringen er en innpassing, ikke en
 * oppmåling — vi holder den innenfor ~15 m, ikke bedre.
 */
export const WESSELSLOKKA_REGISTRATION_CHECKS = [
  { name: "Brøsetjordet vest", pixel: [110, 788], coordinate: [10.449732, 63.421765], toleranceMeters: 15 },
  { name: "Brøsetjordet ved feltet", pixel: [350, 890], coordinate: [10.451748, 63.421270], toleranceMeters: 15 },
  { name: "OSM-plassholder for prosjektet", pixel: [430, 830], coordinate: [10.452544, 63.421517], toleranceMeters: 25 },
] as const;

/**
 * Main envelopes, omitting small facade recesses and balconies.
 *
 * `storeys` står ikke i situasjonsplanen. Wesselsløkka (BS3) selges som to bygg
 * på fem og sju etasjer med 122 leiligheter, der hus B alene er 51 — A1 og A2
 * er to seksjoner av femetasjeren. Kontekstbyggene rundt henter etasjetallet
 * sitt maskinelt fra takplanen i stedet, se broset-plan-buildings.generated.ts.
 */
export const WESSELSLOKKA_PLAN_BUILDINGS = [
  { id: "a1", name: "Bygg A1", label: "A1", storeys: 5, pixels: [[350, 837], [407, 842], [404, 875], [347, 870]] },
  { id: "a2", name: "Bygg A2", label: "A2", storeys: 5, pixels: [[409, 843], [487, 850], [484, 881], [406, 875]] },
  { id: "b", name: "Bygg B", label: "B", storeys: 7, pixels: [[458, 757], [507, 761], [499, 844], [450, 840]] },
] as const;

/**
 * Bygg som står på tomta i dag, og som stikker opp gjennom grunnflaten.
 *
 * Grunnflaten dekker asfalten, men den drapereres på terrenget — alt som er
 * høyere enn bakken blir stående. Låven er det eneste som faktisk synes:
 * et langt, grått tak midt i tregruppa, som leser som rot mellom rene volumer.
 *
 * Planen river den ikke. Situasjonsplanen tegner den mørkerød, som er måten
 * den sier «dette bygget blir stående». OSM-omrisset (way 101106919,
 * `ref:bygningsnr` 182222860) lander på plan-piksel (720, 593), fem meter fra
 * den mørkerøde flaten på (732, 602). Derfor får den et volum på linje med de
 * planlagte byggene i stedet for å bli malt bort.
 *
 * Den andre eksisterende bygningen på feltet (way 101106926, en liten
 * driftsbygning på 8 × 9 m) har ingen mørkerød flate nærmere enn 33 m — planen
 * river den. Den ligger under tretakket og er ikke synlig i fotoflisene, så
 * den står ikke her. Dukker den opp, hører den hjemme i denne lista med et
 * volum i jordets farge.
 *
 * Omrisset er utvidet tre og en halv meter fra sitt eget tyngdepunkt. Halvannen
 * var for lite — den røde gavlen i østenden stakk ut forbi volumet. Høyden er
 * lest av fotoflisene mot treetasjes-blokkene ved siden av; det finnes ingen
 * kilde å slå den opp i, og elleve meter dekker mønet med litt å gå på.
 */
export const WESSELSLOKKA_STANDING_BUILDINGS = [
  {
    id: "laven",
    name: "Låven",
    heightMeters: 11,
    footprint: [
      [10.455073, 63.422462],
      [10.455003, 63.422441],
      [10.455367, 63.422142],
      [10.455554, 63.422184],
      [10.455407, 63.422347],
      [10.455401, 63.422345],
      [10.455214, 63.422493],
      [10.455137, 63.422478],
      [10.455122, 63.422491],
      [10.45506, 63.422477],
    ],
  },
] as const;
