# Nyhavna Leve — strukturelt datainventar

Kontrollgrunnlaget er snapshot `nyhavna-cd2c134428c48325`, SHA-256
`cd2c134428c483254606ee23b6692366731c76d8ab9303229af462e94a1302f9`.
Det er bygget fra produksjonens read-only v2-lesesti og deretter kjørt gjennom
`buildLeveProject`, `transformToReportData` og `adaptBoardData`. Snapshotet
inneholder ingen service-role-nøkkel og ingen Supabase-skriving er utført.

## Avstemming

| Lag | Antall |
| --- | ---: |
| Prosjekt-POI-er, totalt | 1 325 |
| Toppnivå-POI-er | 1 071 |
| Nestede barn | 254 |
| Prosjektkategorier | 42 |
| Prosjekttemaer | 10 |
| Report-temaer | 10 |
| POI-referanser i report | 1 060 |
| Board-kategorier | 10 |
| POI-referanser i board | 1 060 |
| Unike POI-ID-er i board | 1 036 |
| Ikke-plasserte omtaler | 8 |

Det komplette, maskinlesbare manifestet ligger sammen med prosjektet i
`data/demo/nyhavna-snapshot.json`. Det fører alle ID-er gjennom hvert lag,
inkludert de 254 barna. Forskjellen mellom board-referanser og unike ID-er er
24 krysstema-referanser; de er bevart i manifestet.

## Synlige revisjonskandidater og hull

- Ingen dupliserte POI-ID-er ble funnet. 47 normaliserte navn forekommer på mer
  enn én POI-ID og er beholdt som revisjonskandidater i manifestet.
- Alle 1 325 POI-er har koordinater.
- 1 318 grunn-POI-er mangler `editorialSources`; de syv Leve-POI-ene har én
  kildehenvisning hver. Dette sier bare hva datastrukturen inneholder, ikke at
  de øvrige stedene er kildekontrollert.
- Ingen av de 1 325 POI-postene bærer en feltvis kontrolldato. Leve-kildenes
  globale hentetid finnes i kildefilen, men er ennå ikke koblet til hver
  faktapåstand. Denne koblingen og kildekvalitetsvurderingen tilhører U2.
- De åtte omtalene uten sikker kartplassering er bevart som tekst, uten
  oppdiktede markører.

Dette er en full strukturell avstemming, ikke en erklæring om at fakta eller
kilder er bekreftet.

Regenerering:

```bash
NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env.local scripts/nyhavna-demo-inventory.ts
```

## Oppfølging i implementeringen

Det opprinnelige inventaret over 1 325 poster er beholdt over som innlesingsbevis. Den lokale, fryste demoversjonen har nå 1 324 POI-er: den doble Google-identiteten for Dora Kaffebar er slått sammen med `leve-dora-kaffebar`. Det gamle ID-et kan fortsatt slås opp som alias i kunnskapsverktøyet. Sammenslåingen er eksplisitt ført i kontrolloversiktens `mergedRecords`; ingen rad er endret i den delte databasen.

Siste versjon: `nyhavna-b7ed5e938bf23ab5`. Ferdig adaptert board har 1 059 referanser til 1 035 unike POI-ID-er. De 7 kuraterte kartstedene har separat faktakontroll; de 1 317 øvrige kartstedene brukes ikke som autoritet for agentens faktasvar. Hele inngangen er vurdert for kildebelegg og agenttilgang, men dette er ikke en faktasertifisering av alle gamle beskrivelser eller geometrier. Områdefakta og 8 ikke-plasserte omtaler inngår i den separate [kildekontrollen](curated-source-audit.md).

Både ny innlesing og kuratert oppfriskning bruker nå samme snapshot-skriver, slik at snapshot-ID, full kontrolloversikt og eksplisitte sammenslåinger blir oppdatert sammen. Runtime avviser en kontrolloversikt med feil versjon. En egen test sammenligner kuratert kildekode med snapshotet for å fange en glemt oppfriskning.
