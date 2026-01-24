---
date: 2026-01-24
topic: fullscreen-map-layout
---

# Fullskjerm Kart med Flytende Panel

## What We're Building

Endre admin/pois layout fra 50/50 grid til **fullskjerm kart** med flytende GUI-elementer oppå, inspirert av Google Maps.

Ett flytende panel i topp-venstre (maks 30% bredde) som endrer innhold basert på state:
- **Default:** Søkefelt + kategori-filter + "Ny POI" knapp
- **Ved markør-klikk:** Utvides med edit-form for valgt POI
- **Ved "Ny POI":** Viser tom form for opprettelse

## Why This Approach

**Vurderte alternativer:**
1. **Flytende panel med state-basert innhold (valgt)** - Enkelt mental modell, ett panel
2. **Separate flytende komponenter** - Mer kompleks, ikke nødvendig

Valgte A fordi:
- Matcher Google Maps UX som brukere kjenner
- Kartet får maksimal plass og oppmerksomhet
- Ett panel = enklere state management
- Naturlig flow: se → klikk → rediger

## Key Decisions

### Layout
- **Kart:** 100% av viewport (minus eventuell header)
- **Panel:** Absolutt posisjonert topp-venstre, max-width: 30%, margin fra kant
- **Panel styling:** Hvit bakgrunn, skygge, rounded corners (som Google Maps)

### Panel States
| State | Innhold |
|-------|---------|
| `idle` | Søkefelt, kategori-filter (kompakt), "Ny POI" knapp |
| `editing` | Alt fra idle + full edit-form for valgt POI |
| `creating` | Alt fra idle + tom edit-form |

### Interaksjoner
- Klikk markør → panel går til `editing` state
- Klikk "Ny POI" → panel går til `creating` state
- Klikk "X" eller utenfor panel → tilbake til `idle`
- Klikk på kart (ikke markør) → setter koordinater hvis i `creating` state

### Filter-visning
- Kompakt checkbox-liste med counts
- "Alle/Ingen" toggle-knapper
- URL sync beholdes

## Resolved Questions

- **Header:** Fjernes helt - kun kart + flytende panel
- Panel vokser med innhold (max-height med scroll hvis nødvendig)

## Next Steps

→ `/workflows:plan` for implementasjonsdetaljer
