# Curator Writing Levels — Brainstorm

**Dato:** 2026-02-14

## Problemet

Curator-skillen har 6 prinsipper (navngi, bevegelse, kontraster, saklig entusiasme, mennesker, sensorisk presisjon) som fungerer godt for POI-hooks — men når de brukes på kategori-bridgeText, cherry-picker teksten 3 av 90 steder uten å forklare hvorfor. Resultatet mangler det store bildet og har feil register.

**Eksempel (bridgeText som føltes feil):**
> "Bula Neobistro — åpnet av Top Chef-vinner Reneé Fagerhøi — ligger minutter fra hotellet, Backstube baker tyske surdeigsbrød i Jomfrugata, og Spontan Vinbar i Brattørgata er anbefalt i Guide Michelin."

Leser: "Hvorfor disse tre? Hva med de andre 87?"

## Hva Vi Bygger

En differensiert skrivemåte i Curator-skillen basert på **tekstnivå** — ikke én stemme for alt, men riktig register for konteksten.

### Nøkkelinnsikt: POI-tekst vs. kategori-tekst

| | POI-tekst (editorial_hook) | Kategori-tekst (bridgeText) |
|---|---|---|
| **Formål** | Hva gjør *dette stedet* spesielt | Hva er *karakteren* til kategorien i nabolaget |
| **Spesifisitet** | Maks spesifikk: navn, årstall, meritter | Nabolagskarakter + 1-2 ankersteder som ytterpunkter |
| **Tall** | Kan nevne spesifikke tall | Unngå — tall vises i UI (antall, snitt, anmeldelser) |
| **Register** | Detaljert, faktadrevet | Overordnet, karakteriserende |
| **Analogi** | Museumsskilt ved ett kunstverk | Plakett ved inngangen til en sal |

### Riktig bridgeText-stemme: Nabolagskarakter + ankersteder

**Prinsipp:** BridgeText beskriver *personligheten* til kategorien i dette nabolaget. Den nevner 1-2 ankersteder kun for å definere ytterpunktene — ikke som anbefalinger, men som kompassnåler.

**Eksempel (forbedret):**
> "Matscenen spenner fra Britannia-kvartalets fine dining til Bakklandets trehuskaféer — uformelt og variert, med overraskende dybde i sidegatene."

vs. gammel:
> "Bula Neobistro — åpnet av Top Chef-vinner Reneé Fagerhøi — ligger minutter fra hotellet..."

**Forskjellen:** Første versjonen karakteriserer helheten og bruker ankersteder (Britannia, Bakklandet) som ytterpunkter. Andre versjonen leser som tre POI-hooks klebet sammen.

## Nøkkelbeslutninger

1. **bridgeText = nabolagskarakter, ikke POI-anbefaling**
2. **1-2 ankersteder som ytterpunkter** — navngi steder som definerer spennet, ikke de "beste"
3. **Ingen tall i teksten** — antall, snitt, anmeldelser vises allerede som UI-elementer
4. **Kun bridgeText nå** — andre tekstnivåer (intro_text, heroIntro) defineres senere

## Viktig TODO

Curator-skillen trenger skrivemåte definert for ALLE tekstnivåer, ikke bare POI og bridgeText:
- `heroIntro` (rapport-toppen — hva er nabolaget?)
- `bridgeText` (kategori i rapport — hva er karakteren?)
- `intro_text` (kategorisider — dypere kategori-intro)
- `editorial_hook` (POI — hva er spesielt?)
- `local_insight` (POI — insider-tips)

Hvert nivå trenger sin egen register-beskrivelse i Curator-skillen.

## Åpne Spørsmål

- Bør ankersteder i bridgeText matche "Anbefalt"-POI-ene, eller kan de være hvilke som helst steder som definerer karakteren?
- Skal bridgeText bruke bevegelse (prinsipp B) for å male et bilde av nabolaget?
- Trenger vi eksempler per kategori-type (Mat vs Transport vs Trening)?
