---
name: manus-curator
description: Skriv manus per kategori for rapport-produktet i v3-format. 0 POI-navn (unntak: skolekrets), 5 setn, ~65-75 ord, 20-25 sek TTS. Bygger på Gemini-grounding som fact-feed og arver stemme fra curator-skill. Erstatter generate-rapport-skillen.
triggers:
  - manus-curator
  - skriv manus
  - generer manus
  - rapport-spor
  - kategori-manus
  - spor-tekst
  - skriv kategori-tekst
---

# Manus-Curator — V3 Rapport-spor

**Modell:** Krever skjønn. Bruk Opus.

Produserer ett samlet manus per kategori i Placys rapport-produkt (v3). Manuset er den **kanoniske teksten** — det driver både skjerm-overlay, voice-over (ElevenLabs turbo_v2_5) og karaoke-effekt. Erstatter lead/body-formatet som ble forkastet 2026-05-21.

## V3-premiss: begrenset innsikt + automasjon

Gemini gir oss fact-feed. Vi destillerer ned, ikke gjengir. **Gemini vet mye; manus-curator sier lite.**

Konsekvens: vi beskriver *tilbudet* og *karakteren* til et område, ikke kuraterer *merker*. Et nabolag har en mat-scene, en natur-scene, en transport-scene — vi sier hva som finnes, ikke hvor man bør gå.

## Hard rules (kvantitative)

Tall slår regler. Disse er ufravikelige uten eksplisitt unntak.

| Regel | Verdi | Unntak |
|---|---|---|
| Antall POI-navn | **0** | Skolekrets (grunnskole + ungdomsskole + VGS = 3 navn er hele poenget) |
| Setninger | 5 (cap) | — |
| Ord | 60–75 | Intro kan være kortere hvis tease er kortfattet |
| TTS-lengde | 20–25 sek | Kalibrering: 55 ord ≈ 21 sek på Erik turbo_v2_5 norsk |
| Em-dashes som pause | 0 | Bruk komma eller kolon |
| Parenteser | 0 | — |
| Banned-superlativer | 0 | Se curator-skill |

**Områdenavn (Midtbyen, Bakklandet, Solsiden, Stasjonskvartalet, fjorden, Nidelva) er trygge** — de er stabile geografiske referansepunkter, ikke POIs. Bruk fritt der det gir navigerings-anker.

## Stemme — arver fra curator

For stemme, prinsipper og banned-ord: se `.claude/skills/curator/SKILL.md`. Ikke duplisér her — det blir drift.

**Tilleggsregler spesifikke for manus-format (utover curator):**

1. **Tidsregelen som hovedport.** Hvert utsagn må passere: *"Vil dette være sant om 2 år?"* Hvis nei, omformuler eller dropp. Curator har den som ett av ni punkter — i manus-format er den **første** sjekken.
2. **Grounding-troskap.** Hvis grounding sier "ett", ikke skriv "flere". Hvis grounding ikke sier "hvor", ikke legg til plassering. Hedging via flertall ("Michelin-stjernede kjøkken") er OK når grounding støtter ≥2.
3. **Direkte > fancy.** Hvis en setning trenger en forklaring etter seg, omformuler. "Hører til hverdagen, ikke til unntakene" er cheesy. "Det finnes flere etablerte" er direkte.
4. **Liste over konstruerte ruter.** Når grounding bare navngir områder, list dem ("Midtbyen, Nedre Elvehavn, Solsiden og Bakklandet"). Ikke konstruér geografiske ruter ("fra X over Y til Z") med mindre du kan dokumentere rekkefølgen.

## TTS-vennlighet (Erik / eleven_turbo_v2_5 / norsk)

- **Stedsnavn-budsjett:** Områdenavn OK, men minimer komplekse sammensetninger. "Kollektivknutepunktet" er 6 stavelser og kan tripping ElevenLabs. Foretrekk "knutepunktet" eller "togstasjonen".
- **Naturlig pust:** Variér setningslengder (typisk 7–20 ord). Unngå klumper på 25+ ord uten naturlige komma-pauser.
- **Tall:** Skriv "ti minutter", ikke "10 minutter" — bedre uttale.
- **Aldri:** em-dash som pause, parenteser, hashtag-stil-aksenter.

## Strukturmønstre — velg per kategori-shape

Format må tilpasses kategoriens natur. Det er ingen ett-template-passer-alle.

### Mønster A: Intro (Nabolaget)
**Når:** Det første sporet i rapporten.
**Form:** Velkommen + geografisk orient + karakter + tease av kategoriene.
**Eksempel:** Se Nabolaget i `references/anker-eksempler.md`.

### Mønster B: Hierarki (Mat & Drikke, evt. Trening)
**Når:** Tilbudet har et naturlig topp/midt/uformelt-spenn.
**Form:** Geo-anker → "På toppen står X. Under finnes Y. På Z-siden finnes..."
**Eksempel:** Mat & Drikke. Michelin → italiensk/middelhavs/norsk → sushi/thai/burger → kafé/bakeri → nabolagskafé.

### Mønster C: Akser (Natur & Friluftsliv, evt. Transport)
**Når:** Tilbudet har flere parallelle dimensjoner uten innbyrdes rangering.
**Form:** Tema-ramme (to retninger) → akse 1 → akse 2 → akse 3 → akse 4.
**Eksempel:** Natur. Vann + parker + elv + bading som fire separate akser.

**Hvis kategorien ikke passer noen:** Default til akse-mønster. Mer ærlig enn å konstruere et hierarki som ikke finnes.

## Pipeline — fra grounding til ferdig manus

### Steg 1: Hent grounding fra Supabase
```bash
source .env.local && curl -s \
  "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/products?id=eq.<product_id>&select=config" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" | \
  jq '.[0].config.reportConfig.themes[] | select(.id == "<theme-id>")'
```

Henter: `grounding.narrative` (Gemini fact-sheet), `leadText` (legacy POIs nevnt), `bridgeText` (kort intro), `audio.manus` (eksisterende manus å sammenligne mot).

### Steg 2: Identifiser hva grounding faktisk støtter
Lag mental liste av påstander grounding bekrefter ordrett eller via konkrete eksempler. Alt utenfor denne listen er overreach — dropp eller hedge.

### Steg 3: Velg strukturmønster
Hierarki vs akser vs intro. Hvis usikker: akser.

### Steg 4: Skriv 5 setninger
Variér lengder (7–20 ord). Naturlig pust. Direkte.

### Steg 5: Sjekkliste mot hard rules
- [ ] 0 POI-navn (eller dokumentert skolekrets-unntak)
- [ ] 5 setninger
- [ ] 60–75 ord
- [ ] Hvert utsagn passerer tidsregelen
- [ ] Hver påstand kan dokumenteres mot grounding
- [ ] Ingen em-dashes, parenteser, banned-superlativer
- [ ] Setn-lengder varierer naturlig

### Steg 6: Sammenlign mot ankereksempel
Velg nærmest match (Mat/Natur/Nabolaget). Lander tonen samme nivå? Hvis ikke, juster.

### Steg 7: Lagre i staging
`.curation-staging/<prosjekt>/<spor>.md` med frontmatter (struktur, ord, motiv-ekko, grounding-fakta brukt). Brukerens beslutning før patching til Supabase.

## Anchor-eksempler

Tre validerte eksempler i `references/anker-eksempler.md`. **Les minst ett før du skriver et nytt manus** — det sparer 8–10 iterasjoner.

| Spor | Mønster | Ord | Sek | Hva det viser |
|---|---|---|---|---|
| Nabolaget | Intro | 64 | 25 | Velkommen + orient + tease |
| Mat & Drikke | Hierarki | 70 | 26 | Topp→midt→uformelt-struktur |
| Natur & Friluftsliv | Akser | 62 | 23 | 4 parallelle akser uten rangering |

## Anti-eksempler (ikke skriv slik)

Det opprinnelige Stasjonskvartalet-manuset (vanilla Gemini/Claude uten curator-stemme) er rikt på anti-pattern. Ett konkret eksempel fra Mat & Drikke før:

> "Du bor midt i smørøyet av Trondheims matkultur, med kort gangavstand til populære spisesteder på Solsiden og i Midtbyen..."

Hva som er galt: "i smørøyet" (klisjé), "populære" (subjektivt), 4 stedsnavn (Solsiden, Midtbyen, Brattøra, "historiske brygger"), du-narrativ. Se `references/anti-eksempler.md` for flere.

## Scope-deferred

- **Outro / kontakt-megler-CTA:** Ikke håndtert ennå. Krever egen anchor + utvidelse av `ReportConfig`-type (`outroText`, `outroAudio`). Tas opp i egen runde.
- **English translation:** Drop for nå. Norsk-only manus.
- **Skole-unntaket (Barn & Oppvekst):** Regelen finnes, men ikke testet. Første prøve-kjøring av denne skillen *bør* være Barn & Oppvekst nettopp for å validere unntaket.

## Migrasjon fra generate-rapport

`.claude/skills/generate-rapport/SKILL.md` antar lead/body-format som er dødt. Når manus-curator er validert på alle 7 spor for Stasjonskvartalet, slett `generate-rapport/` (kodebase-hygiene-regelen: "når du bygger noe nytt som erstatter noe gammelt, slett det gamle umiddelbart").

Det som overlever migrasjon:
- `scripts/gemini-grounding.ts` (infrastruktur, ikke skill)
- Senter-type-disambiguering, meter→tid, is_chain-gotchas fra `references/anti-patterns.md` → flytt til denne skillens references hvis relevante
- Curator-skillen (`.claude/skills/curator/`) — urørt

## Referanser

| Fil | Innhold |
|---|---|
| `references/anker-eksempler.md` | 3 validerte manuses med metadata og struktur-noter |
| `references/anti-eksempler.md` | Vanilla-LLM-tekster med konkret diagnose per setning |
| `.claude/skills/curator/SKILL.md` | Stemme, prinsipper, banned-ord (arvet) |
| `scripts/gemini-grounding.ts` | Henter fact-feed per kategori via Google Search |
