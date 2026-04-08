# Brainstorm: /generate-bolig — Automatisert boligrapport-generator

**Dato:** 2026-02-18
**Status:** Besluttet

## Hva vi bygger

En Claude Code-kommando (`/generate-bolig`) som tar boligprosjekt-navn + adresse og automatisk genererer en komplett nabolagsrapport (Report + Explorer) tilpasset boligkjøpere.

**Eksempel bruk:**
```
/generate-bolig "Overvik" "Presthusvegen 45, Ranheim, Trondheim"
```

**Pilot:** Overvik (Fredensborg Bolig, Ranheim) — brukes som salgsmateriell mot utbygger.

## Hvorfor denne tilnærmingen

- `/generate-hotel` er allerede en 13-stegs pipeline som fungerer. Vi forker og tilpasser
- Egen kommando (ikke profil-basert) — boligrapporter har nok forskjeller til å rettferdiggjøre separasjon
- Investering i nye kategorier (skole, barnehage, idrett) betaler seg for alle fremtidige boligrapporter
- Automatisering fra dag 1: Overvik er pilot, men prosessen skal kunne repeteres for OBOS, Veidekke, etc.

## Kontekst: Strategisk pivot

Placy fokuserer 100% på eiendom fremover. Report-produktet er designet for nettopp dette:
- **B2B-kunde:** Boligutbyggere (Fredensborg, OBOS, Veidekke)
- **Sluttbruker:** Boligkjøpere/leietakere
- **Verdiproposisjon:** "Oppdag nabolaget rundt din nye bolig" — interaktivt kart + redaksjonelt innhold

Hotellkundene (Scandic, Radisson, Quality) var gode demo-prosjekter. Eiendom er der den reelle verdien ligger.

## Nøkkelbeslutninger

| Beslutning | Valg | Begrunnelse |
|------------|------|-------------|
| **Kommando** | `/generate-bolig` (ny, separat) | Tydelig separasjon fra hotell, enklere å utvikle |
| **Radius** | 2000-3000m | "Hverdagsradius" — alt du gjør i hverdagen (butikk, skole, trening) |
| **Nye kategorier** | skole, barnehage, idrett | Kritisk for boligkjøpere, mangler i systemet |
| **POI-discovery** | Google Places + web-research | Google for kommersielle, web for offentlige (skoler, barnehager) |
| **Temaer** | 6 bolig-tilpassede temaer | Alle likeverdige — vis bredden i nærområdet |
| **Redaksjonell tone** | "For fremtidige beboere" | Ikke gjeste-perspektiv — beboer-perspektiv |
| **Kvalitetsmål** | Imponerende OG skalerbar | Overvik = salgsmateriell mot Fredensborg + template for fremtiden |

## Boligprofil

### Kategorier (Google Places)

```json
["restaurant", "cafe", "bar", "bakery", "supermarket", "pharmacy",
 "gym", "park", "museum", "library", "shopping_mall", "movie_theater",
 "hair_care", "spa", "school", "kindergarten"]
```

### Kategorier (Web-research — ikke i Google Places)

- **Skoler:** Barneskoler, ungdomsskoler, videregående i radius
- **Barnehager:** Kommunale og private
- **Idrettsanlegg:** Haller, baner, svømmehall, skianlegg
- **Turområder:** Stier, marka-innganger, badeplasser (delvis eksisterer)

### Per-by radius-defaults (bolig)

| By | Radius |
|----|--------|
| Trondheim | 2500m |
| Oslo | 2000m |
| Bergen | 2000m |
| Default | 2500m |

### Report-temaer (boligrekkefølge)

```json
[
  {
    "id": "hverdagsliv",
    "name": "Hverdagsliv",
    "icon": "ShoppingCart",
    "categories": ["supermarket", "pharmacy", "shopping", "haircare", "bank", "post"],
    "color": "#22c55e"
  },
  {
    "id": "barnefamilier",
    "name": "Barn & Oppvekst",
    "icon": "GraduationCap",
    "categories": ["skole", "barnehage", "lekeplass", "idrett"],
    "color": "#f59e0b"
  },
  {
    "id": "mat-drikke",
    "name": "Mat & Drikke",
    "icon": "UtensilsCrossed",
    "categories": ["restaurant", "cafe", "bar", "bakery"],
    "color": "#ef4444"
  },
  {
    "id": "natur-friluftsliv",
    "name": "Natur & Friluftsliv",
    "icon": "Trees",
    "categories": ["park", "outdoor", "badeplass"],
    "color": "#10b981"
  },
  {
    "id": "transport",
    "name": "Transport & Mobilitet",
    "icon": "Bus",
    "categories": ["bus", "train", "tram", "bike", "parking", "carshare", "taxi"],
    "color": "#3b82f6"
  },
  {
    "id": "trening-velvare",
    "name": "Trening & Velvære",
    "icon": "Dumbbell",
    "categories": ["gym", "spa", "swimming"],
    "color": "#ec4899"
  }
]
```

## Forskjeller fra /generate-hotel

| Aspekt | /generate-hotel | /generate-bolig |
|--------|----------------|-----------------|
| Radius | 800m | 2000-3000m |
| Kategorier | 14 kommersielle | 14 + skole, barnehage, idrett |
| POI-kilder | Google + Entur + Bysykkel | Google + Entur + Bysykkel + **web-research** |
| Temaer | 5 (mat, kultur, hverdagsbehov, transport, trening) | 6 (hverdagsliv, barn & oppvekst, mat, natur, transport, trening) |
| Kundenavn | Utleder hotellkjede | Utleder utbygger-navn |
| Report-perspektiv | "Nabolaget rundt hotellet" | "Nabolaget rundt din nye bolig" |
| Editorial tone | For gjester/turister | For fremtidige beboere |
| Produkter | Report + Explorer | Report + Explorer |

## Nye kategorier (krever DB-migrasjon)

Tre nye kategorier som må opprettes i systemet:

| Kategori-ID | Navn | Ikon | Tema |
|-------------|------|------|------|
| `skole` | Skole | GraduationCap | barnefamilier |
| `barnehage` | Barnehage | Baby | barnefamilier |
| `idrett` | Idrettsanlegg | Trophy | barnefamilier |

Disse legges til i:
- `category_slugs`-tabellen (Supabase)
- Tema-definisjoner (`default-themes.ts` eller reportConfig)
- Import-pipeline (for web-research-kilde)

## Web-research pipeline (nytt steg)

Google Places dekker ikke skoler, barnehager og idrettsanlegg godt i Norge. Nytt steg i pipelinen:

1. Søk `"skoler nær {adresse}"` / `"barnehager {bydel} {by}"` / `"idrettsanlegg {bydel}"`
2. Parse resultater → koordinater, navn, type
3. Opprett POIs med `category_id` = skole/barnehage/idrett
4. Alternativ kilde: Kommunens karttjenester, Google Maps-søk

## Overvik-spesifikk kontekst

**Koordinater:** 63.4205829, 10.5148722
**Bydel:** Ranheim, Trondheim
**Utbygger:** Fredensborg Bolig
**Nøkkelkvaliteter:**
- Nærhet til sjøen (Ranheimsfjæra, Grilstadfjæra, badeplasser)
- Marka som nabo (Estenstadmarka, turstier)
- Ranheim i utvikling (nye boligfelt, togstasjon, kafeer)
- 10-15 min til sentrum (buss, tog, bil)

**Eksisterende POI-dekning:** 97 POIs, nesten alt infrastruktur (58 buss, 15 lekeplasser, 5 badeplasser). Mangler helt: restauranter, kaféer, butikker, skoler, barnehager, treningssentre.

## Åpne spørsmål

- **Web-research kvalitet:** Hvor pålitelig er web-søk for å finne skoler/barnehager med korrekte koordinater? Kan trenge manuell verifikasjon
- **Tursti-POIs:** Skal vi ha egne POIs for tursti-innganger til marka? Eller holder det med "outdoor" / "park"?
- **Overvik-spesifikk copy:** Skal heroIntro nevne Fredensborg Bolig, eller holde det nøytralt (kundetilpasset)?

## Neste steg

Kjør `/workflows:plan` for å designe den tekniske implementeringen:
1. DB-migrasjon for nye kategorier
2. `/generate-bolig` kommando med 13+ stegs pipeline
3. Web-research-steg for skoler/barnehager/idrett
4. Overvik som første kjøring
