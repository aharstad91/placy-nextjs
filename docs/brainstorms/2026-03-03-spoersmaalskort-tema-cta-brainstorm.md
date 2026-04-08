---
date: 2026-03-03
topic: spoersmaalskort-tema-cta
---

# Spørsmålskort — Tema-CTA med gjenkjennelige spørsmål

## Innsikt

Bransjeprofilen for Eiendom - Bolig har 7 temaer. Hvert tema har et "meglerens spørsmål" — setninger boligkjøpere faktisk tenker:

| Tema | Spørsmål |
|------|----------|
| Barn & Oppvekst | "Er det bra for barna?" |
| Hverdagsliv | "Hva kan jeg ordne i nærheten?" |
| Mat & Drikke | "Er det et levende nabolag?" |
| Opplevelser | "Er det noe å gjøre her?" |
| Natur & Friluftsliv | "Er det grønt i nærheten?" |
| Trening & Aktivitet | "Kan jeg trene i nærheten?" |
| Transport & Mobilitet | "Hvordan kommer jeg meg rundt?" |

**Kjernen:** Spørsmålene skaper gjenkjennelse. "Er det bra for barna?" trigger noe i hodet — "Barn & Oppvekst" er en arkivmappe. Spørsmålene er den emosjonelle inngangen, temanavnene er strukturen.

## Report-toppen: Fra turisme til bolig

### Problemet

Report-headeren ble designet da turisme var i fokus. Det henger igjen:
- **"NABOLAGSRAPPORT"** — generisk label som sier ingenting til en boligkjøper
- **Statistikk-raden** (97 steder, 4.1 rating, 7655 anmeldelser) — turisme-metrics
- **Tema-kortene** er informative men ikke inviterende — kategorinavn, ikke spørsmål
- **Introteksten** er lang og faktabasert — mangler emosjonell inngang

### Inspirasjon: bobroset.no

Brøset-utvikleren selger på **livskvalitet, ikke statistikk:**
- "I et område med like mye grøntareal som bebyggelse"
- "Gater uten biltrafikk gir frihet for barn"
- Tone: inspirerende, poetisk, fokus på følelse

**Placy skal ikke kopiere budskapet** (siden blir iframe-et inn), men **forme det slik at det fungerer i konteksten** — en interaktiv utforskning av nabolaget.

## Visuell design

### Stemning: Ren og premium
- Hvit/lysegrå bakgrunn
- Tema-farge kun som aksent (linje, ikon-farge, hover)
- Profesjonelt og high-end — passer å iframe inn hos eiendomsutviklere
- Ikke turisme-fargerikt, ikke startup-hyper

### Kort-format: Kompakte chips
Spørsmålene presenteres som kompakte, klikkbare chips — ikke store kort.

```
┌─Er det bra──┐ ┌─Hva kan jeg─┐ ┌─Er det et──┐ ┌─Er det noe─┐
│ for barna? ↓│ │ ordne?     ↓│ │ levende   ↓│ │ å gjøre?  ↓│
└─────────────┘ └─────────────┘ └─nabolag?───┘ └────────────┘
┌─Er det grønt┐ ┌─Kan jeg────┐ ┌─Hvordan────┐
│ i nærheten?↓│ │ trene?    ↓│ │ komme meg ↓│
└─────────────┘ └─i nærheten?┘ └─rundt?─────┘
```

### Typografi
- **Spørsmålet:** Sans-serif bold — tydelig, moderne, gjenkjennelig
- **Temanavn:** Vises som undertekst/tooltip, ikke primær visuell
- **Introtekst:** Sans-serif, emosjonell tone

### Interaksjon
- **Default:** Lys bakgrunn, subtil border, liten ↓ pil som scroll-hint
- **Hover:** Myk bakgrunnsfarge-endring (litt mørkere/varmere)
- **Klikk:** Smooth scroll til tema-seksjonen i rapporten

### Layout
- 4+3 chips over to rader (desktop)
- Alle 7 synlige uten scrolling
- Responsivt: wrapper på mobil

## White-label — prosjektnivå

Placy har et standard-design, men støtter visuell profil-tilpasning per prosjekt (ikke per kunde — en kunde kan ha flere prosjekter med ulik profil).

### Konfigurerbart (medium-nivå)
| Parameter | Beskrivelse | Eksempel |
|-----------|-------------|----------|
| Primærfarge | Knapper, aktive states, aksenter | Brøset grønn |
| Bakgrunnsfarge | Seksjonsbakgrunner | Lys beige |
| Font-valg | 2-3 godkjente fonter | Inter, DM Sans, system |
| Logo | Valgfri logo i header | Brøset-logo |

### Ikke konfigurerbart (Placy eier)
- Layout og grid
- Kort-format og chips-design
- Interaksjonsmønster (scroll, hover)
- Innholdsstruktur (seksjoner, rekkefølge)

**Prinsipp:** Kunden eier farger og brand. Placy eier UX og layout.

## Report-topp: Ny struktur

```
[Prosjektnavn]                              [NO | EN]

"Lurer du på hvordan det er å bo på Brøset?
 Utforsk nabolaget — fra skoler og lekeplasser
 til kafeer og turstier."

[chip] [chip] [chip] [chip]
[chip] [chip] [chip]
```

### Hva som fjernes
- ~~"NABOLAGSRAPPORT"~~ label
- ~~Statistikk-raden~~ (97 steder, 4.1 rating, 7655 anmeldelser, 20 transport)
- ~~Gamle tema-kort~~ med bare kategorinavn og rating

### Hva som erstatter
- **Emosjonell intro:** "Lurer du på hvordan det er å bo her?" — inviterende, varm
- **Spørsmåls-chips:** Kompakte, klikkbare, med ↓ pil
- **Klikk → smooth scroll** til tema-seksjonen

## Spørsmålskort — én komponent, to brukssteder

### Brukssted 1: Report-toppen
- Kompakte chips med spørsmål + ↓ pil
- Klikk → smooth scroll til tema-seksjonen
- Emosjonell inngang: "klikk på det du lurer på"

### Brukssted 2: WelcomeScreen
- Samme chip-design — gjenkjennelig
- Avkrysning (checkbox/toggle) i stedet for scroll-action
- Brukeren velger interesser via spørsmål, ikke kategorinavn
- Kobling: det du velger her, ser du igjen i rapporten

### Gjenkjennelseseffekten
Brukeren ser spørsmåls-chipsene på WelcomeScreen, velger "Er det bra for barna?". Deretter i Report ser de den SAMME chippen igjen — "ah, her er svaret på det jeg lurte på."

## Nøkkelbeslutninger

1. **Begge synlige:** Spørsmål som hovedtekst, temanavn som undertekst/tooltip
2. **Kompakte chips:** Ikke store kort — chips med spørsmålstekst
3. **Smooth scroll + ↓ pil:** Tydelig affordance for scrolling
4. **Sans-serif bold:** Spørsmålet i bold, tydelig og moderne
5. **Ren og premium:** Hvit/lysegrå, tema-farge kun som aksent
6. **White-label per prosjekt:** Primærfarge + bakgrunn + font + logo
7. **Fjern turisme-arv:** Statistikk-raden og "NABOLAGSRAPPORT" forsvinner
8. **Emosjonell intro:** Kort, varm, inviterende — ikke faktabasert
9. **Data fra bransjeprofilen:** Spørsmålene lever sammen med tema-config

## Åpne spørsmål

- Skal spørsmålene også brukes som seksjonsoverskrift i Report-bodyen?
- Fungerer spørsmålene like godt for andre bransjeprofiler (Hotell, Kommune)?
- Skal introteksten genereres per prosjekt, eller er en bransjeprofil-mal nok?
- Skal temanavn vises som tooltip on hover, eller fast undertekst?

## Neste steg

→ `/workflows:plan` for implementasjonsdetaljer
