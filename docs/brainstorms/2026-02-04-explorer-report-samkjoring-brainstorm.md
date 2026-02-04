# Brainstorm: Samkjøring Explorer og Report

**Dato:** 2026-02-04
**Status:** Ferdig
**Neste steg:** `/workflows:plan`

---

## Hva vi bygger

**Oppgradere Report med interaktive kart-seksjoner** som ligner Explorer sin UX, men uten «power user»-funksjonalitet.

### Konkret løsning

Report får **ett interaktivt kart per kategori-seksjon**:

- **Layout:** 50/50 split — POI-kort til venstre, kart til høyre
- **Innhold:** Kun POI-er fra den aktuelle kategorien (mat & drikke, transport, etc.)
- **Interaktivitet:**
  - Klikk på POI-kort → kart panorerer til markør, markør highlightes
  - Klikk på markør → tilhørende kort highlightes
- **Ikke inkludert:**
  - Filtrering
  - Lagre til samling
  - Travel mode / time budget
  - Listebygging

### Artikkel-struktur

Alternerende flyt:
```
[Hero / Intro-tekst]
    ↓
[Kategori-seksjon: Mat & Drikke]
├── Tekst/bilder
└── 50/50 kart-modul (alltid synlig)
    ↓
[Kategori-seksjon: Transport]
├── Tekst/bilder
└── 50/50 kart-modul (alltid synlig)
    ↓
[osv. for hver kategori]
```

---

## Hvorfor denne tilnærmingen

### Problem
- Inkonsistent opplevelse mellom Explorer og Report
- Brukere opplever navigasjon, POI-visning, interaksjonsmønster og visuell identitet som usammenhengende
- Report sine «mini-kart» gir mindre verdi enn interaktive kart

### Løsning
- Report arver Explorer sin 50/50 layout og kart-interaksjon
- Samme POI-kort-design og markør-oppførsel
- Men strippet for kompleksitet — fokus på lesing, ikke utforskning

### Avveininger
| Fordel | Ulempe |
|--------|--------|
| Konsistent brukeropplevelse | Report blir mer lik Explorer |
| Gjenbrukbare komponenter (over tid) | Mer kompleks Report-side |
| Bedre kartopplevelse for boligkjøpere | Kan distrahere fra redaksjonelt innhold |

---

## Nøkkelbeslutninger

1. **Ett kart per seksjon** — ikke sidestilt hele veien
2. **Alltid synlig** — ingen modal eller ekspandering nødvendig
3. **Read-only interaksjon** — klikk panorerer, ingen redigering/lagring
4. **Egen komponent først** — bygge `ReportMapSection`, refaktorere til delt komponent senere
5. **Samme data** — Report bruker samme POI-data og kategorier som Explorer

---

## Åpne spørsmål

1. **Mobil-UX:** Hvordan fungerer 50/50 split på mobil? Stackes vertikalt?
2. **Ytelse:** Mange kart på én side — lazy loading nødvendig?
3. **Redaksjonell kontroll:** Kan redaktør velge rekkefølge på kategorier, eller er det automatisk?
4. **Reisetid:** Skal POI-kort i Report vise reisetid, selv uten travel mode-velger?

---

## Skisse: Report med kart-seksjoner

```
┌─────────────────────────────────────────────────────────────┐
│                      HERO / INTRO                           │
│  "Ferjemannsveien 10 — Midt i hjertet av Trondheim"        │
│  Intro-tekst om prosjektet og nabolaget...                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  MAT & DRIKKE                                               │
│  Bridge-tekst: "Området byr på alt fra tradisjonsrike..."  │
│                                                             │
│  ┌─────────────────────────┬───────────────────────────┐   │
│  │  POI-kort               │                           │   │
│  │  ┌─────────────────┐    │      MAPBOX KART          │   │
│  │  │ ☕ Café Ni Muser │    │                           │   │
│  │  │ ★ 4.6 · 3 min   │    │    ●  ●                   │   │
│  │  └─────────────────┘    │       ●  ●                │   │
│  │  ┌─────────────────┐    │          ●                │   │
│  │  │ 🍕 Pizzeria X   │    │                           │   │
│  │  │ ★ 4.2 · 5 min   │    │   [Marker highlightes     │   │
│  │  └─────────────────┘    │    ved klikk på kort]     │   │
│  │  ...                    │                           │   │
│  └─────────────────────────┴───────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TRANSPORT & MOBILITET                                      │
│  Bridge-tekst: "Enkel tilgang til kollektivtransport..."   │
│                                                             │
│  ┌─────────────────────────┬───────────────────────────┐   │
│  │  POI-kort               │      MAPBOX KART          │   │
│  │  ┌─────────────────┐    │                           │   │
│  │  │ 🚌 Bakke bru    │    │    ●                      │   │
│  │  │ 2 min           │    │       ●                   │   │
│  │  └─────────────────┘    │                           │   │
│  │  ...                    │                           │   │
│  └─────────────────────────┴───────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Flere seksjoner...]                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Differensiering: Explorer vs Report (etter endring)

| Aspekt | Explorer | Report (ny) |
|--------|----------|-------------|
| **Layout** | 50/50 split | Alternerende seksjoner med 50/50 kart-moduler |
| **Kart-interaksjon** | Full (filter, lagre, travel mode) | Begrenset (kun panorering) |
| **Innhold** | Kun POI-kort | Redaksjonell tekst + POI-kort |
| **Formål** | Utforske og bygge egen liste | Lese og bli overbevist |
| **Navigasjon** | Brukerstyrt | Lineær (scroll) |
| **Målgruppe** | Turister (praktisk) | Boligkjøpere (overbevisende) |

---

*Brainstorm gjennomført 2026-02-04*
