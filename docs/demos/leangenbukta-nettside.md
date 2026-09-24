# Leangenbukta-nettside med Placy — komplett kundedemo

Lokal inngang: `http://localhost:<port>/demo/leangenbukta-nettside` (porten er dev-serveren din). Plan: [`docs/plans/2026-09-23-2201-feat-leangenbukta-komplett-kundedemo-plan.md`](../plans/2026-09-23-2201-feat-leangenbukta-komplett-kundedemo-plan.md). Prøveguide for kunden: [`docs/reports/2026-09-23-leangenbukta-proveguide.md`](../reports/2026-09-23-leangenbukta-proveguide.md). Kontrollkvittering: [`docs/research/leangenbukta-nettside/qa/README.md`](../research/leangenbukta-nettside/qa/README.md).

Demoen er en frosset kopi av hele den offentlige lesereisen på leangenbukta.no per 23.09.2026, med Placy lagt inn der en boligkjøper trenger det: høyt på hver byggside, øverst på Beliggenhet, tidlig på forsiden, i forsidens kartseksjon og nederst på relevante artikler. Hver Placy-inngang åpner enten Leangenbukta-boardet med Anja (`/demo/leangenbukta-lokal`, ny fane) eller tekstchatten med et forslag til spørsmål om akkurat den siden.

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

## Tekstchat

Knappen «Spør om Leangenbukta» nederst til høyre står over «til toppen» og åpner chatten på alle sider: sidepanel på desktop, bottom sheet på mobil, modal dialog etter WAI-ARIA (fokus inn, fokusfelle, Escape, fokus tilbake). Den lastes som en frittstående widget (`<script src="/embed/placy-chat.js" data-endpoint=… data-page-id=…>`), samme innbyggingskode som en WordPress-side ville brukt, og leser gjeldende side fra `data-placy-page-id`. Serveren (`app/api/demo/leangenbukta-chat/route.ts`, `lib/demo/leangenbukta-chat/`) bruker Anjas datasett, instruks og kunnskapsverktøy (`loadLiveDemo("leangenbukta-lokal")`) uten kartstyrende verktøy, kaller Responses med `store: false`, krever verktøybevis for faktasvar og slipper bare gjennom lenke-ID-er fra sideregisteret. Historikken bæres av et signert, besøksbundet token; serveren lagrer ingen samtaler og logger bare metadata. Hver feil gir lenker til Board og salgsteamet.

Runtime-LLM-kallet er et navngitt unntak fra `CLAUDE.md`s regel, bestilt av Andreas for denne demoen (planens KTD4).

### Prototype- og datagrense (2026-09-24)

Chatten er en prototype. Toppen av panelet har merket «Prototype», og statuslinja under sier at svarene ikke er godkjent av utbygger eller megler og viser «Nyeste registrerte kildekontroll» (`contentCheckedAt`, den nyeste `checkedAt` i `data/demo/leangenbukta-lokal/sources.json`, levert av `GET`). Datoen er ikke en påstand om at alle kildene er kontrollert da. Rekkefølgen i panelet er merkevare og prototypemerke, statuslinje, sidens hilsen og så sidens forslag til spørsmål; startes samtalen og brukeren bytter side, legges den nye sidens forslag nederst i samtalen. Ingen fakta er godkjent av Koteng Jenssen eller salgsteamet; publisering krever fortsatt egen godkjenning fra menneske og kunde.

- **Åpning og forslag.** `GET` gir en fast, sidetilpasset åpningsmelding (`pageOpening` i `instructions.ts`: forsiden om prosjektet, byggsider om bygget, Beliggenhet om nærområdet) og sidens forslag fra `pages.json`. Åpningen er ikke modelltekst og koster ingen kvote. Forslagene er ikke endret i denne runden.
- **Svarform.** Instruksjonstillegget ber om svaret først, ett forbehold når det finnes, og én neste handling; 2–4 setninger. Modellen skal si rett ut når spørsmålet bygger på et premiss kildene ikke støtter, og aldri påstå at utbygger står bak eller har godkjent et svar.
- **Forbehold per svar, ikke per melding.** Serveren setter `notice` bare når spørsmålet eller svaret handler om pris/ledighet (`sales`) eller innflytting/framdrift/årstall (`timing`), eller når et verktøysvar selv merket grunnlaget planlagt, forventet eller uavklart (`provisional`). Småprat og avslag får aldri forbehold.
- **Kilder.** Et faktasvar viser bare kilder som (1) modellen siterte i `source_ids`, (2) sto i et verktøysvar fra *denne* meldingen og (3) finnes i kilderegisteret (`lib/demo/leangenbukta-chat/sources.ts`). `find_project_info` oppgir bare kilde-URL; tekstchatten legger på `source_id` fra registeret før svaret går tilbake til modellen. En ID modellen finner på, eller en registerkilde verktøyene ikke returnerte, vises aldri. Widgeten viser kildene som ren tekst under «Kilder i oppslaget», med etikett og side, aldri som lenke.
- **Faste svar i stedet for modellens tekst.** Et faktasvar uten verktøybevis gir kunnskapshull-svaret. Et svar (uansett svartype unntatt avslag) som nevner et årstall ingen verktøysvar i meldingen har, gir et fast svar om at kildene ikke bekrefter årstallet; kildens kontrolldato teller ikke. Begge gir lenker til Board og salgsteamet og ingen kilder. Dette er vakten mot «2008»-feilen: et årstall brukeren selv nevner blir aldri bevis.

**Hva dette ikke beviser.** Skjemaet kan ikke bevise påstand-for-påstand-dekning. At en kilde vises, betyr at den var i grunnlaget verktøyene returnerte og at modellen siterte den, ikke at hver setning er kontrollert mot den. Andre tall enn årstall (pris, antall, reisetid) sjekkes ikke mot verktøysvaret. En modell som merker en faktapåstand som `smalltalk`, slipper faktavakten, men ikke årstallsvakten. Et firesifret beløp som «2050 kr» kan forveksles med et årstall og gi det faste svaret. Dagens ledighet og gjeldende priser finnes ikke i datagrunnlaget; chatten henviser til salgsteamet.

**Validert.** Enhets- og rutetester med mockede modellsvar mot det ekte `leangenbukta-lokal`-datasettet og widgeten i jsdom (`lib/demo/leangenbukta-chat/*.test.ts`, `app/api/demo/leangenbukta-chat/route.test.ts`). Ingen ekte modellkjøring i denne runden: arbeidsområdet hadde ingen `OPENAI_API_KEY`. Stemmen (Anja) bruker samme datasett og verktøy, men egen modellsti og egen instruks; ingenting her er validert eller endret for stemmen.

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
