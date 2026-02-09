---
topic: "Trip Library PRD — Åpne temaer (Del 3)"
date: 2026-02-09
status: decided
related_prd: docs/plans/2026-02-09-prd-trip-library-platform.md
---

# Trip Library PRD — Åpne temaer brainstorm

## Hva vi diskuterte

Gjennomgang av alle 8 åpne diskusjonstemaer i PRD Del 3. Målet var å avklare nok til å starte implementering (Fase 1).

## Beslutninger

### 3.1 Innholdsproduksjon
**→ AI + manuell kurering, inspirert av `generate-hotel` script.**
- Eksisterende autonom pipeline fungerer godt som modell
- AI genererer utkast, Placy kurerer og finjusterer
- Revideres fortløpende

### 3.2 Versjonering
**→ Live updates + varsling.**
- Endringer propageres umiddelbart
- Hoteller varsles om endringer
- Ingen versjon-pinning (for komplekst, for lite behov)

### 3.3 Sesong
**→ Egen `season`-kolonne (spring/summer/autumn/winter/all-year).**
- Placy styrer synlighet manuelt
- Ingen auto-aktivering basert på dato
- Kunder/hoteller har ingen sesong-kontroll

### 3.4 Brukeropplevelse
**→ Progress tracking + completion. LocalStorage.**
- Gjest markerer stopp som besøkt
- Completion → vis reward-kode
- localStorage, ingen innlogging
- Gamification (poeng, streaks) i fase 4

### 3.5 Analytics
**→ Placy-intern først.**
- Standard analytics (Vercel) i MVP
- Vurder event-tracking i fase 2-3
- Kundevendt dashboard er fase 4+

### 3.6 Cross-product
**→ POI-kobling + felles ProductNav.**
- "Del av: Trondheim Byvandring" i Explorer ved delte POI-er
- ProductNav med tabs fungerer allerede
- Dypere integrasjon vurderes senere

### 3.7 Monetisering
**→ Pakkestruktur ønsket, men EGEN BRAINSTORM-SESSION.**
- Retning: Basis/Premium/Enterprise
- Detaljer besluttes separat
- Ikke blokkerende for fase 1

### 3.8 Rettigheter
**→ Placy gjør alt. Enterprise-features senere.**
- Kun Placy oppretter/redigerer trips
- Ingen kundeadmin i MVP
- Enterprise-rettigheter vurderes etter lansering

## Åpne spørsmål (gjenstår)

- Monetisering/prising krever egen brainstorm-session
- Varslingssystem for versjonering (e-post? admin-notifikasjon?) — detaljer avklares i implementering

## Work Packages (besluttet)

3 sekvensielle WP-er:
1. **WP1: Database + Queries + Data-migrasjon** — kan startes nå
2. **WP2: Trip-opplevelsen (gjestesiden)** — avhenger av WP1
3. **WP3: Admin + Trip Editor** — avhenger av WP1, kan parallelliseres med WP2

## Neste steg

PRD er oppdatert med alle beslutninger og work packages. **WP1 kan startes.**

Kjør: `/workflows:plan docs/plans/2026-02-09-prd-trip-library-platform.md` for å lage implementeringsplan per WP.
