# Brainstorm: Oppsummeringsblokk + Megler-CTA

**Dato:** 2026-04-10
**Status:** Ferdig — klar for /workflows:plan
**Scope:** Rapport (nabolagsrapport), bransje bolig først

## Bakgrunn og motivasjon

Dagens "Oppsummert"-seksjon nederst i rapporten er generisk LLM-prosa ("snitt på 4.2 stjerner viser at dette er et nabolag med jevnt god kvalitet på tilbudet"). Den er det siste brukeren leser og har størst potensial for å bli sterkeste touchpoint — men er i dag svakeste.

Rapporten skal flyttes fra "informasjonsside" til "lead-genererende salgsverktøy". For at megler/utvikler skal oppleve verdi, må rapporten konvertere interesse til kontakt. Nåværende versjon har ingen konverteringspunkter.

Parallell kontekst: Wesselsløkka-brandet variant bygges i separat worktree (`placy-ralph-wesselslokka-demo`) for å vise at Placy kan tilpasses visuelt til prosjektets egen identitet. Oppsummeringsblokken må være CSS-tema-bar slik at den brandede varianten kan bruke samme komponenter.

## Mål

Erstatte dagens "Oppsummert"-seksjon med en komposisjon av fire elementer:

1. **Skarp syntese-setning** — én setning som sier hva dette nabolaget _er_, som en megler ville sagt det høyt.
2. **3–5 kondenserte innsikter** — syntese, ikke repetisjon av data fra temaene.
3. **Megler-kort** — bilde, navn, tittel, telefon, e-post, primær CTA.
4. **Sekundær CTA** — deling (URL-kopi). PDF utsatt.

Blokken skal:
- Fungere som salgsverktøy (lead-genererende)
- Være gjenbrukbar på tvers av alle rapporter (bolig først, næring/hotell senere)
- Være CSS-tema-bar (må kunne overstyres av Wesselsløkka-demo)

## Låste beslutninger

### 1. Innholdskilde: Hybrid (D), start med manuell (C)

**Valg:** Manuell tekst i prosjekt-config for første demoer. Pipeline-generering (LLM-utkast under `generate-bolig`) kommer i senere iterasjon.

**Rasjonale:**
- Placy har ingen runtime LLM-kall — hard constraint fra brukerens produktfilosofi (kun abonnement, ingen API-nøkkel-avhengigheter).
- For første salgsmøte må kvaliteten være _perfekt_. Manuell redigering garanterer det.
- Pipeline-integrasjon er en påbygning som ikke bryter konseptet — den fyller samme felter automatisk når den kommer.
- Hybrid gir manuell overstyring selv etter pipeline-integrasjon: default = pipeline-utkast, kan overskrives per prosjekt.

**Schema (prosjekt-config):**
```yaml
summary:
  headline: "Brøset er for de som vil ha natur rett utenfor døren uten å gi opp bysentrum."
  insights:
    - "Halvparten av området er grøntareal — 7 parker innen gangavstand."
    - "12 minutter til Torget med buss, 5 minutter til Valentinlyst Senter."
    - "Skolekrets: Eberg barneskole, Blussuvoll ungdomsskole, Strinda VGS — alle innen gangavstand."
    - "95 tilbud innen gangavstand, snitt 4.2 stjerner."
    - "Matscenen er i utvikling — Moholt Allmenning vokser med studentbyen."
```

### 2. Megler-datamodell: Prosjekt-config med array (1..n)

**Valg:** Meglere lagres som array i prosjekt-config-filen. Hver megler er et objekt med standardiserte felter.

**Rasjonale:**
- Enkelt å starte — ingen ny Supabase-tabell eller migrasjon.
- Støtter fra dag én at et prosjekt har 1..n meglere (team).
- Kan migreres til egen tabell senere hvis meglere skal deles på tvers av prosjekter (samme megler på 5 prosjekter) — men det er premature nå.

**Schema:**
```yaml
meglere:
  - name: "Ola Nordmann"
    title: "Eiendomsmegler MNEF"
    phone: "+47 900 00 000"
    email: "ola@heimdal-eiendom.no"
    photo_url: "https://.../ola.jpg"
    office_name: "Heimdal Eiendomsmegling"
    office_logo_url: "https://.../logo.svg"  # valgfritt
```

### 3. CTA-handling: lead_url primær, mailto fallback (C)

**Valg:** Primær-CTA lenker til prosjektets eksisterende "Meld interesse"-side (f.eks. wesselslokka.no/meld-interesse) via `project.lead_url`. Hvis feltet mangler, fallback til `mailto:` med forhåndsutfylt subject/body.

**Rasjonale:**
- Mest realistiske salgsscenario: de fleste eiendomsprosjekter har allerede en landingsside med "Meld interesse". Vi spiller på lag med eksisterende infrastruktur — det er enklere for megler å si ja til Placy når vi ikke ber dem endre arbeidsflyten.
- Null ny backend — ingen form-handler, ingen edge function.
- Fallback sikrer at løsningen fungerer også for prosjekter uten landingsside.
- Ingen runtime-integrasjon med CRM eller skjema-tjenester nå (holder scope stramt).

**Schema:**
```yaml
project:
  lead_url: "https://wesselslokka.no/meld-interesse"  # optional
cta:
  primary_label: "Meld interesse"  # default, overstyrbar
  secondary_label: "Del rapporten"
```

Primær-knapp-copy er overstyrbar per prosjekt — default "Meld interesse", men kan byttes til "Book visning", "Snakk med megler", "Be om tilbud" (næring) osv.

### 4. Analytics: Utsatt

Bevisst utelatt fra denne iterasjonen. Skal spec'es separat. Merk at CTA-knapper og megler-kort bør ha stabile `data-*`-attributter fra dag én så tracking kan påbygges uten refactor.

## Komponentstruktur (foreløpig)

```
<SummarySection>
  <SummaryHeadline />        # syntese-setning
  <SummaryInsights />        # 3-5 bullets
  <MeglerBlock>              # array av meglere
    <MeglerCard × n />
  </MeglerBlock>
  <CTARow>
    <PrimaryCTA />           # lead_url eller mailto fallback
    <SecondaryCTA />         # share URL
  </CTARow>
</SummarySection>
```

Alle stylingverdier (farger, fonter, spacing) via CSS-variabler / Tailwind-tokens som kan overstyres på route-nivå, slik at Wesselsløkka-brandet variant kan overskrive uten å duplisere komponenter.

## Plassering

Erstatter dagens "Oppsummert"-seksjon nederst i rapporten, over footer med datakilder.

Vurderes senere: sticky megler-CTA i bunn/side av skjerm for å øke konvertering. Ikke med i denne iterasjonen — for risky for første demo.

## Åpne spørsmål (ikke-blokkerende)

- **Bransjeprofil-variasjon:** For næring vil "Meld interesse" være feil copy — det er "Be om tilbud". Støtte for copy-variasjon per bransjeprofil noteres, men implementeres når næringsrapport kommer.
- **PDF-generering:** Utsatt. Krever headless Chrome eller client-side print-CSS. Ikke MVP.
- **Megler-dashboard:** "X har sett rapporten, Y har klikket på meg" — fremtidig, påvirker ikke datamodell nå.
- **Sticky CTA:** Mulig iterasjon 2.
- **Insight-generering fra data:** Senere kan vi la pipelinen generere utkast basert på tema-stats (natur-andel, transport-dekning, snittrating). Sette opp felter nå, automatisering senere.

## Suksesskriterier

Dette er ferdig når:

1. Rapporten til Wesselsløkka viser alle fire elementer (headline, insights, megler-kort, CTA-rad) med reelle data.
2. Prosjekt-config har dokumenterte felter for `summary`, `meglere`, `project.lead_url`, `cta.*`.
3. Primær-CTA fungerer: klikk på "Meld interesse" går til wesselslokka.no/meld-interesse (eller mailto hvis URL mangler).
4. Sekundær-CTA fungerer: klikk på "Del rapporten" kopierer URL til clipboard med bekreftelse.
5. Komponentene bruker CSS-variabler slik at Wesselsløkka-demo kan overstyre styling uten å duplisere logikk.
6. Ingen Placy-branding i selve blokken (avsender er megleren/prosjektet).
7. Copy for Wesselsløkka er skrevet manuelt og reviewet før første demo.

## Avhengigheter og paralleller

- **Parallel stream (worktree placy-ralph-wesselslokka-demo):** Visuell rebranding av rapporten. Trenger samme komponentstruktur som denne blokken. Bør vente til denne planen er mergbar før integrasjonen gjøres — eller merges sammen på slutten.
- **Ikke blokkert av:** pipeline-endringer, LLM-integrasjon, nye backend-komponenter.
- **Blokkerer:** første salgsmøte med Heimdal Eiendomsmegling (brukeren vurderer dette ferdig nok til demo når oppsummering + branding er på plass).

## Ikke inkludert

- Analytics / event-tracking (utsatt)
- PDF-eksport (utsatt)
- Sticky CTA (utsatt)
- Pipeline LLM-generering av summary (fremtidig)
- Egen meglere-tabell i Supabase (prematur)
- Støtte for flere bransjeprofiler (bolig først)
- Form-handler backend (bruker eksisterende lead_url)
