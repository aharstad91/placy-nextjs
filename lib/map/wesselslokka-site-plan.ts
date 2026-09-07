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

// Main envelopes, omitting small facade recesses and balconies.
export const WESSELSLOKKA_PLAN_BUILDINGS = [
  { id: "a1", name: "Bygg A1", pixels: [[350, 837], [407, 842], [404, 875], [347, 870]] },
  { id: "a2", name: "Bygg A2", pixels: [[409, 843], [487, 850], [484, 881], [406, 875]] },
  { id: "b", name: "Bygg B", pixels: [[458, 757], [507, 761], [499, 844], [450, 840]] },
] as const;

// Local section from Brøsetvegen to the east edge of this test site.
export const WESSELSLOKKA_PLAN_STREET: readonly Point[] = [
  [110, 788], [136, 815], [172, 840], [223, 861], [282, 879], [350, 890],
  [420, 897], [488, 893], [544, 878], [600, 854],
  [611, 875], [552, 900], [495, 917], [422, 921], [345, 914],
  [274, 903], [215, 885], [163, 865], [125, 839], [94, 803],
];
