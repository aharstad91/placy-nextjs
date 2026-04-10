---
date: 2026-04-09
topic: kategori-hero-insight
---

# Kategori Hero Insight — unik visuell oppsummering per tema

## Hva vi bygger

Hver temaseksjon i rapporten får en **kategori-spesifikk hero insight** — et strukturert faktakort som viser det viktigste for nettopp den kategorien. Kortet plasseres **over teksten** som det første elementet etter overskriften. Teksten under komplementerer kortet med stemning og kontekst.

## Hvorfor denne tilnærmingen

Fra mønsteranalysen av ~160 meglerannonser (docs/research/2026-04-08-beliggenhetstekst-moensteranalyse.md):
- Meglere nevner alltid **spesifikke navn med avstand i minutter**
- Hver kategori har en unik "killer insight" — skolekrets for barn, nærmeste dagligvare for hverdagsliv, etc.
- Sem & Johnsen-nivået: fakta først, stemning etter

I dag har alle kategorier **samme generiske ThemeInsight** ("3 skoler · 5 innen 5 min"). Det forteller deg ingenting om *hvilken* skole barnet ditt skal gå på.

## POI-hierarki — kureringsmodellen

Alle POI-er i en kategori deles i tre roller:

### Tier 1 — Kortet (Hero Insight)
De som svarer på kategoriens kjernespørsmål. Vises med navn og gangavstand i det strukturerte kortet.

### Tier 2 — Teksten (Inline POI)
De som gir området karakter og dybde. Nevnes i teksten som inline-lenker. Utelukker Tier 1 — teksten gjentar ikke det som står i kortet.

### Tier 3 — Kartet (Alt)
Alle POI-er. Kartet er utforskningsverktøyet.

Oppsummeringslinjen ("12 steder i denne kategorien") flyttes inn i kart-CTA-en, kobles direkte til utforskningsinvitasjonen.

## 7 unike hero insights

### 1. Barn & Oppvekst — Skolekretskortet
**Form:** Tabell med hierarkisk skolestruktur
**Innhold:** Barneskole (1-7), ungdomsskole (8-10), nærmeste VGS med gangavstand + antall barnehager og lekeplasser
**Datakilde:** `getSchoolZone()` for skolekrets, POI for VGS og gangavstand, telling for barnehager/lekeplasser
**Tekst-fokus:** Barnevennlighet, trygghet, lite trafikk, lekeplasser, "barna kan gå selv"

### 2. Hverdagsliv — Nærmeste per behov
**Form:** Én linje per behovstype (dagligvare, apotek, lege, frisør)
**Innhold:** Nærmeste av hver type med navn og gangavstand
**Datakilde:** POI gruppert per underkategori, sortert på gangavstand
**Tekst-fokus:** Samlokaliseringer, kjøpesentre, "hverdagen uten bil"

### 3. Transport — Holdeplasser med linjer
**Form:** Holdeplassliste med transporttype og linjenummer
**Innhold:** Nærmeste holdeplasser med type (buss/trikk/tog) og linjenummer
**Datakilde:** POI + Entur API for linjenummer (allerede integrert i Explorer)
**Tekst-fokus:** Frekvens, fleksibilitet, pendleralternativer

### 4. Natur & Friluftsliv — Primærområde + grønt
**Form:** Primært turområde som ankerpunkt + sekundære parker
**Innhold:** Nærmeste store turområde med gangavstand + stemningssetning + mindre grøntområder
**Datakilde:** POI med kategori park/outdoor, editorial hook
**Tekst-fokus:** Stemning, "marka utenfor døren", turløyper, badeplasser

### 5. Mat & Drikke — Kvalitetsankeret
**Form:** Topp 3 best ratede steder med rating, type og avstand
**Innhold:** Rating-sortert liste + totaltelling og snittrating
**Datakilde:** POI sortert på googleRating desc
**Tekst-fokus:** Mangfold, karakter, "morgenkaffe til fredagskveld"

### 6. Trening & Aktivitet — Breddevisning
**Form:** Én per underkategori (gym, svømmehall, idrettsanlegg)
**Innhold:** Nærmeste av hver type med navn og gangavstand + oppsummering av bredde
**Datakilde:** POI per underkategori
**Tekst-fokus:** Variasjon, "noe for alle", utendørs vs innendørs

### 7. Opplevelser — Kulturtilbudet
**Form:** Navngitte institusjoner med type og avstand
**Innhold:** Nærmeste per underkategori (bibliotek, kino, museum, teater)
**Datakilde:** POI per underkategori
**Tekst-fokus:** Hva som gjør kulturtilbudet unikt, programtilbud

## Samspill kort + tekst

| Element | Rolle | Kilde |
|---------|-------|-------|
| Hero Insight (kort) | Strukturert fakta — hva, hvor, hvor langt | Tier 1 POI-er |
| Tekst med inline POI | Kontekst, stemning, karakter | Tier 2 POI-er |
| Kart-CTA med oppsummering | "Utforsk kartet — N steder" | Tier 3 (alle) |
| Kart | Visuell utforskning | Tier 3 (alle) |

bridge-text-generator må oppdateres til å:
1. Motta liste over Tier 1-POI-er (de i kortet) og utelukke dem fra teksten
2. Velge Tier 2-POI-er basert på kategori-spesifikk logikk (karakter, kvalitet, mangfold)
3. Komplementere kortet med stemning og kontekst, ikke gjenta fakta

## Neste steg

Implementer iterativt — én kategori om gangen, start med Barn & Oppvekst (tydeligst behov, data allerede tilgjengelig via getSchoolZone).
