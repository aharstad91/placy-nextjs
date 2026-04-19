# Kvalitetsaksler per POI

Disse 5 aksene er *spørsmålene research-steget skal svare på* for hver POI som vurderes til tekst.

## 1. Kjede-status

**Verdier:** `uavhengig` | `nasjonal_kjede` | `lokal_kjede`

**Kilder:**
- Primær: WebSearch "`{POI-navn} om oss`" eller "`{POI-navn} kjede`"
- Sekundær: Google Places data (men ofte upålitelig — ikke stol alene)

**Hvorfor:** Fanger Backstube-feilen. Kjeder skrives sjelden om med S&J-stil.

**Regler:**
- Kjede → kan nevnes som *faktum* (f.eks. "Fresh Fitness som døgnåpent alternativ") men ikke som *flaggskip*
- Uavhengig → prioriteres for navngiving
- Lokal kjede (2-5 avdelinger i byen) → behandles som uavhengig hvis kvalitet er høy

## 2. Priskategori

**Verdier:** `budget` | `middel` | `premium`

**Kilder:**
- Primær: `google_price_level` (1-4) — mapp 1 → budget, 2-3 → middel, 4 → premium
- Sekundær: WebSearch for prisnivåer

**Hvorfor:** Fanger Pirbad-feilen. Premium-opplevelser er ikke "daglig" — de er sporadisk luksus.

**Regler:**
- Premium kan nevnes med nøye kontekst ("for spesielle anledninger")
- Ikke fremstill premium som "fast del av hverdagen"
- Budget-kjede (f.eks. kjappe kaffesteder) får kort behandling

## 3. Målgruppe-appell

**Verdier:** Flervalg — `familie` | `voksen` | `ungdom` | `universell`

**Kilder:**
- Primær: WebSearch og anmeldelser — hvem går hit?
- Sekundær: Stedstype (bar → voksen; lekeplass → familie/universell)

**Hvorfor:** Matcher direkte mot persona.

**Regler:**
- Voksen-appell + `barnefamilie`-persona → deprioriter for navngiving
- Familie-appell + `etablerer`-persona → deprioriter
- Universell er "trygg" — passer alle

## 4. Spesialitet

**Verdier:** Fri tekst, 3-10 ord. Hva er stedet *kjent for*?

**Eksempler:**
- "Første spesialkaffebar i Norge, 1990-tallet" (Dromedar Bakklandet)
- "Michelin-anerkjent vinliste" (Spontan)
- "Norges mest kjente popmusikk-museum, gylden boks ved fjorden" (Rockheim)
- "Surdeigsbakeri, økologisk" (Godt Brød)
- "Nasjonal hub for popmusikk" (Rockheim alt)
- "Norges eldste skole i drift, grunnlagt 1152" (Katedralskolen)

**Kilder:**
- Primær: WebSearch `"{POI-navn} {by} om"` — leter etter beskrivelser, utmerkelser, spesialiteter
- Sekundær: Google reviews for tilbakevendende temaer

**Hvorfor:** Gir S&J-stil navngiving kropp. Uten spesialitet er POIs bare navn + avstand.

**Filterregel — viktig:** Spesialiteten skal *hjelpe leseren med en livsstilsbeslutning*:
- ✅ "Michelin-anerkjent" — signaliserer kvalitet matter for mat-interessert
- ✅ "Første spesialkaffebar i Norge" — signaliserer historisk autoritet
- ✅ "Norges eldste skole i drift" — gir stolthet/tradisjon
- ❌ "Åpnet i 2001" — ingen livsstilsverdi
- ❌ "Tar imot 400 000 besøkende" — trivia, ikke insight
- ❌ "Har 3 etasjer" — ikke-informativt

**Regelen:** Hvis spesialiteten ikke kan kompletere setningen *"fordi det gjør mitt liv her..."* med noe meningsfullt, fjern den.

## 5. Kvalitetsnivå

**Verdier:** `topp` | `solid` | `blandet`

**Kilder:**
- Primær: `google_rating` + `google_review_count` (se regler under)
- Sekundær: WebSearch for eksterne utmerkelser (Michelin, White Guide, Kuben, Det norske måltid)

**Regler for Google rating:**
| Rating | Anmeldelser | Nivå |
|--------|-------------|------|
| ≥4.5 | ≥100 | `topp` |
| 4.0-4.4 | ≥50 | `solid` |
| 4.0-4.4 | <50 | `solid` (tentative) |
| <4.0 | Irrelevant | `blandet` |
| Ingen | Offentlig POI | Bruk andre kilder (NSR/Udir for skole, etc.) |

**Eksterne utmerkelser løfter til `topp` uansett Google:**
- Michelin-guide (Nordic eller International)
- White Guide (topp 3 i kategori)
- Kuben-utmerkelse
- Det norske måltid-finalist

## Lagring

Aksler lagres i POI-raden som:
```json
{
  "poi_metadata": {
    "quality_axes": {
      "chain_status": "uavhengig",
      "price_category": "middel",
      "audience_appeal": ["voksen", "universell"],
      "specialty": "Første spesialkaffebar i Norge, 1990-tallet",
      "quality_level": "topp"
    },
    "quality_researched_at": "2026-04-17T..."
  }
}
```

## Cost-kontroll

Ikke research alle POIs. Prioriter:
1. POIs med `poi_tier=1` eller `is_local_gem=true`
2. POIs innenfor 500m
3. POIs som sannsynligvis blir nevnt (topp 3-5 per kategori etter initial ranking)

Offentlige POIs (bysykkelstasjoner, busslinjer, parker uten navn) trenger sjelden research — de har implisitte aksler basert på type.

## Gotcha — `is_chain` er ofte feil i Supabase

Mange kjeder er merket `is_chain: false` i Supabase-data. **Stol alltid på WebSearch** for kjede-status, ikke feltet alene.

Kjente feilmerkinger (verifiserte per 2026-04):
- Backstube: merket `is_chain: false` men er importør-kjede
- Fresh Fitness: varierer per POI
- Godt Brød: norsk kjede (men håndverks-fokus)
