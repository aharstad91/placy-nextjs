---
title: "Profil-filter for Explorer Eiendom - Bolig"
date: 2026-04-07
---

# Profil-filter for Explorer Eiendom - Bolig

## Hva vi bygger

En **livsfase-velger** som bottom sheet modal over Explorer-kartet for Eiendom - Bolig-prosjekter. Brukeren velger hvem de er (barnefamilie, par, singel, pensjonist), og Explorer filtrerer automatisk til de mest relevante temaene.

**Problemet:** Eiendom-Explorer har 200+ POI-er fordelt på 7 temaer. Det er overveldende. Boligkjøpere har ulike prioriteringer basert på livsfase — en barnefamilie bryr seg om skoler og barnehager, ikke uteliv.

**Løsningen:** Samme mønster som Kompass (Event) — bottom sheet over kartet. Én modal, ett valg, rett inn. Kartet er synlig bak modalen slik at brukeren forstår at Explorer er "der" og kan dismisses.

## Hvorfor denne tilnærmingen

- **Gjenbruker Kompass-mønsteret** — bottom sheet over kart er allerede kjent UX fra Event-Exploreren
- **Minimal friksjon** — ett steg, ikke to. Klikk livsfase → Explorer åpner med riktige filtre
- **Kun pre-velger temaer** — ingen endring i caps/vekting. Brukeren kan overstyre via tema-chips etterpå
- **"Hopp over" = alt på** — ingen tvang, bare en snarvei

## Nøkkelbeslutninger

### 1. Bottom sheet modal over kartet (ikke fullskjerm)
Brukeren ser at Explorer lever bak modalen. Kart med POI-markører synlig. Kan klikke utenfor/hopp over for å gå rett inn med alle temaer.

### 2. Ett steg, ikke to
Livsfase → rett inn. Ingen mellomsteg med tema-justering. Tema-chips i Explorer er der for finjustering etterpå.

### 3. Kun pre-velge temaer (ikke caps)
Livsfase-valg setter `disabledCategories` basert på en enkel mapping. Ingen endring i bransjeprofil-caps. YAGNI — caps-justering kan legges til senere hvis nødvendig.

### 4. Fire livsfaser med tema-mapping

| Livsfase | Temaer PÅ | Temaer AV |
|----------|-----------|-----------|
| Barnefamilie | Barn & Oppvekst, Hverdagsliv, Natur & Friluftsliv, Transport | Mat & Drikke, Opplevelser, Trening |
| Par uten barn | Mat & Drikke, Opplevelser, Trening, Hverdagsliv | Barn & Oppvekst, Natur, Transport |
| Aktiv singel | Mat & Drikke, Trening, Opplevelser, Transport | Barn & Oppvekst, Hverdagsliv, Natur |
| Pensjonist | Hverdagsliv, Natur & Friluftsliv, Opplevelser, Transport | Barn & Oppvekst, Mat & Drikke, Trening |

**"Hopp over"** = alle 7 temaer på (dagens default-oppførsel).

### 5. Feature flag på bransjeprofil
Ny `features.profilFilter: true` på "Eiendom - Bolig". Gated som Kompass er for Event.

## Teknisk retning (high-level)

- **Komponent:** `BoligProfilFilter.tsx` — bottom sheet med 4 livsfase-kort + hopp over CTA
- **Ingen egen store** — skriver direkte til eksisterende `disabledCategories`-state via callback
- **Gating:** `features.profilFilter` i bransjeprofil, sjekkes i ExplorerPage
- **Mapping:** Enkel `Record<Livsfase, string[]>` i bransjeprofil eller egen fil

## Åpne spørsmål

Ingen — designet er enkelt og avgrenset nok til å implementere direkte.
