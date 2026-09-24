# Leangenbukta-nettside med Placy — komplett kundedemo

Lokal inngang: `http://localhost:<port>/demo/leangenbukta-nettside` (porten er dev-serveren din). Plan: [`docs/plans/2026-09-23-2201-feat-leangenbukta-komplett-kundedemo-plan.md`](../plans/2026-09-23-2201-feat-leangenbukta-komplett-kundedemo-plan.md). Prøveguide for kunden: [`docs/reports/2026-09-23-leangenbukta-proveguide.md`](../reports/2026-09-23-leangenbukta-proveguide.md). Kontrollkvittering: [`docs/research/leangenbukta-nettside/qa/README.md`](../research/leangenbukta-nettside/qa/README.md).

Demoen er en frosset kopi av hele den offentlige lesereisen på leangenbukta.no per 23.09.2026, med Placy lagt inn der en boligkjøper trenger det: høyt på hver byggside, øverst på Beliggenhet, tidlig på forsiden, i forsidens kartseksjon og nederst på relevante artikler. Hver Placy-inngang åpner enten Leangenbukta-boardet med Anja (`/demo/leangenbukta-lokal`, ny fane) eller chatten med et forslag til spørsmål om akkurat den siden. Chatten tilbyr både tekst og tale i den lokale demoen.

## Dekning

Inventaret (`docs/research/leangenbukta-nettside/manifest.json`, lesbar oppsummering i `inventory.md`) regnskapsfører **295 av 295** oppdagede URL-er fra sitemapene og alle første-parts lenker, samlet i 175 oppføringer. 122 av URL-ene er to lenkefeil hos originalen som er samlet til én oppføring hver (en relativ `personvern`-lenke i cookie-banneret som gir 103 skinn-URL-er, og en e-postlenke uten `mailto:` som gir 19).

| Disposisjon | Oppføringer | Hva kopien gjør |
|---|---|---|
| Lokal side | 48 | Bygd i kopien; lenker skrevet om til lokale ruter |
| Duplikat | 22 | Lenker går til den kanoniske lokale siden |
| Ekstern | 93 | Dokumenter (prospekter, prislister, kjøpebekreftelser), boligvelger (Plyo), kundeportaler, Koteng/OBOS — åpnes hos originalen, merket ↗ |
| Utilgjengelig | 12 | 10 boligvelger-dyplenker og én forsidelenke som gir 404 også hos originalen, samt samleoppføringen for e-postlenkefeilen |

Byggeskriptet snur fire inventar-disposisjoner, begrunnet i `scripts/demo/leangenbukta-site/pages-config.json`: WordPress serverer samme innlegg under to slugger, og kopien bruker den nettstedet selv lenker til (`/om-prosjektet`, `/parktunet1`, `/saltakshusk`), mens `/fritidstilbud-for-hele-familien` serveres som `/kort-vei-til-alt` og derfor er et duplikat. Innholdslikheten er kontrollert tekst mot tekst.

**12 byggsider**, alle med Placy-felt rett etter byggidentiteten: Knutepunktet, Parktunet 1 (bygg D), Bygg C, Bygg C — tilvalg, Saltakshus H, I, J, K og L, Toppleilighet L504, Byvilla 1 og 2, Rekkehus 19–27. Sju av dem er koblet til sitt prosjekttema i boardet (`boardTopicId`), slik at chatten prioriterer riktig bygg.

«Beliggenhet» i hovedmenyen er Placys tillegg; siden den åpner er kundens egen `/beliggenhet/` (kartsiden) med Placy-feltet under kartet. Den håndskrevne Beliggenhet-siden fra 16.09 er slettet.

## Slik er kopien bygd

```
docs/research/leangenbukta-nettside/     inventar, snapshot (rå HTML per side), asset-map, stilark, QA
scripts/demo/leangenbukta-inventory/     crawler og nedlasting (U1)
scripts/demo/leangenbukta-site/
  scope-page-css.mjs                     sidetypenes stilark + sidenes inline-stiler → pages.css
  build-pages.mjs                        snapshot → rensede fragmenter + sideregister
  pages-config.json                      Placy-plasseringer, chatforslag, kanoniske slugger
  qa-pages.mjs                           nettleserkontroll av hver side, desktop og mobil
data/demo/leangenbukta-nettside/
  pages.json                             sideregisteret (eneste liste over lokale sider)
  pages/<id>.html                        rensede fragmenter
  body-attributes.json                   body-klassene hver side trenger
app/demo/leangenbukta-nettside/
  page.tsx                               forsiden (håndskrevet 16.09, lenker nå lokale)
  [...slug]/page.tsx                     de øvrige 47 sidene fra fragmentene
  site-chrome.tsx                        header, mobilmeny, bunnfelt; body-klasser per side
  placy-field.tsx, placy-row.tsx         Placy-feltene
  original.css, pages.css, demo.css      kundens CSS (avgrenset til .leangenbukta-site) og våre tillegg
public/demo/leangenbukta-nettside/       forsidens ressurser + pages/ (bilder ≤ 1600 px, én film)
public/embed/placy-chat.js               den frittstående chat-widgeten
```

Etter endring i inventar eller konfig: `node scripts/demo/leangenbukta-site/scope-page-css.mjs && node scripts/demo/leangenbukta-site/build-pages.mjs`. `--check` på byggeskriptet feiler hvis fragmentene ikke er à jour. Byggeskriptet sletter medier ingen side bruker.

Rensingen fjerner skript, stilark, `on*`-handlere, iframes og skjema-innsending; skjemaer erstattes av en synlig vei til originalens skjema. Fragmentene rendres som React (`lib/demo/leangenbukta-site/html-to-react.tsx`), ikke som rå HTML: bilder blir `next/image`, interne lenker `next/link`, og Placy-plassholderne blir ekte komponenter. En intern lenke uten disposisjon i inventaret stopper bygget.

Tre ting gjøres annerledes enn hos originalen fordi temaets JavaScript ikke kjøres: bakgrunner fra «Advanced WordPress Backgrounds» flyttes inn i radens bakgrunnslag, bildekolonner uten innhold får bildets sideforhold på mobil, og innganimasjonene står i ferdig tilstand. Selektorer som starter med en body-klasse (`.single-post .container-wrap`) skrives om til wrapperen, som bærer sidens body-klasser.

## Funn hos originalen (nyttig for kunden)

- 13 sider lenker til Jan Erik Fjeldseths e-postadresse uten `mailto:`. Hos originalen gir lenken 404; kopien retter den slik at kontaktknappen virker.
- Cookie-banneret lenker til `personvern` uten ledende skråstrek, som gir en kopi av personvernsiden under hver side og 404 to nivåer ned.
- Forsidens lenke «Byvilla 3, Rekkehus 1–4» går til en side som gir 404. Kopien lenker til originalen (merket ekstern), der den fortsatt er brukket.
- 13 steder har tomme salgslederbilder (`src=""`); de vises ikke hos originalen heller.
- `/test-framside/` er et offentlig tilgjengelig utkast av en ny forside. Det er kopiert fordi det er offentlig, men ingen side lenker til det.

## Chat med tekst og tale

Knappen «Spør om Leangenbukta» nederst til høyre står over «til toppen» og åpner chatten på alle sider: sidepanel på desktop, bottom sheet på mobil, modal dialog etter WAI-ARIA (fokus inn, fokusfelle, Escape, fokus tilbake). Den lastes som en frittstående widget (`<script src="/embed/placy-chat.js" data-endpoint=… data-page-id=…>`), samme innbyggingskode som en WordPress-side ville brukt, og leser gjeldende side fra `data-placy-page-id`. Serveren (`app/api/demo/leangenbukta-chat/route.ts`, `lib/demo/leangenbukta-chat/`) bruker Anjas datasett og kunnskapsverktøy (`loadLiveDemo("leangenbukta-lokal")`), men en egen kort tekstinstruks og ingen kartstyrende verktøy. Den kaller Responses med `store: false`, krever verktøybevis for faktasvar og slipper bare gjennom lenke-ID-er fra sideregisteret. Historikken bæres av et signert, besøksbundet token; serveren lagrer ingen samtaler og logger bare metadata. Hver feil gir lenker til Board og salgsteamet.

Runtime-LLM-kallet er et navngitt unntak fra `CLAUDE.md`s regel, bestilt av Andreas for denne demoen (planens KTD4).

### Prototype- og datagrense (2026-09-24)

Chatten er en prototype. Toppen av panelet har merket «Prototype». Den tidligere statuslinja om kildekontroll og manglende kundegodkjenning er fjernet fra panelet for å gi mer plass til samtalen. `GET` leverer fortsatt `contentCheckedAt` (den nyeste `checkedAt` i `data/demo/leangenbukta-lokal/sources.json`), men widgeten viser ikke datoen. Rekkefølgen i panelet er merkevare og prototypemerke, sidens hilsen og så sidens forslag til spørsmål; startes samtalen og brukeren bytter side, legges den nye sidens forslag nederst i samtalen. Ingen fakta er godkjent av Koteng Jenssen eller salgsteamet; publisering krever fortsatt egen godkjenning fra menneske og kunde.

- **Åpning og forslag.** `GET` gir en fast, sidetilpasset åpningsmelding (`pageOpening` i `instructions.ts`: forsiden om prosjektet, byggsider om bygget, Beliggenhet om nærområdet) og sidens forslag fra `pages.json`. Åpningen er ikke modelltekst og koster ingen kvote.
- **Temarad (2026-09-24).** Under toppen står Boardets åtte kategorier som en vannrett, rullbar rad i samme form som boardets `StoryRail`: myk, avrundet flate, ikon i temaets farge over navnet, valgt tema som hvit, hevet pille. Raden står fast mens loggen ruller; kanten toner ut der det finnes flere temaer å rulle til. Temaene er faner (`tablist`/`tab`, `aria-selected`, piltaster/Home/End, én tabulatorstopp) og styrer bare hvilke tre spørsmålsforslag som vises i loggen — ikke hva Anja vet eller slår opp. `GET` leverer `categories` (id, navn, ikonnavn, farge og nøyaktig tre forslag) lest fra `loadLiveDemo("leangenbukta-lokal").board.categories`; bare forslagene er demo-kode (`lib/demo/leangenbukta-chat/categories.ts`, per stabil kategori-ID). Standardvalget er det første temaet, Leangenbukta: der står sidens egne forslag først, fylt opp til tre med prosjektforslagene, så det aldri står to sett ved siden av hverandre. Valgt tema beholdes ved sideskifte. Velges et nytt tema i en påbegynt samtale, flyttes forslagene ned til den nyeste meldingen uten at samtalen eller historikktokenet røres. Et forslag sendes som nøyaktig den viste teksten, i Skriv og i en pågående tale. Widgeten tegner bare ikoner den selv kjenner og godtar bare `#rrggbb`-farger; uten `categories` (eldre endepunkt eller feil) er raden skjult og sidens forslag vises som før. Innlesing, skjema og prospektpakken er ikke endret.
- **Svarform.** Instruksjonstillegget ber om svaret først, ett forbehold når det finnes, og én neste handling; 2–4 setninger. Modellen skal si rett ut når spørsmålet bygger på et premiss kildene ikke støtter, og aldri påstå at utbygger står bak eller har godkjent et svar.
- **Forbehold ved behov.** Serveren setter `notice` når spørsmålet eller svaret handler om pris/ledighet (`sales`) eller innflytting/framdrift/årstall (`timing`), eller når et verktøysvar selv merket grunnlaget planlagt, forventet eller uavklart (`provisional`) — men bare hvis selve svaret ikke allerede gir et tilsvarende forbehold. Småprat og avslag får aldri forbehold.
- **Kilder.** Et faktasvar viser bare kilder som (1) modellen siterte i `source_ids`, (2) sto i et verktøysvar fra *denne* meldingen og (3) finnes i kilderegisteret (`lib/demo/leangenbukta-chat/sources.ts`). `find_project_info` oppgir bare kilde-URL; tekstchatten legger på `source_id` fra registeret før svaret går tilbake til modellen. En ID modellen finner på, eller en registerkilde verktøyene ikke returnerte, vises aldri. Widgeten viser kildene som ren tekst under «Kilder i oppslaget», med etikett og side, aldri som lenke.
- **Faste svar i stedet for modellens tekst.** Et faktasvar uten verktøybevis gir kunnskapshull-svaret. Et svar (uansett svartype unntatt avslag) som nevner et årstall ingen verktøysvar i meldingen har, gir et fast svar om at kildene ikke bekrefter årstallet; kildens kontrolldato teller ikke. Begge gir lenker til Board og salgsteamet og ingen kilder. Dette er vakten mot «2008»-feilen: et årstall brukeren selv nevner blir aldri bevis.

**Hva dette ikke beviser.** Skjemaet kan ikke bevise påstand-for-påstand-dekning. At en kilde vises, betyr at den var i grunnlaget verktøyene returnerte og at modellen siterte den, ikke at hver setning er kontrollert mot den. Andre tall enn årstall (pris, antall, reisetid) sjekkes ikke mot verktøysvaret. En modell som merker en faktapåstand som `smalltalk`, slipper faktavakten, men ikke årstallsvakten. Et firesifret beløp som «2050 kr» kan forveksles med et årstall og gi det faste svaret. Dagens ledighet og gjeldende priser finnes ikke i datagrunnlaget; chatten henviser til salgsteamet.

**Validert tekstchat.** Enhets- og rutetester med mockede modellsvar mot det ekte `leangenbukta-lokal`-datasettet og widgeten i jsdom (`lib/demo/leangenbukta-chat/*.test.ts`, `app/api/demo/leangenbukta-chat/route.test.ts`). Tekstchatten ble også prøvd med et ekte svar lokalt 24.09.

**Prompt og modellforsøk 24.09.** Den faste tekstinstruksen er kortet fra ca. 53 kB til ca. 5,5 kB per Responses-runde. Kartmanus, full stedsliste, FAQ og kilderegister sendes ikke lenger inn i tekstprompten; faktainnholdet kommer fortsatt fra de samme verktøyene, og serverens svarvakter er beholdt. Dette endrer verken innlesing av data eller formatet på den nye prospektpakken som utvikles parallelt. `PLACY_LB_CHAT_MODEL` kan velge GPT‑6 Sol for tekst, og backenden bærer kryptert resonnement mellom verktøyrunder. En lokal prøve ga hilsen på ca. 2,9 sekunder, men et bredt faktaspørsmål ga først en verktøyløkke og deretter et for svakt kunnskapshull-svar på ca. 5,7 sekunder. GPT‑5.6 Terra ga et konkret faktasvar på ca. 5,1 sekunder med samme korte prompt og står derfor som aktiv standard i demoen. `lb_chat_turn` logger nå modell og varighet per modellrunde; videre modellvalg krever prøve på flere representative spørsmål. Etter to verktøyrunder med bevis tvinger serveren et sluttsvar fra det materialet som allerede er hentet, slik at et spørsmål ikke kan bli en uendelig oppslagskjede.

### Tale i samme chatvindu (2026-09-24)

På den lokale nettsidekopien vises valget «Skriv» / «Snakk» øverst i feltet under loggen. Loggen står fast; bare feltet under skifter, i samme høyde, med en kort inntoning (ingen bevegelse ved `prefers-reduced-motion`). I Skriv er det tekstfelt og Send. I Snakk er tekstfeltet og Send helt borte, også fra tabulatorrekken: når talen er av, står det én «Start tale»-knapp; når den er i gang, står status som tekst (kobler til, lytter, finner svaret, snakker) med en farget prikk som tillegg, og «Avslutt tale». Skjermlesere får modusbytte og status gjennom en egen statusregion. Første gang Snakk velges, står mikrofoninformasjonen som en stille boble fra chatten i loggen (mikrofontillatelse, lyd til OpenAI, at Anja fortsetter fra samtalen, hvordan mikrofonen stoppes), og talen starter først ved «Start tale». Etter at brukeren har startet tale én gang på siden, starter «Snakk» talen direkte. Brukerens og Anjas tale skrives fortløpende som bobler i den vanlige chatloggen. For å skrive bytter man til Skriv; et halvskrevet utkast venter der. Et spørsmålsforslag i loggen som trykkes under talen, går til den pågående talesesjonen. «Avslutt tale», «Skriv», lukking av chatten eller et avslag på mikrofonen stopper talen og mikrofonen og går tilbake til Skriv. Ved feil går panelet tilbake til skriving med årsaken synlig.

**Én samtale (2026-09-24):** Skriving og tale deler historikk gjennom det samme signerte, besøksbundne tokenet (`lib/demo/leangenbukta-chat/transcript.ts`):

- *Tekst → tale:* widgeten sender tekstchattens token med start-kommandoen. Live-ruta verifiserer det mot demotilgangens besøks-ID og datasettets `snapshotId` og legger turene inn som Live-sesjonens `session.input` før hilsenen. Anja får da en «fortsett»-instruks og -hilsen; loggen sier «Anja er klar til å snakke og fortsetter fra samtalen over». Et token som ikke kan brukes gir en ærlig melding om at Anja starter uten samtalen over.
- *Tale → tekst:* serverens sideband skriver talens egne transkript-eventer til et opptak i minnet (`voice-handoff.ts`), bundet til sesjonstokenet og besøks-ID-en. Når talen er slutt, bytter broen sesjonstokenet mot et nytt signert token (`POST /api/prototype/live/handoff`). Tekstchatten fortsetter fra det; mens overføringen pågår, venter neste melding. Feiler overføringen, sier loggen at skrivechatten ikke ser det som ble sagt, og tokenet fra før talen beholdes.
- *Vindu:* høyst 40 turer, 12 000 tegn og 8 000 UTF-8-byte, eldste først ut; meldingene sier «de siste delene av samtalen» når noe har falt ut. Opptaket lever i minnet til 10 minutter etter at talen er slutt og slettes ved omstart; ingenting lagres varig. Assistentens ord kommer bare fra serveren, aldri fra klientens bobler.

Stemmeflaten har egne instruksjoner og oppslagsverktøy uten kartstyring. Den er avgrenset til spørsmål om nabolaget og hvordan det er å bo her. Prospekt- og leilighetsspesifikke fakta er en separat, parallell leveranse.

Teknisk er `public/embed/placy-chat.js` fortsatt den eneste synlige UI-en. En usynlig `voice-bridge.tsx` i Leangenbukta-layouten bruker eksisterende `useLive`/WebRTC og sender status, feil og transkript til widgeten via `CustomEvent`-kanalen i `lib/demo/leangenbukta-chat/voice-channel.ts`. Andre sider som bygger inn skriptet uten broen får fortsatt bare tekstchat. Lokal prøving: `http://127.0.0.1:3107/demo/leangenbukta-nettside` mens utviklingsserveren kjører på port 3107. Tale på telefon krever HTTPS.

En kort Chrome-prøve 24.09 av den tidligere taleflaten bekreftet at Anja koblet opp, at hilsenen ble transkribert løpende i chatloggen, at panelet skiftet mellom «Anja snakker» og «Lytter», og at stoppknappen avsluttet mikrofonopptaket mens teksten ble stående. Hørbar lyd ble ikke kontrollert separat. Den nye historikkoverføringen er kontrollert med målrettede tester og TypeScript, men ikke med en muntlig ende-til-ende-prøve ennå. Den prøven, detaljert faktakvalitet og en lengre samtale gjenstår før kundedeling.

## Tilgang, kvoter og deling

Én tilgangskode gir én signert, httpOnly-cookie (14 dager) som proxyen, boardet, chatten og Leangenbuktas stemmesamtale leser (`lib/demo/leangenbukta-site/access.ts`, `proxy.ts`). Alle svar er `noindex`.

| Miljø | Atferd |
|---|---|
| Dev-server uten kode | Bare localhost slipper inn — ingen innlogging lokalt |
| Kode satt (også lokalt) | Innlogging på `/demo/leangenbukta-tilgang`, deretter fri navigasjon |
| Produksjonsbygg uten kode | 404 overalt (feiler lukket) |

Miljøvariabler for en delt preview:

- `PLACY_LB_DEMO_ACCESS_CODE` (≥ 16 tegn) og `PLACY_LB_DEMO_COOKIE_SECRET` (≥ 32 tegn). Ny kode ugyldiggjør alle utstedte cookies.
- `PLACY_LB_DEMO_USAGE_STORE=supabase` og migrasjon `supabase/migrations/098_demo_usage.sql` (ikke kjørt). Uten sentralt kvotelager nekter et produksjonsbygg chat (503) og stemme — med vilje.
- `OPENAI_API_KEY` i et eget OpenAI-prosjekt med hardt månedlig spendtak (KTD6). Valgfritt: `PLACY_LB_CHAT_MODEL`, døgnkvoter `PLACY_LB_DEMO_{CHAT,VOICE}_{VISITOR,GLOBAL}_DAILY` (standard 60/600 meldinger og 8/60 stemmesesjoner), `PLACY_LB_DEMO_FEEDBACK_EMAIL` (standard hei@placy.no).
- `PLACY_LB_CHAT_ALLOWED_ORIGINS` bare hvis widgeten skal bygges inn på et annet domene. Innbygging på kundens WordPress med kvoter på tvers av domener er ikke løst i denne demoen.

Stemmesamtalen på en delt preview går gjennom den lokale Live-ruta med demotilgangen, bare for datasettet `leangenbukta-lokal`, og har fortsatt serverens begrensning på én samtidig stemmesesjon per instans.

## Fjerne demoen

Slett `app/demo/leangenbukta-nettside/`, `app/demo/leangenbukta-tilgang/`, `app/api/demo/leangenbukta-chat/`, `data/demo/leangenbukta-nettside/`, `lib/demo/leangenbukta-site/`, `lib/demo/leangenbukta-chat/`, `public/demo/leangenbukta-nettside/`, `public/embed/`, proxy-grenen for `/demo/leangenbukta-*` og Leangenbukta-grenen i `app/api/prototype/live/route.ts`. Boardet, Nyhavna og produksjonsdataene er ikke avhengige av noe av dette.
