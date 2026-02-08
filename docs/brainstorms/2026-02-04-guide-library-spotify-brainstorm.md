# Brainstorm: Spotify-inspirert Guide-bibliotek

**Dato:** 2026-02-04
**Status:** Utforsket
**Produkt:** Guide

---

## Hva vi bygger

Et bibliotek/oversiktsside for guides, inspirert av Spotifys album/spilleliste-visning. Siden viser tilgjengelige guides i horisontalt scrollbare rader, gruppert etter tema, varighet og vanskelighetsgrad.

### Hovedfunksjoner

1. **Kategoriserte rader** - Horisontalt scrollbare seksjoner som:
   - "Mat & drikke"
   - "Kultur og historie"
   - "Naturopplevelser"
   - "Raske turer (under 1 time)"
   - "Utfordrende vandringer"

2. **Visuelle guide-kort** - Store kort med:
   - Cover-bilde
   - Tittel
   - Antall stopp (f.eks "7 stopp")

3. **"Nylig sett" rad** - Cookie-basert historikk øverst for gjentakende brukere

4. **Søk og filter** - Header med:
   - Søkefelt (fulltekst i titler og beskrivelser)
   - Kategori-filter

---

## Hvorfor denne tilnærmingen

### Kontekst

- Hotell er hovedinngangen (QR-kode/link)
- Blanding av felles guides og hotell-spesifikke
- Ingen innlogging - bruker cookies for "nylig sett"
- Flere brukergrupper: turister, hotellgjester, lokalbefolkning

### Inspirasjon fra Spotify

Spotify-modellen fungerer fordi:
- Visuelt engasjerende - store bilder fanger oppmerksomhet
- Kjent UX - brukere forstår horisontale rader
- Skalerbart - fungerer med 5 eller 50 guides
- Oppdagelse - kategorier hjelper brukere finne noe uventet

### Alternativ vurdert men forkastet

- **Kart-sentrert:** Gir geografisk kontekst, men komplekst og dårlig på mobil
- **Kompakt liste:** Raskere oversikt, men mindre engasjerende

---

## Nøkkelbeslutninger

| Beslutning | Valg | Begrunnelse |
|------------|------|-------------|
| Layout | Horisontale rader | Spotify-mønster, skalerbart |
| Kort-innhold | Bilde + tittel + antall stopp | Rent og enkelt |
| Personalisering | Cookie-basert "nylig sett" | Ingen innlogging nødvendig |
| Navigasjon | Søk + filter | Gir kontroll ved mange guides |
| Inngang | `/[customer]/guides` | Hotell deler lenke, tydelig URL |

---

## Åpne spørsmål

1. **Hotell-spesifikke guides:** Hvordan markere at en guide er eksklusiv for dette hotellet? Badge? Egen seksjon?

2. **Reward-synlighet:** Skal det vises på kortet at guiden gir belønning, eller er dette en overraskelse?

3. **Fallback ved få guides:** Hvordan ser siden ut når et hotell bare har 2-3 guides? Bytte til enklere layout?

4. **Rekkefølge i rader:** Hva bestemmer sorteringen? Popularitet? Manuell kurering?

---

## Datamodell-endringer (forventet)

Eksisterende `GuideConfig` har allerede:
- `difficulty: "easy" | "moderate" | "challenging"`
- `coverImageUrl`
- `stops` (for å telle antall)

Trenger trolig:
- `category: string` eller `tags: string[]` for temagruppering
- `featured: boolean` for fremhevede guides
- Eventuelt en `GuideLibraryConfig` på kunde-nivå

---

## Neste steg

Kjør `/workflows:plan` for å lage implementeringsplan med:
- Komponentstruktur
- Routing (`/[customer]/guides`)
- Datamodell-utvidelser
- Responsivt design (mobil-first)
