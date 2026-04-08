# Interaktiv Storytelling — "Story Mode" for Placy

**Dato:** 2026-04-07
**Status:** Brainstorm ferdig, klar for plan

## Hva vi bygger

En ny, frittstående Placy-opplevelse der områdeinnhold presenteres som **interaktiv storytelling** — en hybrid feed med chat-lignende tekstelementer, rike POI-kort, kart-snippets og valgknapper som lar brukeren forme reisen.

**Konseptnavnet:** Conversational scrollytelling / Story Mode

**Ikke:** En AI-chat med fri tekstinput. **Er:** Pre-komponert innhold som avdekkes progressivt med brukervalg underveis.

## Hvorfor denne tilnærmingen

- **Chat-estetikk er kjent og engasjerende** — folk er vant til meldingsflyt fra ChatGPT, iMessage, Instagram DM. Formatet føles moderne på mobil.
- **Interaktivitet uten runtime LLM** — mikro-valg og scroll-reveal gir engasjement uten API-kall. All data eksisterer allerede (POI-er, temaer, editorial hooks).
- **Bedre enn statisk rapport** — dagens Report viser alt på en gang. Story Mode avdekker steg for steg, skaper nysgjerrighet og holder oppmerksomhet.
- **Skalerbart** — en template-drevet rytme fungerer for alle områder med POI-data, uten manuell kuratering per prosjekt.

## Målgruppe

**Boligkjøpere** som mottar en Placy-lenke fra megler. Erstatter/supplerer Report som den primære måten å oppleve et område på.

## Brukerflyt

```
1. Lander på adresse (megler-lenke)
2. Kort intro — "La oss utforske området rundt [adresse]"
3. Tema-velger — velg hva du vil utforske først (Barn & Oppvekst, Mat & Drikke, etc.)
4. Story-stream starter:
   a. Chat-boble: "Her er de beste [tema]-stedene i nærheten"
   b. POI-kort #1 avdekkes (bilde, navn, avstand, kort beskrivelse)
   c. POI-kort #2 og #3 avdekkes ved scroll
   d. Mikro-valg: "Vil du se flere, eller utforske neste tema?"
   e. Basert på valg → flere POI-er eller tema-overgang
5. Oppsummering — "Her er ditt område oppsummert" med favoritter/highlights
```

## Story-rytme (template)

```
intro → tema-velger → [tema-intro → poi × 3 → valg → poi × 3 → tema-oppsummering] × N → total-oppsummering
```

### Komponenttyper i feeden

| Type | Beskrivelse | Visuelt |
|------|-------------|---------|
| **ChatBubble** | Tekst fra "Placy" — intro, overganger, fakta | Meldingsboble, venstrejustert |
| **POICard** | Sted med bilde, navn, avstand, kategori, editorial hook | Stort kort, fyller bredden |
| **MapReveal** | Mini-kart som zoomer inn og viser POI-markører | Kart-embed med animasjon |
| **ChoicePrompt** | 2-3 valgknapper som former resten av streamen | Knapper høyrejustert (som "brukerens svar") |
| **FactBubble** | Kort faktum om området (gangavstand, antall skoler, etc.) | Kompakt boble med ikon |
| **ThemeBridge** | Overgang mellom temaer | Subtil separator med ny tema-intro |
| **Summary** | Oppsummering med highlights | Kort-grid eller liste |

## Interaksjonsmodell

- **Scroll & reveal:** Kort animeres inn ved scroll (intersection observer). Passivt engasjerende.
- **Mikro-valg:** Valgknapper som filtrerer/sorterer kommende innhold. Ikke branching-logikk, men enkel filtrering.
  - "Kafeer eller restauranter?" → viser relevante POI-er
  - "Se flere eller neste tema?" → fortsett eller hopp
  - "Hva er viktigst — nærhet eller kvalitet?" → sorterer POI-er
- **Tap for detaljer:** Trykk på POI-kort for expanded view med mer info.

## Visuell stil

**Hybrid feed** — variasjon holder det interessant:
- Noen elementer har chat-estetikk (bobler, avrundede hjørner, "Placy"-avatar)
- Andre er rike mediakort (store bilder, kart)
- Valgknapper ser ut som brukerens "svar" (høyrejustert, annen farge)
- Mobil-først, fullbredde kort, generous whitespace

## Nøkkelbeslutninger

1. **Ny opplevelse** — ikke erstatning av Explorer, Guide eller Report
2. **Template-drevet (Tilnærming A)** — en story-rytme som mal, ikke håndkuratert per prosjekt
3. **Scroll & reveal + mikro-valg** — passiv scrolling med aktive valgpunkter
4. **Hybrid feed** — blander chat-bobler med rike kort for variasjon
5. **Boligkjøpere via megler** — klar forretningscase, eksisterende data
6. **Ingen runtime LLM** — all data er pre-generert, valg er filtrering/sortering

## Åpne spørsmål

- **Navn på produktet?** "Story Mode", "Discover", "Utforsk", noe annet?
- **URL-struktur?** `/for/[kunde]/[prosjekt]/story`? Eller egen rute?
- **Deling?** Kan brukeren dele sin "reise" (med valgene de tok)?
- **Animasjoner?** Hvor fancy? Enkle fade-ins eller mer utarbeidede scroll-animasjoner?
- **Kart-integrasjon?** Alltid synlig mini-kart, eller bare i MapReveal-blokker?
- **Desktop?** Mobil-først, men hva med desktop-opplevelsen?
- **Data-krav?** Fungerer det for områder med få POI-er? Hva er minimum?

## Inspirasjonskilder

- **Quartz (app)** — nyheter som chat-bobler du tapper gjennom
- **Typeform** — vakre spørsmål-for-spørsmål flows
- **Instagram Stories** — tap-to-advance, visuelt rikt
- **Duolingo** — leksjoner som føles som samtale
- **Apple Guided Tours** — premium, steg-for-steg produktpresentasjoner
