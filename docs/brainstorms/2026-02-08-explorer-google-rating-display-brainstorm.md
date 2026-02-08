# Brainstorm: Google Rating-visning i Explorer

**Dato:** 2026-02-08
**Status:** Besluttet — klar for plan

## Hva vi bygger

Vise Google-rating (★★★★☆ 4.5 (72)) på en troverdig, gjenkjennbar måte i Explorer — både i sidebar-kort og i markør-tooltip på kartet. Google-identisk design bygger tillit og gjør informasjonen umiddelbart skannbar.

## Hvorfor denne tilnærmingen

### Problemet
- Nåværende kort viser én gul stjerne + tall (★ 4.5) — mangler tyngde og gjenkjennbarhet
- Brukere stoler på Google-stjerners visuelle mønster — 5 stjerner med fyll er universelt forstått
- Placy skal være en innsiktskilde — da må informasjonen presenteres med troverdighet
- Rating-filter ble vurdert men parkert: Google-rating er ujevn for mange kategorier (apotek med 20 reviews der halvparten er sinte = urettferdig filtrering)

### Hvorfor ikke rating-filter (ennå)
- Google-rating er upålitelig for kategorier med få reviews
- Fjerne steder basert på lav score gir ufullstendig bilde — motsier Placy som helhetlig innsiktskilde
- Highlight/dim ble vurdert men krever sterkere visuell rating-tillit først
- **Først:** vis rating skikkelig → **Senere:** vurder interaktiv filtrering

## Nøkkelbeslutninger

### 1. Google-identisk stjerne-design
- 5 visuelle stjerner (fylt / halv / tom) med Google-gul farge
- Format: ★★★★☆ 4.5 (72) — rating + antall reviews
- Identisk med Google Maps for maksimal gjenkjennbarhet

### 2. Synlig i tre flater
| Flate | Visning |
|-------|---------|
| **Kompakt kort** (sidebar) | ★★★★☆ 4.5 (72) under kategori-navn |
| **Utvidet kort** | Samme, eventuelt med litt større format |
| **Markør hover-tooltip** | ★ 4.5 (kompakt) eller full 5-stjerne hvis plass |

### 3. Kategori-basert synlighet
Vis stjerner **kun** for kategorier der Google typisk har meningsfull data:

**VIS rating:**
- Restaurant, Kafé, Bar, Bakeri
- Museum, Kino, Bibliotek
- Gym, Spa, Svømmehall
- Supermarked, Apotek, Shopping
- Frisør

**SKJUL rating:**
- Busstopp, Tog, Trikk, Taxi-holdeplass
- Bysykkelstasjon, Parkering, Bildelingstasjon
- Ferge, Flyplass
- Parker (med mindre de faktisk har reviews)

> Implementeres som en config-liste (`CATEGORIES_WITH_RATING`) heller enn hardkodet logikk.

### 4. Manglende data
Steder i "vis rating"-kategorier men uten Google-data: **vis ingenting**. Ingen grå stjerner, ingen "ikke vurdert"-tekst. Feltet er bare fraværende.

## Åpne spørsmål

- **Hover-tooltip plass:** Full 5-stjerne eller kompakt (★ 4.5) i tooltip? Avhenger av tilgjengelig bredde.
- **"Powered by Google":** Bør vi vise Google-attribusjon nær stjernene for ekstra tillit? Google TOS kan kreve det.
- **Terskel for å vise:** Bør vi ha minimumskrav til antall reviews (f.eks. >5) før vi viser rating?

## Parkerte ideer (utforsk senere)

1. **Rating-filter/slider** — "Vis kun 4.0+ restauranter". Parkert fordi Google-data er ujevn.
2. **Highlight vs. dim** — Fremheve høyt ratede steder visuelt (gull-ring, badge). Mulig oppfølging.
3. **"Hent flere lignende fra Google"** — Dynamisk POI-oppdagelse. Wow-effekt, egen brainstorm.
4. **TripAdvisor som kilde** — Betalt API, parkert for nå.

## Neste steg

Kjør `/workflows:plan` for å implementere Google-identisk rating-visning i kompakt kort, utvidet kort, og markør-tooltip.
