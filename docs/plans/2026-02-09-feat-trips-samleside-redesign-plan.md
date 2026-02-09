# Plan: Trips-samleside redesign (Apple Store-inspirert)

**Brainstorm:** `docs/brainstorms/2026-02-09-trips-samleside-redesign-brainstorm.md`
**Beslutninger:** Dummy-data i frontend for design-prototyping, scroll-til-seksjon for kategori-kort

---

## Oversikt

Redesigne trips-samlesiden (`TripLibraryClient.tsx`) med Apple Store-inspirert layout:
1. Kategori-kort i toppen (gjenbruk Report-design)
2. Featured trips-seksjon med store kort
3. Kategorirader med oppgraderte kort
4. Dummy trip-data direkte i klienten for å fylle ut visningen

## Endrede filer

| Fil | Endring |
|-----|---------|
| `app/[customer]/[project]/trips/TripLibraryClient.tsx` | Full redesign — ny layout, dummy-data, nye komponenter |

Ingen andre filer endres. Alt skjer i klient-komponenten.

---

## Steg

### 1. Legg til dummy trip-data

Legg til en `DUMMY_TRIPS`-array i `TripLibraryClient.tsx` med 5-6 trips:

```ts
const DUMMY_TRIPS: DummyTrip[] = [
  { id: "dummy-bakklandet", title: "Bakklandet & Bryggene", category: "culture", difficulty: "easy", stopCount: 5, durationMinutes: 35, description: "Historisk vandring langs Nidelva, gjennom Bakklandet og forbi bryggerekkene", featured: true },
  { id: "dummy-coffee", title: "Best of Coffee", category: "food", difficulty: "easy", stopCount: 4, durationMinutes: 60, description: "Trondheims beste kaffebarer — fra spesialbrent til klassisk", featured: true },
  { id: "dummy-foodie", title: "Foodie Walk", category: "food", difficulty: "easy", stopCount: 6, durationMinutes: 90, description: "Smak av Trondheim — bakeri, sjømat og fine dining" },
  { id: "dummy-fjord", title: "Fjordstien", category: "nature", difficulty: "moderate", stopCount: 4, durationMinutes: 45, description: "Naturtur langs fjorden med utsikt over byen" },
  { id: "dummy-family", title: "Barnas Trondheim", category: "family", difficulty: "easy", stopCount: 5, durationMinutes: 50, description: "Barnevennlige aktiviteter i sentrum — fra museum til lekeplass" },
  { id: "dummy-hidden", title: "Hemmelige Trondheim", category: "hidden-gems", difficulty: "moderate", stopCount: 4, durationMinutes: 40, description: "Steder de fleste går forbi — bakgårder, utsiktspunkter og lokale favoritter" },
];
```

Merge dummy-trips med ekte trips fra props. Dummy-trips vises kun når de er den eneste kilden (ikke duplikat).

### 2. Kategori-kort seksjon (toppen)

Gjenbruk designet fra `ReportHero.tsx` linje 122-158:
- Grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3`
- Hvert kort: Hvit bakgrunn, border, rounded-xl, ikon + navn + antall trips
- Klikk = smooth scroll til kategori-seksjonen
- Ikoner per kategori (Lucide): UtensilsCrossed (food), Landmark (culture), TreePine (nature), Baby (family), Mountain (active), Sparkles (hidden-gems)

### 3. Featured trips-seksjon

Trips med `featured: true` vises i store horisontale kort:
- Horisontal scroll med snap (`snap-x snap-mandatory`)
- Kort: ~280-320px bredt, 16:9 aspect ratio
- Gradient overlay (mørk bunn)
- Tittel (stor, hvit), beskrivelse (1 linje), kategori-badge oppe
- Metadata: varighet + stopp-count + vanskelighetsgrad
- Placeholder-bilde: gradient fra kategorifarger

### 4. Kategorirader (oppgradert)

Beholder eksisterende mønster men med rikere kort:
- Kort: ~200px bredt (opp fra 160px)
- Viser: cover, tittel, varighet, stopp-count, vanskelighetsgrad
- Overskrift + chevron for hver kategori
- Scroll til seksjon via `id`-attributt per rad

### 5. Søk og filtrering

- Behold søkefeltet (fungerer med både ekte og dummy-trips)
- Fjern kategori-filter chips (erstattet av kategori-kort)
- Søk filtrerer hele visningen (featured + kategorirader)

---

## Design tokens

Gjenbruk eksisterende:
- Bakgrunn: `#FAF8F5`
- Tekst: `#1A1A1A`
- Sekundær tekst: `#6B6560`
- Accent: `#C45C3A`
- Kort-border: `#eae6e1`
- Kort-hover: `#c0b9ad`

## Kategori-farger for placeholder-gradienter

```ts
const CATEGORY_GRADIENTS: Record<TripCategory, string> = {
  food: "from-amber-800 to-orange-600",
  culture: "from-stone-700 to-amber-800",
  nature: "from-emerald-800 to-teal-600",
  family: "from-sky-700 to-blue-500",
  active: "from-rose-700 to-orange-500",
  "hidden-gems": "from-purple-800 to-indigo-600",
};
```

---

## Avgrensning

- **Ikke** endre Supabase-skjema
- **Ikke** endre server-komponenten (`page.tsx`)
- **Ikke** endre trip detail page
- Dummy-data lever kun i klienten, kommentert tydelig for fjerning senere
- Dummy-trips har ikke lenke (viser tooltip "Kommer snart" eller lignende)
