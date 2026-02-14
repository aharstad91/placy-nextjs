# Placy Editorial Voice & Style Guide — Brainstorm

**Dato:** 2026-02-14
**Status:** Brainstorm ferdig, klar for plan

## Hva vi bygger

En editorial style guide som definerer Placy's skriftlige stemme — brukt av Claude for å generere konsistent, høykvalitets redaksjonell tekst på nivå med en profesjonell tekstforfatter.

Leveranse: En Claude Code skill (`/.claude/skills/placy-editorial/`) som automatisk aktiveres ved tekstgenerering.

## Hvorfor denne tilnærmingen

### Problemet
- Tekstkvaliteten varierer mellom migrasjoner (021 er generisk, 025 er mye bedre)
- Ingen formell definisjon av Placy's stemme
- Hooks kan føles faktabaserte uten emosjonell resonans
- Ingen retningslinjer for NO↔EN oversettelse med bevart tone

### Inspirasjon samlet inn
Vi analyserte 72 tekster fra fire ulike kilder:

| Kilde | Antall | Hva vi lærte |
|---|---|---|
| **Sem & Johnsen** (eiendom) | 35 tekster | Lagvis struktur, navngiving, bevegelse gjennom rom, kontraster |
| **Anders Husa** (matanmeldelser) | 11 tekster | Spesifikke detaljer > generell ros, sjefs-bakgrunn, ærlig kritikk |
| **Monocle/Kinfolk** (reiseguider) | 13 tekster | Sofistikert men ikke snobbete, materialitet, kulturell kontekst |
| **Reiseguider** (LP/Michelin) | 13 tekster | Konsise hooks, handlingsorientert, sensoriske ord |

Filer: `docs/brainstorms/sem-johnsen-beliggenhet-*.md`, `docs/brainstorms/inspo-*.md`

## Nøkkelbeslutninger

### 1. Én stemme, tilpasset register
**Beslutning:** Placy har én gjenkjennelig personlighet som justerer register etter kontekst — ikke ulike stemmer per kategori.

- Finedining → mer presist ordvalg, respektfull distanse
- Hverdagssted → varmere, mer uformell
- Nabolag → bredere perspektiv, bevegelse gjennom rommet

### 2. Placy-stemmen (destillert fra 72 tekster)

**Personlighet:** Nysgjerrig lokal som kjenner historiene bak stedene.

**Kjerneprinsippene:**

#### A. Navngi, aldri generaliser
- ALDRI: «Området har gode restauranter»
- ALLTID: «Park 29, Lorry og Campo de' Fiori ligger i gangavstand»

#### B. Mal bevegelse gjennom rommet
- «Langs Akerselva kan du spasere ned til sentrum, eller opp forbi Nydalen mot Maridalsvannet»
- Skaper en mental reise, ikke bare et faktaark

#### C. Bruk kontraster
- «Sentralt og urbant — men med skogen som nærmeste nabo»
- Kontrasten avslører stedets karakter

#### D. Saklig entusiasme
- La stedene snakke for seg selv gjennom spesifisitet
- Aldri utropstegn, «fantastisk!» eller «du vil elske»
- Heller: «Tony Jacobsen startet i 6 kvm bak en frisørsalong i 2012»

#### E. Mennesker og historier
- Nevn grunnlegger, kokk, baker ved navn
- Gi kontekst: «Bocuse d'Or-sølvvinner», «med erfaring fra trestjernede Alinea i Chicago»
- Historien bak stedet gjør det minneverdig

#### F. Sensorisk presisjon (fra Monocle/Kinfolk)
- Ikke «fin atmosfære» men «rå trevegger, messingdetaljer og blå stoler»
- Materialitet og sanseinntrykk over abstrakte adjektiver

### 3. Register-skala per kontekst

| Kontekst | Register | Eksempel-tone |
|---|---|---|
| Michelin/finedining | Presis, respektfull | «Verdens første grønne Michelin-stjerne» |
| Håndverksbakeri/kafé | Varm, inviterende | «Kom tidlig på lørdager — kanelsnurrene går fort» |
| Hverdagssted/kantine | Ærlig, upretensiøs | «Studentdrevet og rimelig, men kvaliteten overrasker» |
| Nabolag/område | Narrativ, malerisk | «Langs Nidelva, mellom trehusene på Bakklandet...» |
| Opplevelse/museum | Nysgjerrig, informativ | «Bygget i 1070 — fortsatt under restaurering etter 950 år» |

### 4. Teksttyper og lengder

| Teksttype | Lengde | Funksjon | Struktur |
|---|---|---|---|
| **editorial_hook** | 1-2 setninger, 80-150 tegn | Hva gjør dette stedet spesielt | [Distinkt trekk] — [kontekst/historie] |
| **local_insight** | 1-2 setninger, 80-120 tegn | Insider-tips | [Praktisk råd] eller [lokal kunnskap] |
| **intro_text** | 3-4 avsnitt, 600-900 tegn | Kategori-oversikt for landing page | Identitet → Mangfold → Kvalitet → CTA |
| **seo_description** | 1 setning, 120-160 tegn | Meta description | [By] + [kategori] + [2-3 highlight-navn] |

### 5. Kvalitetssjekkliste

Før tekst publiseres:
- [ ] Ingen forgjengelig info (priser, åpningstider, midlertidige tilbud)
- [ ] Minst ett spesifikt navn (person, sted, rett, produkt)
- [ ] Grunnlagt/årstall hvis relevant og verifiserbart
- [ ] Første setning fungerer alene (for avkortede visninger)
- [ ] Ingen generiske superlativer («fantastisk», «utrolig», «best i byen»)
- [ ] WebSearch-verifisert (ikke antatt)
- [ ] Kontrast eller bevegelse der det passer
- [ ] Fungerer om 6 måneder uten endring

### 6. Ord vi bruker vs. unngår

| Bruk | Unngå |
|---|---|
| «Grunnlagt av...» | «Fantastisk» |
| «Siden [årstall]» | «Utrolig» |
| «Kjent for...» | «Du vil elske» |
| «NM-vinner» / «Michelin-stjerne» | «Best i byen» (med mindre verifiserbart) |
| «Håndlaget» / «bakt fra bunnen av» | «Unikt» (for generisk) |
| «I gangavstand fra...» | «Sjarmerende» (uten konkret grunn) |
| «Prøv [spesifikk rett]» | «Noe for enhver smak» |

### 7. NO↔EN retningslinjer
- Norsk er primærspråk — skriv norsk først, oversett til engelsk
- Behold stedsnavn på norsk (Bakklandet, Nidelva, ikke «the old town bridge»)
- Engelske tekster kan være litt mer forklarende (leseren kjenner ikke byen)
- Unngå direkte oversettelse av norske uttrykk som ikke fungerer på engelsk

## Avklarte spørsmål

1. **Stemme: Nøytral, ikke «anbefaler».** Placy beskriver og kuraterer — vi sier ikke «vi anbefaler» eller «vår favoritt». Kurateringen *er* anbefalingen (du er på listen = du er anbefalt).
2. **Aldri negativ.** Placy kritiserer ikke. Hvis et sted ikke holder mål, kuraterer vi det bort. Tekstene handler bare om steder vi mener fortjener oppmerksomhet.
3. **Sanseinntrykk, ikke metaforer.** Konkrete sanseinntrykk («rå trevegger, messingdetaljer») fremfor bildespråk og metaforer. Fakta og sansning > poetisk språk.

## Åpne spørsmål

1. **Persontillatelser:** Når vi navngir grunnleggere/kokker — trenger vi samtykke? (Sannsynligvis ikke for offentlig info, men verdt å vurdere)

## Neste steg

1. **`/plan`** — Lag Claude Code skill med style guide, eksempler og sjekkliste
2. **Test** — Skriv om 3-5 eksisterende hooks med ny stemme, sammenlign
3. **Iterer** — Juster basert på feedback
4. **Rull ut** — Bruk skillen på neste kategori-kuratering
