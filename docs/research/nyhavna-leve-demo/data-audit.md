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
