# Anti-patterns — konkrete feil vi har gjort

Reelle feil fra iter 1-12 på Stasjonskvartalet og Wesselsløkka. Hver post viser **teksten som ble produsert**, **rotsårsaken**, **hva som er faktisk sant**, og **korreksjonen**. Brukes som treningsmateriale — les FØR du genererer, ikke etter.

## 1. "Byhaven samler dagligvarekjedene" (FALSK PÅSTAND)

**Hvor:** Stasjonskvartalet, Hverdagsliv (iter 7)

**Tekst:** *"Byhaven samler de største dagligvarekjedene og Vinmonopolet i Midtbyen."*

**Rotsårsak:** LLM-intuisjon om "hva et sentralt kjøpesenter typisk inneholder". Ingen web-research.

**Realitet (byhaven.no/butikker, triangulert også mot Google AI + Visit Trondheim):** Byhaven har 32 butikker, **ingen** lavpris-dagligvarekjede (Kiwi/Rema/Extra/Meny lagt ned 2017). Profil: mote, delikatesse, service, Vinmonopolet, Vitusapotek.

**Bruddregler:** W (lokasjon stabilt, innhold flyktig), G (tidssensitive fakta må trianguleres).

**Korreksjon:** *"Byhaven i Olav Tryggvasons gate er mindre og mer spesialisert — mote, delikatesse og service i et kvartal med egen karakter."*

## 2. "Spontan Vinbar" (NAVNSKIFTE IKKE FANGET)

**Hvor:** Stasjonskvartalet, Mat & Drikke (iter 5-7)

**Tekst:** *"Spontan Vinbar — anbefalt i Guide Michelin — er blant de etablerte kjøkkenene."*

**Rotsårsak:** Minne fra 2023-2024, ingen fresh research før skriving.

**Realitet (michelin.com, spontanvinbar.no/saga):** Spontan Vinbar byttet navn til **Restaurant Saga** i 2025. Vinbaren driftes fortsatt under Spontan-navnet i samme bygg.

**Bruddregel:** G (triangulering). Navnekifter er vanlige.

**Korreksjon:** *"Troll Restaurant på Fosenkaia og Restaurant Saga (tidligere Spontan Vinbar) i Fjordgata er blant de Michelin-anbefalte kjøkkenene."*

## 3. "Bank, post og legekontor spredt i Midtbyen"

**Hvor:** Stasjonskvartalet, Hverdagsliv (iter 7-9)

**Tekst:** *"Bank, post og legekontor finnes spredt i Midtbyen innen ti minutter til fots."*

**Rotsårsak:** Kopiert meglerarvet sjekkliste uten kritikk.

**Realitet:** Moderne boligkjøper (alle personas) bruker bank digitalt, post i butikk finnes overalt, fastlege geografi-uavhengig. Ikke relevante differensieringer.

**Bruddregler:** Z (kvantitativ generalisering), X (ikke beskriv det leseren ikke bryr seg om).

**Korreksjon:** *"Innen ti minutter til fots ligger også titalls frisører, apotek, velvære- og servicebutikker fordelt mellom kvartalene i Midtbyen."*

## 4. "third-wave-brenneri" (BRANSJE-SJARGONG)

**Hvor:** Stasjonskvartalet, Mat & Drikke (iter 10-11)

**Tekst:** *"Kaffekulturen på Fosenkaia og i Midtbyen inkluderer både third-wave-brenneri og nabolagskafeer."*

**Rotsårsak:** LLM-valg av bransje-term, ikke verifisert mot målgruppe.

**Realitet:** Boligkjøpere bruker kjente kaffehus (Sellanraa, Dromedar, Brenneriet) men kjenner ikke "third-wave" som begrep.

**Bruddregel:** Æ (ingen bransje-sjargong).

**Korreksjon:** *"Kaffekulturen inkluderer både egne brennerier og nabolagskafeer."*

## 5. "For daglig matkasse er Solsiden det naturlige valget" (PRESKRIPTIV)

**Hvor:** Stasjonskvartalet, Hverdagsliv (iter 8)

**Tekst:** *"For daglig matkasse er Solsiden det naturlige valget; Byhaven er kortere gange fra Trondheim S og passer bedre for mindre ærend."*

**Rotsårsak:** LLM-tendens til å gi anbefalinger.

**Realitet:** Rapporten skal si hva som finnes og hvor, ikke anbefale hvordan leseren bør bruke stedene.

**Bruddregel:** X (beskriv tilbudet, ikke valget).

**Korreksjon:** *"Solsiden senter er ett av de større kjøpesentrene i Midtbyen... Byhaven i Olav Tryggvasons gate er mindre og mer spesialisert..."* (beskrivelse, ingen preskripsjon)

## 6. "Norges største innendørs badeanlegg" (UDOKUMENTERT SUPERLATIV)

**Hvor:** Stasjonskvartalet + Wesselsløkka, Trening (iter 7-8)

**Tekst:** *"Pirbadet på Brattøra er Norges største innendørs badeanlegg."*

**Rotsårsak:** Pirbadets egen markedsføring (pirbadet.no) kopiert som fakta.

**Realitet:** Stedet egen nettside kan ikke være triangulering. Superlativet er unødvendig.

**Bruddregel:** Y (ingen udokumenterte superlativer).

**Korreksjon:** *"Pirbadet på Brattøra er et innendørs badeanlegg med svømmehall og badeland."*

## 7. "Solsiden senter er det store kjøpesenteret" (IMPLISITT SUPERLATIV)

**Hvor:** Stasjonskvartalet, Hverdagsliv (iter 8)

**Tekst:** *"Solsiden senter er det store kjøpesenteret i Midtbyen..."*

**Rotsårsak:** LLM-tendens til bestemt form.

**Realitet:** Midtbyen har flere større kjøpesentre (Trondheim Torg, Byhaven osv.). "Det store" impliserer unikhet.

**Bruddregel:** Y.

**Korreksjon:** *"Solsiden senter er ett av de større kjøpesentrene i Midtbyen..."*

## 8. "Adressaparken ... noen få minutter unna" (FEIL ANKER)

**Hvor:** Stasjonskvartalet, Natur (iter 11)

**Tekst:** *"Sjøbadet på Brattøra og Adressaparken ved Nidelva-havna ligger noen få minutter unna."*

**Rotsårsak:** Samlet to steder i én setning med samme anker, uten å sjekke bucket.

**Realitet (Google AI, triangulert):** Adressaparken er 10 min til fots fra Trondheim S. Sjøbadet ~5 min. "Noen få minutter" = 2-4 min-bucket, ingen passer.

**Bruddregel:** T (ankerverdier). Subregel: Ved samle-setning, alle steder må være i samme bucket.

**Korreksjon:** *"Sjøbadet på Brattøra ligger rundt fem minutter unna. Adressaparken ved Bakke bru og Nidelva er rundt ti minutter til fots."*

## 9. "ny 1-7 skole åpner sommeren 2026" (UTRIANGLERT FRAMTID)

**Hvor:** Wesselsløkka, Barn & Oppvekst (iter 5)

**Tekst:** *"En ny 1-7 skole åpner sommeren 2026, samtidig med innflytting."*

**Rotsårsak:** Enkelt WebSearch-treff fra 2024-spekulasjon, ingen negativ-sjekk.

**Realitet (trondheim.kommune.no, Google AI):** Brøset skole er i detaljregulering per april 2026. Ingen byggestart bekreftet.

**Bruddregel:** G (triangulering + negativ-sjekk for framtids-fakta).

**Korreksjon:** *"En ny 1-7-skole er planlagt på Brøset, men byggestart er ikke endelig fastsatt."*

## 10. "Valentinlyst har dagligvare, Vinmonopol, apotek, bakeri og tannklinikk" (OVERFORSIKRING)

**Hvor:** Wesselsløkka, Hverdagsliv (iter 7)

**Tekst:** *"Valentinlyst nærsenter har dagligvare, Vinmonopol, apotek, bakeri, tannklinikk og legesenter under ett tak."*

**Rotsårsak:** Antatt tilbuds-miks basert på "typisk nærsenter".

**Realitet (valentinlyst.no):** Nettsiden lister dagligvare (7-23), Rosenborg Bakeri, to kjøreskoler, Homebygard interiør. IKKE bekreftet: apotek, Vinmonopol, tannklinikk, legesenter.

**Bruddregel:** W (innhold flyktig — bare påstå det som er triangulert).

**Korreksjon:** *"Valentinlyst senter dekker daglig matkasse med åpent dagligvareutvalg fra 07 til 23. Rosenborg Bakeri med kafé ligger i samme senter."* + Google AI-knapp for detaljer.

## 11. "Flytog og flybuss kjører regelmessig til Værnes" (FAKTAFEIL)

**Hvor:** Stasjonskvartalet, Transport (iter 7)

**Tekst:** *"Flytog og flybuss kjører regelmessig til Trondheim Lufthavn Værnes."*

**Rotsårsak:** Antatt basert på Oslo-konsept (Flytoget til Gardermoen).

**Realitet:** Flytoget operer IKKE i Trondheim. Vy driver Trønderbanen/regiontog til Værnes. Værnes-Ekspressen flybuss driver bussruten.

**Bruddregel:** G (triangulering), Z (bruk generiske termer i tvil).

**Korreksjon:** *"Direktebuss og tog til Trondheim Lufthavn Værnes går regelmessig fra sentralstasjonen, typisk innen en halvtime fra dør til avgang."*

## 12. "Enten Eller frisør" (LAV RATING VOLUM)

**Hvor:** Stasjonskvartalet, Hverdagsliv (iter 6)

**Tekst:** *"Enten Eller frisør i Fjordgata og H2 Barber i Mercur-bygget ligger fem til seks minutter til fots."*

**Rotsårsak:** Navngiving basert på rating uten volum-sjekk.

**Realitet:** Enten Eller har 14 ratings. H2 Barber i Mercur-bygget: H2 har flyttet, Mercur-bygget-referanse er utdatert (2.-grads detalj).

**Bruddregler:** L (rating-volum < 30), K (2.-grads detaljer som bygg-navn).

**Korreksjon:** *"Flere frisørsalonger og barbershops ligger innen fem til åtte minutter."* (Regel Z: kvantitativ)

## 13. "Linje 12 dekker både sentrum, Tyholt og Byåsen" (FAKTAFEIL)

**Hvor:** Wesselsløkka, Transport (iter 10)

**Tekst:** *"Linje 12 dekker både sentrum, Tyholt og Byåsen."*

**Rotsårsak:** Antatt ruten dekket "tre viktigste retninger" uten triangulering.

**Realitet (AtB-søk):** Linje 12 går Dragvoll via Strindheim til Midtbyen. Ikke Byåsen.

**Bruddregel:** G.

**Korreksjon:** *"Linje 12 dekker ruten fra Dragvoll via Strindheim til Midtbyen, med stopp i Prinsens gate og Olav Tryggvasons gate i sentrum."*

## Læringspunkter (meta)

Etter 12 iterasjoner på to prosjekter, seks tilbakevendende rotsårsaker:

1. **LLM-intuisjon i stedet for research** — de fleste faktafeil kommer fra at LLM antar i stedet for å triangulere
2. **Superlativ-tendens** — "det største", "det beste", "det naturlige" kommer lett ut
3. **Preskriptive setninger** — "passer best for" smygsetter seg når LLM vil være hjelpsom
4. **Tilbuds-miks-påstander** — konkrete butikker/tjenester i sentre låses fra gammel kunnskap
5. **Grunnlagsfeil i anker** — avstand kalibreres ikke per sted når flere samles i én setning
6. **Utdaterte kategorier** — bank, post, legekontor fra megler-sjekklister som ikke er relevante

**Forebygging:** Kjør Steg 2.5 (web-research) **før** tekst-generering, ikke etter. Alle påstander må kunne spores til en kilde.
