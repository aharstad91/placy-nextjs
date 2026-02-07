# Brainstorm: Flytt POI-import til prosjektnivå

**Dato:** 2026-02-07
**Status:** Besluttet

## Hva vi bygger

Flytte POI-import fra en selvstendig admin-side (`/admin/import`) inn som en tab på prosjektdetaljsiden (`/admin/projects/[id]`). Import blir kontekstuell — alltid knyttet til et spesifikt prosjekt.

## Hvorfor denne tilnærmingen

- **Naturlig arbeidsflyt:** Import hører til prosjektkontekst. Discovery circles er allerede definert per prosjekt, og importerte POI-er knyttes til prosjektet.
- **Renere admin:** Fjerner en frittstående side som uansett krevde prosjektvalg. Én måte å gjøre ting på.
- **Logisk gruppering:** POI-er og Import er relatert — begge handler om prosjektets POI-samling.

## Nøkkelbeslutninger

### 1. Tab-rekkefølge: Mest til minst brukt
```
Detaljer → Produkter → POI-er → Import
```
Import brukes typisk i oppstartsfasen og sjeldnere enn de andre tabs.

### 2. Selvstendig import-side fjernes
`/admin/import` slettes helt. Ingen redirect, ingen parallell side. Import skjer kun fra prosjektkontekst.

### 3. Global POI-admin beholdes
`/admin/pois` forblir som "poi-pool" for manuell registrering. Import og manuell opprettelse er to ulike arbeidsflyter.

### 4. Discovery circles: Ingen spesialhåndtering
Prosjekter uten definerte discovery circles håndteres ikke — de er et fåtall som uansett slettes. Import-tabben forutsetter at circles er definert.

### 5. Import-logikk gjenbrukes
Selve import-APIet (`/api/admin/import`) og forretningslogikken endres ikke. Kun UI-laget flyttes fra selvstendig side til tab-komponent.

## Scope

**In scope:**
- Ny "Import" tab på prosjektdetaljsiden
- Flytte import-UI fra `import-client.tsx` til prosjektkontekst
- Fjerne prosjektvelger (prosjektet er implisitt)
- Bruke prosjektets discovery_circles direkte
- Fjerne `/admin/import` rute og sidebar-lenke
- Reorder tabs: Detaljer → Produkter → POI-er → Import

**Out of scope:**
- Endringer i import-API
- Endringer i discovery circles editor
- Endringer i global POI-admin
- Håndtering av prosjekter uten discovery circles

## Åpne spørsmål

Ingen — alle beslutninger er tatt.
