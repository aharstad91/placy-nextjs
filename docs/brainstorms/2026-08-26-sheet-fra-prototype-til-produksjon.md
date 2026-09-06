# Sheet-forbedringene fra prototypen inn i det ekte boardet

**Dato:** 2026-08-26
**Kilde:** `prototypes/04-fortelling-i-boardet/` + `prototypes/_shared/baseline.*` etter arbeidsøkten 2026-08-25/26
**Mål:** avgjøre hva av gårsdagens arbeid som kan shippes til produksjon, hva som må vente, og hvilke filer hver enkelt endring treffer.

---

## Hovedfunnet

Gårsdagen produserte to ulike slags resultater, og de skal ikke ta samme vei.

**Forbedringer av flaten som alt finnes i produksjon.** De kan shippes uten at noen først tar et produktvalg.

**Fortellingsmodusen.** Den er fortsatt en iterasjon uten dom (`prototypes/README.md`: «`04` er fortsatt en iterasjon uten dom»). Alt som bare eksisterer inne i den — spørsmålet som overskrift, faneraden, kategori-navbaren i dekket, det fastlimte spørsmålet, krysset — skal ikke inn i boardet før nivå 1 faktisk er bestemt å se sånn ut.

Når man sorterer gårsdagens arbeid på den linja, blir listen kortere enn den føles:

| Endring | Kan shippes nå | Hvorfor / hvorfor ikke |
|---|---|---|
| Magneten ut av sheet-gesten | **Ja** | Isolert, validert på telefon av Andreas, ingen strukturell endring |
| Reisemåte som enhet over minutt-kolonnen | **Ja** | Produksjonen har alt komponenten; jobben er et nytt monteringspunkt |
| Sheeten som ÉN scroller | Nei — eget prosjekt | Bytter ut mekanismen i `NeighbourhoodSheet.tsx`, ikke en justering |
| Handlen uten strek og bakgrunn | Nei — avhenger av over | Handlen bærer tittelen i produksjon; den kan ikke tømmes uten erstatning |
| Spørsmålet som fastlimt header | Nei — ikke et produksjonsproblem | Se «Buggen som ikke finnes i produksjon» under |
| Faneradens høyde | Nei | Ren fortellingsmodus-konstruksjon, ingen motpart i produksjon |
| Prototype-verktøyene bak én knapp | Aldri | Stillas. Finnes ikke i produksjon og skal ikke dit |

---

## Lanen finnes allerede, og det er det som gjør dette overkommelig

Prototypen ble **portet fra produksjon**, ikke oppfunnet ved siden av den. `prototypes/README.md` navngir kildene: `DesktopStorySidebar.tsx`, `NeighbourhoodSheet.tsx`, `NeighbourhoodCategoryCard.tsx`, `CategoryPage.tsx`, `FAQSection.tsx`, `HighlightsDisclosure.tsx` — og CSS-kommentarene i `_shared/baseline.css` navngir Tailwind-klassen hver regel kom fra.

Det betyr at kartet går begge veier. Vi porter ikke prototypen; vi porter **diffen**, og hver regel peker selv på hvor den hører hjemme.

Avvik fra produksjon er dessuten merket `AVVIK` i prototype-koden. Alt som bærer den merkelappen er per definisjon ikke shippbart uten et eget valg.

---

## Fase 1 — de to som kan gå nå

### 1.1 Reisemåte som enhet over minutt-kolonnen

**Problemet i produksjon i dag:** lista sier «3 min» uten å si 3 min *med hva*. Reisemåte finnes som kontroll, men bare på kartet (`BoardMapControls`) og på rutens midtpunkt (`BoardPathMidpointMarker`) — mens tallene leses i sheeten.

**Filer:**

- `components/variants/report/board/neighbourhood/NeighbourhoodCategoryCard.tsx` (linje ~79–81, `{row.minutes} min`)
- `components/variants/report/board/neighbourhood/CategoryPage.tsx` (linje ~256–258, samme)
- `components/variants/report/board/TravelModeSelector.tsx` — **gjenbrukes uendret**

**Hva som gjøres:** en høyrestilt veksler i lista sin overskriftsrad, innrettet over minutt-kolonnen, som åpner `TravelModeSelector variant="panel"` nedover. Panelet viser alle modusene med sin egen tid for det åpne stedet, så leseren ser hva hun bytter TIL før hun bytter — nøyaktig som chipen på ruta gjør i dag.

**Hvorfor denne først:** produksjonen har komponenten ferdig, med `panel`-varianten allerede bygget for å vise tre tider samtidig. Ingen gest-risiko, ingen ny tilstand — `SET_TRAVEL_MODE` finnes i `board-state.tsx`. Den beviser at lanen holder til en pris vi kan måle de andre mot.

**Innretting (målt i prototypen):** kontrollen ligger 22 px fra kanten = radens chevron-kolonne (15) + gap (9) − knappens egen padding (6). Da lander etiketten over tallene og ikke over chevronen. Tallene tilsvarer produksjonens egen radgeometri og må måles på nytt der.

**Fallgruve, funnet i prototypen:** POI-en finnes i to former. Den adapterte (i kategorilista) har tidene på `raw.travelTime`; den rå (i `poisById`) har dem på `travelTime` direkte. Leser man feil av dem, blir hver tid «–» i panelet selv om raden rett over viser 3 min. Verifiser hvilken form `row` faktisk bærer i begge komponentene.

### 1.2 Magneten ut av sheet-gesten

**Problemet:** Andreas testet på telefon: *«når jeg slipper scrollen, så snapper den litt, som om den finner tilbake til et punkt den vil være på. det er ikke ønsket oppførsel, sheeten bør være 100 % fluid.»*

**Fil:** `components/variants/report/board/neighbourhood/NeighbourhoodSheet.tsx`

**Hva som gjøres:** `SNAP_THRESHOLD_PX` (linje ~105) og `toMin`/`toMax`-blokken i `handlePointerUp` (linje ~307–324) fjernes. `MOMENTUM_PROJECTION_MS` beholdes — det er utrullingen, ikke magneten. Etter slipp gjelder bare farten: der utrullingen dør, står flaten.

**Hva som IKKE røres:** tappet på handlen (linje ~300–305) hopper fortsatt mellom ytterpunktene. Det er den ikke-gestuelle veien, og regelen fra `prototypes/README.md` gjelder: *«Ingen gesture skal være eneste vei til noe.»* Stoppene lever videre som trykk-mål — der er de et valg du tar, ikke en korreksjon du får.

**Kommentaren i fila må rettes samtidig.** Doc-blokken (linje ~53) sier i dag «Ytterpunktene er fortsatt magnetiske (`SNAP_THRESHOLD_PX`) — ellers blir "vis meg mest mulig kart" en presisjonsøvelse.» Den setningen blir usann, og begrunnelsen den bærer er nettopp den Andreas overprøvde på enhet. Erstattes med hvorfor magneten ble tatt ut.

**Verifisering:** dette er en følelse, ikke et tall. Den må kjennes på telefon, ikke bare måles i Chrome.

---

## Fase 2 — sheeten som én scroller

Dette er ikke en justering, det er et bytte av mekanisme, og fortjener sin egen plan.

**I dag (produksjon):** sheeten er et element hvis `height` animeres, med en separat scroll-container inni (`data-testid="neighbourhood-scroll"`). Posisjon og innhold er to tall.

**I prototypen nå:** hele flaten er ÉN scroller (`.sheet-outer`) der `scrollTop` ER posisjonen. Sheeten er et barn med en spacer over seg, handlen er `position: sticky` inni, og utrullingen er iOS' egen bremsefaktor på det ene tallet.

**Hva det kjøper:**

- En sammenslått tilstand der bare handlen står igjen, så kartet kan ses i sin helhet uten at flaten forsvinner
- Posisjon og innhold på ett tall — ingen synkronisering mellom drag-høyde og scroll-region
- Innfødt utrulling i stedet for en projisert høyde

**Hva det koster:** `NeighbourhoodSheet.tsx` skrives i praksis om. `onHeightChange`-kontrakten mot kartet må vurderes på nytt — doc-blokken forklarer i detalj hvorfor tallet som rapporteres oppover må være `bounds.min` og ikke gjeldende høyde (ellers pumper sheeten seg opp og ned av seg selv gjennom okklusjons-løkken). Den løkken må lukkes på nytt i den nye mekanismen, ikke antas borte.

**Rekkefølge:** Fase 1.2 (magneten) er uavhengig av dette og bør gå først uansett. Går Fase 2, arves 1.2 av den.

---

## Buggen som ikke finnes i produksjon

Verdt å skrive ned, fordi den ser ut som en produksjonsfeil og ikke er det.

I prototypen scrollet spørsmålet bort bak kartet mens lukkeknappen ble hengende festet under en tom handle. Årsaken er at prototypens ene scroller lar handlen og innholdet dele scroll-rom.

**Produksjonen har ikke dette problemet:** grab-knappen ligger `shrink-0` UTENFOR scroll-containeren, så tittelen kan aldri scrolle bort.

Det gjør fiksen — spørsmålet som fastlimt header — til en **forutsetning for Fase 2**, ikke til en forbedring som kan shippes for seg. Går sheeten over til én scroller, oppstår problemet i produksjon også, og da må headeren løses samtidig.

Samme gjelder handlen uten strek og bakgrunn: i produksjon bærer handlen tittelen («I nærheten»), og den kan ikke tømmes for innhold uten at noe annet overtar jobben med å si hvor du er.

---

## Avgrensning

### Ikke i denne omgang

- **Fortellingsmodusen i sin helhet.** Kategori-navbaren i dekket, spørsmålet som overskrift, de tre fanene, det kuraterte utvalget per stopp. Alt dette venter på en dom over `04`, og den dommen er et produktvalg — ikke et teknisk et.
- **Kart-veksleren (2D / satellitt / 3D) i prototypen.** Produksjonen har den i `BoardMapControls`; prototypen kan ikke få den som den er, fordi `sat` og `3d` kjører på Googles motor (`gmp-map-3d`), ikke Mapbox. En falsk 3D ville testet en flate som ikke finnes.
- **Prototype-stillaset.** Board-velgeren, Tett/Fortelling, Megler/Nærmest og galleri-lenka er merket `AVVIK` og hører hjemme kun i prototypen.

### Åpent spørsmål før Fase 1 settes i gang

Reisemåte-vekslerens plassering i lista (1.1) gir produksjonen tre innganger til samme tilstand: kart-kontrollen, chipen på ruta, og lista. To er et bevisst valg som alt er dokumentert i `TravelModeSelector`. Tre bør bekreftes før den bygges — eller en av de eksisterende bør vike.

---

## Neste steg

`/full` med dette dokumentet som input til brainstorm-fasen, avgrenset til Fase 1. Fase 2 får sin egen runde når 1 er verifisert i produksjon.
