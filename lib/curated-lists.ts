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
  /** Multiple category IDs to filter by (takes precedence over categoryId) */
  categoryIds?: string[];
  /** Only include tier 1 POIs */
  tierFilter?: 1;
  /** Bounding box filter [south, west, north, east] */
  bbox?: [number, number, number, number];
  /** Maximum POIs to show */
  limit?: number;
  /** English slug for /en/ routes (defaults to slug if not set) */
  slugEn?: string;
}

/**
 * Curated lists per area.
 * Key is area ID (e.g. "trondheim").
 */
export const CURATED_LISTS: Record<string, CuratedList[]> = {
  trondheim: [
    {
      slug: "beste-restauranter",
      slugEn: "best-restaurants",
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
      slugEn: "swimming-spots",
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
      slugEn: "bakklandet",
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
    {
      slug: "historisk-byvandring",
      slugEn: "historic-city-walk",
      titleNo: "Historisk byvandring i Trondheim",
      titleEn: "Historic City Walk in Trondheim",
      descriptionNo:
        "Vandre gjennom 1000 år med historie — fra Nidarosdomen til Kristiansten festning og Bakklandet.",
      descriptionEn:
        "Walk through 1,000 years of history — from Nidaros Cathedral to Kristiansten Fortress and Bakklandet.",
      introNo:
        "Trondheim ble grunnlagt av Olav Tryggvason i 997 og var Norges første hovedstad. Byen er rik på historie som strekker seg fra vikingtid til moderne tid. Nidarosdomen er Nordens største middelalderkatedral og et nasjonalt pilegrimsmål. Erkebispegården ved siden av er Skandinavias eldste verdslige bygning. Gamle Bybro, Kristiansten festning og de fargerike sjøhusene langs Nidelva forteller historien om en by som har vært sentrum for religion, handel og forsvar i over tusen år. Denne vandringen tar deg gjennom de viktigste historiske stedene.",
      introEn:
        "Trondheim was founded by Olav Tryggvason in 997 and served as Norway's first capital. The city is rich in history spanning from the Viking age to modern times. Nidaros Cathedral is the largest medieval cathedral in Scandinavia and a national pilgrimage site. The Archbishop's Palace next door is Scandinavia's oldest secular building. The Old Town Bridge, Kristiansten Fortress and the colourful warehouses along the Nidelva river tell the story of a city that has been a centre for religion, trade and defence for over a thousand years. This walk takes you through the most important historic sites.",
      categoryIds: ["sightseeing", "museum"],
      categoryId: null,
      limit: 30,
    },
    {
      slug: "smak-trondheim",
      slugEn: "taste-trondheim",
      titleNo: "Smak Trondheim — Mat og drikke",
      titleEn: "Taste Trondheim — Food and Drink",
      descriptionNo:
        "Fra Michelin-restauranter til bakgårdskaféer — den komplette matguiden til Trondheim.",
      descriptionEn:
        "From Michelin restaurants to backyard cafés — the complete food guide to Trondheim.",
      introNo:
        "Trondheim er en av Norges fremste matbyer. Byen huser Speilsalen med Michelin-stjerne, Credo som ble kåret til verdens mest bærekraftige restaurant, og Fagn med sin nyskapende nordiske meny. Men matscenen handler om mye mer enn fine dining. Baklandet byr på atmosfæriske kaféer i historiske trehus, Solsiden har blitt et restaurantmekka langs fjorden, og sentrum gjemmer alt fra håndverksbakerier til cocktailbarer. Denne guiden samler våre favoritter — fra det eksklusive til det hverdagslige.",
      introEn:
        "Trondheim is one of Norway's foremost food cities. The city is home to Michelin-starred Speilsalen, Credo which was named the world's most sustainable restaurant, and Fagn with its innovative Nordic menu. But the food scene is about much more than fine dining. Bakklandet offers atmospheric cafés in historic wooden houses, Solsiden has become a restaurant mecca along the fjord, and the city centre hides everything from artisan bakeries to cocktail bars. This guide gathers our favourites — from the exclusive to the everyday.",
      categoryIds: ["restaurant", "cafe", "bakery", "bar"],
      categoryId: null,
      tierFilter: 1,
      limit: 30,
    },
    {
      slug: "familievennlig",
      slugEn: "family-friendly",
      titleNo: "Familievennlig Trondheim",
      titleEn: "Family-Friendly Trondheim",
      descriptionNo:
        "De beste stedene for barn og familier — lekeplasser, museer, parker og badeplasser.",
      descriptionEn:
        "The best places for kids and families — playgrounds, museums, parks and swimming spots.",
      introNo:
        "Trondheim er en fantastisk by for familier. Vitensenteret lar barna eksperimentere og lære gjennom lek, Rockheim byr på interaktiv musikkhistorie, og Ringve Museum har en magisk musikksamling i vakre omgivelser. For utendørsaktiviteter finnes det flotte lekeplasser som Ilaparken og Marienborg, parker langs Nidelva, og badeplasser som Korsvika og Sjøbadet. Bymarka like utenfor sentrum gir enkel tilgang til naturen. Her er våre beste tips for familier.",
      introEn:
        "Trondheim is a fantastic city for families. The Science Centre lets kids experiment and learn through play, Rockheim offers interactive music history, and Ringve Museum has a magical music collection in beautiful surroundings. For outdoor activities there are great playgrounds like Ilaparken and Marienborg, parks along the Nidelva river, and swimming spots like Korsvika and Sjøbadet. Bymarka just outside the centre provides easy access to nature. Here are our best tips for families.",
      categoryIds: ["lekeplass", "museum", "park", "badeplass"],
      categoryId: null,
      limit: 30,
    },
    {
      slug: "uteservering-og-uteliv",
      slugEn: "outdoor-dining-and-nightlife",
      titleNo: "Uteservering og uteliv i Trondheim",
      titleEn: "Outdoor Dining and Nightlife in Trondheim",
      descriptionNo:
        "De beste barene og restaurantene med uteservering — fra solrike terrasser til livlige kveldssteder.",
      descriptionEn:
        "The best bars and restaurants with outdoor seating — from sunny terraces to lively evening spots.",
      introNo:
        "Når sola skinner over Trondheim, våkner uteserveringene til liv. Solsiden lever opp til navnet sitt med restauranter og barer rett ved fjorden. Bakklandet byr på sjarmerende bakgårder og fortauskafeer mellom trehusene. Nedre Elvehavn har blitt byens hotteste kveldsområde med cocktailbarer og nattklubb. For den som vil oppleve Trondheims sosiale side — enten med en lunsj i sola eller en sen kveld — er dette guiden å følge.",
      introEn:
        "When the sun shines over Trondheim, the outdoor terraces come alive. Solsiden lives up to its name with restaurants and bars right by the fjord. Bakklandet offers charming courtyards and pavement cafés between the wooden houses. Nedre Elvehavn has become the city's hottest evening area with cocktail bars and nightclubs. For those wanting to experience Trondheim's social side — whether with a sunny lunch or a late night out — this is the guide to follow.",
      categoryIds: ["bar", "restaurant"],
      categoryId: null,
      tierFilter: 1,
      limit: 25,
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

export function getCuratedListBySlugEn(
  areaId: string,
  slug: string
): CuratedList | null {
  return CURATED_LISTS[areaId]?.find((l) => (l.slugEn ?? l.slug) === slug) ?? null;
}
