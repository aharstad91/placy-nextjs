/**
 * Curated list definitions for /[area]/guide/[slug] pages.
 * Each list defines a filter + editorial content for SEO-optimized pages.
 */

export interface CuratedList {
  slug: string;
  titleNo: string;
  titleEn: string;
  descriptionNo: string;
  descriptionEn: string;
  introNo: string;
  introEn: string;
  /** Category ID to filter by, or null for cross-category */
  categoryId: string | null;
  /** Only include tier 1 POIs */
  tierFilter?: 1;
  /** Bounding box filter [south, west, north, east] */
  bbox?: [number, number, number, number];
  /** Maximum POIs to show */
  limit?: number;
}

/**
 * Curated lists per area.
 * Key is area ID (e.g. "trondheim").
 */
export const CURATED_LISTS: Record<string, CuratedList[]> = {
  trondheim: [
    {
      slug: "beste-restauranter",
      titleNo: "Beste restauranter i Trondheim",
      titleEn: "Best Restaurants in Trondheim",
      descriptionNo:
        "Vår kuraterte guide til de beste restaurantene i Trondheim — fra Michelin-stjerner til lokale favoritter.",
      descriptionEn:
        "Our curated guide to the best restaurants in Trondheim — from Michelin stars to local favourites.",
      introNo:
        "Trondheim har et av Norges mest spennende matscener. Speilsalen på Britannia Hotel holder Michelin-stjerne, mens restauranter som Credo, Fagn og To Rom og Kjøkken har satt byen på kartet internasjonalt. Men det er i nabolagsrestaurantene — langs Bakklandet, på Solsiden og i sentrum — at du finner den daglige matgleden. Her er vårt utvalg av de aller beste.",
      introEn:
        "Trondheim has one of Norway's most exciting food scenes. Speilsalen at Britannia Hotel holds a Michelin star, while restaurants like Credo, Fagn and To Rom og Kjøkken have put the city on the international map. But it's in the neighbourhood restaurants — along Bakklandet, at Solsiden and downtown — that you'll find everyday food joy. Here's our selection of the very best.",
      categoryId: "restaurant",
      tierFilter: 1,
      limit: 20,
    },
    {
      slug: "badeplasser",
      titleNo: "Badeplasser i Trondheim",
      titleEn: "Swimming Spots in Trondheim",
      descriptionNo:
        "Komplett guide til badeplasser i Trondheim — strender, sjøbad og ferskvannsbading.",
      descriptionEn:
        "Complete guide to swimming spots in Trondheim — beaches, sea baths and freshwater swimming.",
      introNo:
        "Trondheim byr på overraskende mange flotte badeplasser. Korsvika er byens mest populære strand med sandstrand og grunt vann for barn. Sjøbadet på Lade er et historisk sjøbad som ble gjenåpnet i 2018, mens Munkholmen — den lille øya midt i fjorden — er en klassiker for en sommerdag. For ferskvannsbading er Lianvatnet i Bymarka et populært valg. Her er alle badeplassene vi har kartlagt.",
      introEn:
        "Trondheim offers surprisingly many great swimming spots. Korsvika is the city's most popular beach with sandy shores and shallow water for kids. Sjøbadet at Lade is a historic sea bath reopened in 2018, while Munkholmen — the little island in the fjord — is a classic for summer days. For freshwater swimming, Lianvatnet in Bymarka is popular. Here are all the swimming spots we've mapped.",
      categoryId: "badeplass",
    },
    {
      slug: "bakklandet",
      titleNo: "Bakklandet — Kaféer, restauranter og barer",
      titleEn: "Bakklandet — Cafés, Restaurants and Bars",
      descriptionNo:
        "Guide til Bakklandet i Trondheim — sjarmerende trehusstrøk med kaféer, restauranter og barer.",
      descriptionEn:
        "Guide to Bakklandet in Trondheim — charming wooden house district with cafés, restaurants and bars.",
      introNo:
        "Bakklandet er Trondheims mest sjarmerende nabolag — et idyllisk trehusstrøk langs Nidelva med brosteinsgate, fargerike hus og en tett konsentrasjon av kaféer, restauranter og småbutikker. Baklandet Skydsstation ble kåret til årets kafé av National Geographic, og området er et must for enhver besøkende. Her er alle stedene vi anbefaler på Bakklandet.",
      introEn:
        "Bakklandet is Trondheim's most charming neighbourhood — an idyllic wooden house district along the Nidelva river with cobblestone streets, colourful houses and a dense concentration of cafés, restaurants and small shops. Baklandet Skydsstation was named café of the year by National Geographic, and the area is a must for any visitor. Here are all the places we recommend in Bakklandet.",
      categoryId: null,
      // Bakklandet approximate bounding box
      bbox: [63.4270, 10.3970, 63.4330, 10.4100],
    },
  ],
};

export function getCuratedListsForArea(areaId: string): CuratedList[] {
  return CURATED_LISTS[areaId] ?? [];
}

export function getCuratedListBySlug(
  areaId: string,
  slug: string
): CuratedList | null {
  return CURATED_LISTS[areaId]?.find((l) => l.slug === slug) ?? null;
}
