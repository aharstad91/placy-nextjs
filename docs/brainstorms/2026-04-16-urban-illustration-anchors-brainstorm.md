# Brainstorm — Urban illustrasjonsankere og venue_context

**Dato:** 2026-04-16  
**Trigger:** Stasjonskvartalet-generering avdekket at suburban-ankre gir feil karakter for urbane prosjekter

---

## Problemet

Placy-illustrasjonspipelinen har 3 stil-ankre — alle suburban:
- `anchor-playground.jpg` — nærscene, liten bygning
- `anchor-cafe.jpg` — gatenivå, café, lav bebyggelse
- `anchor-wesselslokka.png` — bredere kompleks, park, rolig

For Wesselsløkka og lignende forstadsprosjekter er dette perfekt.
For Stasjonskvartalet (sentrum Trondheim, kaikant, 6-8 etasjer) gir det:
- Feil bygningsskala
- For mye grønt / for lite tetthet
- Suburban "rolig" stemning istedenfor urban "aktiv" stemning

Resultatet vi fikk var faktisk overraskende bra — men vi var heldige fordi Mønster B (stil-transfer) brukte kildebildet til å holde bygningsskalaen. For Mønster A (ny scene fra scratch) vil ankerne styre resultatet mer direkte.

---

## To distinkte visuell-karakterer

### Suburban
- Bygninger 2-4 etasjer
- Grønne omgivelser, hagegate-karakter
- Rolig tempo, få figurer
- Varm, nesten landlig palett
- Eksempel: Wesselsløkka, Moholt, Ranheim

### Urban
- Bygninger 5-8+ etasjer
- Tett bebyggelse, lite grønt i forgrunnen
- Aktiv kaikant, bygårdsgater, bytorg
- Mer grå/betong/tegl i kombinasjon, glass
- Figurer som signaliserer bylivstempo
- Eksempel: Stasjonskvartalet (Brattøra), Nedre Elvehavn, havneprosjekter

---

## Hvilke urban ankere trengs?

### Anker 1 — Urban waterfront/kaikant (FINNES ALLEREDE)
`public/illustrations/stasjonskvartalet-hero.jpg` er en perfekt kandidat:
- Korrekt høyde (6-8 etasjer)
- Havnepromenade, båter i forgrunnen
- To gående + sykelist i middle-ground
- Korrekt muted palett

**Handling:** Kopier som `assets/anchor-urban-waterfront.jpg`

### Anker 2 — Urban bygårdsgater (MANGLER)
Tett bykvartal sett fra gatenivå:
- 5-6 etasjer, kommersielt i 1. etg
- Fortau med folk, kafébordstoler ut mot gata
- Mer av tegl + pussede fasader
- Referanse: Norderhovgata, Nedre Elvehavn-gater, Kjøpmannsgata

### Anker 3 — Urban bypark/torg (VURDER)
Sentrumspark eller bytorg omringet av høy bebyggelse:
- Kontrasterer grønt mot urban bebyggelse rundt
- Nyttig for natur-friluftsliv-tema i byprosjekter
- Kan eventuelt droppes — anker 1+2 er sannsynligvis nok

**Beslutning:** Prioriter anker 2, vurder anker 3 som "nice to have".

---

## venue_context på projects

Enkelt enum-felt: `suburban | urban`

**Hva det styrer:**
1. Valg av illustrasjonsankere i generate-bolig Steg 11.5
2. Fremtidig: kan styre kart-stil, standardisert radius, etc.

**Vurderinger:**
- Standard: `suburban` (de fleste norske boligprosjekter er forstad)
- Kan infereres fra `discovery_circles.radiusMeters` (1500m = urban, 2500m = suburban) men eksplisitt er bedre
- Trenger migration + TypeScript-type

**Alternativ vurdert:** Bare lagre i generate-bolig uten DB — avvist fordi andre kode-paths kan ha nytte av det.

---

## generate-bolig pipeline-endringer

### Steg 0 (nytt spørsmål):
> "Er dette et urban (sentrum, kaikant, tett bebyggelse) eller suburban (forstad, rolig nabolag) prosjekt?"

`venue_context = "urban" | "suburban"` — brukes i Steg 3 (project INSERT) og Steg 11.5

### Steg 3:
Legg til `venue_context` i projects-INSERT

### Steg 11.5 (endret anker-logikk):
```
if venue_context == "urban":
    refs: [source_image, anchor-urban-waterfront.jpg]
    # alternativt: legg til anchor-urban-street.jpg for bredere stil-lock
else:
    refs: [source_image, anchor-wesselslokka.png]
```

---

## Prompt-tilpasninger for Mønster A (urban)

Eksisterende Mønster A er skrevet for suburban (norsk urban-forstad). For urban trenger vi justeringer:

```diff
- BUILDINGS (realistic Norwegian mixed-use, 3-4 stories, commercial ground floor + apartments above)
+ BUILDINGS (dense Norwegian urban mixed-use, 5-7 stories, commercial ground floor + apartments above, 
+            some modern glass facades alongside traditional brick)

- Large deciduous trees with loose watercolor foliage framing the scene
+ Minimal vegetation — perhaps a lone tree or planter box at street level

- BACKGROUND: Soft sky — mostly white paper showing through
+ BACKGROUND: Compressed urban skyline, buildings close together, sky visible only at top
```

**Konklusjon:** Mønster A-tilpasning dokumenteres i prompt-patterns.md som "Urban variant".

---

## Scope-beslutninger

| Komponent | Inkludert? | Begrunnelse |
|-----------|-----------|-------------|
| Urban anker 1 (waterfront) — kopier fra eksisterende | ✅ | Gratis, høy kvalitet |
| Urban anker 2 (bygårdsgater) — generer ny | ✅ | Nødvendig |
| Urban anker 3 (bytorg/park) — generer ny | ⚠️ Nice-to-have | Vurder etter anker 2 |
| DB migration for venue_context | ✅ | Liten innsats, høy verdi |
| TypeScript-type oppdatering | ✅ | Nødvendig |
| SKILL.md oppdatering | ✅ | Dokumentasjon |
| generate-bolig.md oppdatering | ✅ | Pipeline-endring |
| Urban Mønster A i prompt-patterns.md | ✅ | For fremtidige standalone-scener |
| Oppdatere Stasjonskvartalet med venue_context | ✅ | Lav innsats |

---

## Tekniske risiki

**Lav risiko generelt.** Illustrasjonsgenerering er idempotent — hvis ankeret ikke er bra, re-genererer vi.

Eneste risiko: Gemini-modellen kan ignorere ankre ved stil-transfer (Mønster B). Da hjelper det å legge til flere ankre. Testet i dag — Stasjonskvartalet ble bra.

---

## Anbefalt rekkefølge

1. Kopier `stasjonskvartalet-hero.jpg` → `anchor-urban-waterfront.jpg` (30 sek)
2. Generer `anchor-urban-street.jpg` fra scratch (Mønster A, urban variant)
3. Vurder anker 3 (bytorg) basert på resultat fra anker 2
4. Migration 066_add_venue_context.sql
5. Oppdater TypeScript-typer
6. Oppdater SKILL.md + prompt-patterns.md
7. Oppdater generate-bolig.md (Steg 0 + Steg 3 + Steg 11.5)
8. Sett venue_context='urban' på Stasjonskvartalet
