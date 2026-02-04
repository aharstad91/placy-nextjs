---
date: 2026-02-04
topic: report-explorer-cta
---

# Explorer-CTA på Report-siden

## Hva vi bygger

En ny seksjon på Report-siden som reklamerer for Explorer-produktet. Seksjonen plasseres **mellom "Oppsummert" og footer**, og inkluderer:

1. **Statisk kart-bilde** (Mapbox Static API) som viser alle POI-er samlet på ett kart
2. **USP-tekst** som fremhever fordelene med Explorer:
   - Se alle steder på ett kart (vs. granulerte kategori-kart i Report)
   - Filtrer selv og utforsk fritt
   - Lag din egen liste og ta den med ut
3. **CTA-knapp** som lenker til Explorer for samme prosjekt

Seksjonen vises **kun når `explorerBaseUrl` er tilgjengelig**.

## Hvorfor denne tilnærmingen

Vi vurderte tre alternativer:

| Tilnærming | Fordeler | Ulemper |
|------------|----------|---------|
| **A: Interaktivt kart** | Engasjerende, "prøv før du kjøper" | Ytelse, kompleksitet |
| **B: Statisk kart-bilde (valgt)** | Raskt, visuelt sterkt, enkel implementering | Ikke interaktivt |
| **C: Kun tekst + knapp** | Enklest | Mister visuell differensiering |

**Valgt: B** — Statisk kart er "godt nok" for å konvertere, og unngår ytelsesoverhead fra et ekstra interaktivt kart.

## Nøkkelbeslutninger

- **Plassering:** Mellom "Oppsummert"-seksjon og footer (inne i `ReportClosing.tsx` eller som ny komponent)
- **Visuelt:** Statisk Mapbox-bilde med alle POI-markører
- **Visningslogikk:** Kun vis når `explorerBaseUrl` er definert
- **USP-fokus:** Kombinasjon av "alle punkter på ett kart", "filtrer selv", og "lag egen liste"
- **Mål:** Både konvertering til Explorer og merkevarebygging for Placy-økosystemet

## Åpne spørsmål

- Skal Mapbox Static API brukes direkte, eller skal vi generere et bilde server-side?
- Hvilken visuell stil skal seksjonen ha? (Bør matche Report-designet)
- Skal det være animasjon/hover-effekt på CTA-knappen?

## Neste steg

→ `/workflows:plan` for implementeringsdetaljer
