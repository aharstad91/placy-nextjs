# Brainstorm: Trips — Kontinuerlig forbedring av Scandic Nidelven-demoen

**Dato:** 2026-02-15
**Kontekst:** 6 turer seedet og koblet til Scandic Nidelven med overrides. Teknisk fundament er komplett — kjerneopplevelsen fungerer. Men innholdet er dummy-data, cover images mangler, og mobil-UX er bare responsiv hack.

---

## Hva vi bygger

**To ting:**
1. En **Trip Curator-workflow** — en prosess der kuratoren gir inspirasjon, tema og retning, og Claude bygger komplette turer med research-verifisert innhold
2. **6 polerte turer for Scandic Nidelven** — fra dummy til salgbar demo

### Kjerneinnsikt fra samtalen

1. **Data først, design etterpå.** Du kan ikke designe god mobil-UX uten realistisk innhold å designe rundt. Explorer og Report har dette — Trips mangler det.
2. **Scandic som kjøper er primærmottaker.** Demoen må overbevise en Scandic-kontakt som åpner linken på telefonen.
3. **6 turer er nok — polish dem.** Bredde er ikke problemet. Kvalitet per tur er det.
4. **Mobil-UX er en separat designoppgave.** Adaptive designs må lages av designer, ikke bare responsive breakpoints.
5. **Curator-skillen dekker ikke Trip-tekster ennå.** `transition_text` og `local_insight` per stopp er nye teksttyper som trenger egne retningslinjer.

---

## Trip Curator-workflow (den store innsikten)

Spørsmålet er ikke "hvordan polere 6 turer" — det er **"hvordan lage en kreativ prosess for å produsere gode turer".**

### Kurator-input (det du gir)

1. **Inspirasjonskilder** — URL-er til artikler, guider, lister (f.eks. [Visit Trondheim: Topp 10 aktiviteter for barn](https://visittrondheim.no/inspirasjon/topp-10-aktiviteter-for-barn-i-trondheim/))
2. **Tema + constraints** — kategori, varighet, must-have-stopp, startpunkt
3. **Redaksjonell retning** — stemning, målgruppe, tone ("eventyrlig for 5-åringer, ikke Wikipedia-tørt")

### Claude leverer

- Komplett tur med research-verifiserte stopp
- Transition-tekster mellom hvert stopp
- Local insights per stopp
- Forslag til cover image (basert på tema)
- Seedet til DB som **upublisert draft**

### Kurator-loop

1. Claude lager utkast → seeder til DB (draft)
2. **Du åpner turen i browser** og ser den visuelt i kontekst
3. Du gir feedback ("bytt stopp 3, skriv om transition 2, tonen er for formell")
4. Claude reviderer → du sjekker igjen
5. Når du er fornøyd → publisér

**Nøkkelprinsipp:** Du reviewer visuelt i UI-et, ikke i et markdown-dokument. Det er enklere å vurdere kvalitet når du ser turen slik gjesten ser den.

---

## Valgt tilnærming: A+C Hybrid

### Steg 1: Én tur perfekt (Bakklandet & Bryggene)

Velg den mest ikoniske turen — Bakklandet & Bryggene — og gjør den komplett med Trip Curator-workflowen:

- **Research hvert stopp** med WebSearch (som restaurant-kuratoren)
- **Skriv transition_text** i 3-4 varianter for å finne riktig tone
- **Skriv local_insight** på Curator-nivå (spesifikt, mennesker, datoer)
- **Kuratér cover image** manuelt (egne foto / Unsplash)
- **Test hele flyten** fra bibliotek → intro → stopp → completion
- **Identifiser mobil-pain-points** som input til designfasen

### Steg 2: Definer Curator-nivå for Trips

Basert på Bakklandet-erfaringen, utvid Curator-skillen med:

- **transition_text:** Teksttype-spesifikasjon (tone, lengde, hva den skal oppnå)
- **local_insight per stopp:** Skilles fra POI-hook — mer "du står her, visste du at..."-karakter
- **Trip description:** Oppsummering av hele turen (brukes i bibliotek-kortet)
- **Welcome text:** Per-hotell velkomsttekst (brukes i overrides)

### Steg 3: Appliser på resterende 5 turer

Med Curator-mal og referanse-tur klar, kjør workflowen for resten.

---

## Beslutninger

| # | Beslutning | Begrunnelse |
|---|-----------|-------------|
| 1 | **Trip Curator-workflow** som kreativ prosess | Turer trenger inspirasjon + retning + research, ikke bare datamigrering |
| 2 | **Kurator gir URL + tema + tone** → Claude bygger | Balanserer kreativ kontroll med effektivitet |
| 3 | **Visuell review i browser** (ikke markdown) | Enklere å vurdere kvalitet i kontekst |
| 4 | **Draft → feedback → revisjon → publisér** | Iterativ loop med kurator i kontroll |
| 5 | Data/innhold først, mobil-design etterpå | Kan ikke designe uten realistisk innhold |
| 6 | Scandic (kjøperen) er primærmottaker | Demoen skal selge, ikke bare fungere |
| 7 | 6 turer, polish — ikke flere | Kvalitet > kvantitet for demo |
| 8 | A+C hybrid: én perfekt tur → mal → resten | Lærer av dybde, appliserer på bredde |
| 9 | Cover images: manuelt kuratert (egne/Unsplash) | Autentiske bilder > AI-genererte |
| 10 | Transition-tekst tone: må prøves | Tre varianter for Bakklandet, velg basert på opplevelse |
| 11 | **Fjern rewards fra demo** | Unngå falske løfter. Vis konseptet separat, ikke med placeholder-koder |

---

## Åpne spørsmål

### Transition-tekst tone (uavklart — må prøves)
Tre kandidater:
1. **Veibeskrivelse + teaser:** "Gå langs elva i 3 min. Etter brua skimter du en baksteingård fra 1880 — neste stopp."
2. **Ren storytelling:** "Nidelva følger deg nordover, forbi bryggene der trelasthandlerne holdt til."
3. **Hybrid:** Start med retning, gli over i kontekst. La kartet navigere, teksten gi mening.

→ Skriv alle tre for Bakklandet-turen og velg basert på leseopplevelse.

### Manglende landmark-POI-er
Noen turer bruker substitutter fordi POI-ene ikke finnes i DB. Trip Curator-workflowen bør håndtere dette — opprette POI-er som en del av tur-produksjonen når de mangler.

### Cover images — kilde
Egne foto / Unsplash (valgt). Krever manuelt arbeid per tur.

### Trip Curator som skill eller slash-command?
Skal workflowen formaliseres som en Claude Code skill (`.claude/skills/trip-curator/`) eller holdes som en uformell prosess? Skill gir konsistens og dokumentasjon. Uformell gir fleksibilitet.

---

## Neste steg

Kjør `/workflows:plan` med scope:
1. Bygg Trip Curator-workflowen (skill eller prosess-definisjon)
2. Bakklandet & Bryggene — første fullkuraterte tur via workflowen
3. Utvid Curator-skillen med Trip-teksttyper basert på erfaring
4. Fjern placeholder-rewards fra de 3 turene som har dem
5. Appliser på resterende 5 turer
