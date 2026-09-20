# Leangenbukta-nettsiden til Koteng-møtet 22.09 — plan

**Dato:** 16. september 2026. **Møte:** mandag 22.09 kl. 10 med Nora Reese (leder markedsføring, Koteng Jenssen) og Lena Rømo. Trello: [Koteng Jenssen — Leangenbukta](https://trello.com/c/3taIqu7L), forberedelsesdato 21.09.

**Oppdrag:** Bygg en lokal kopi av leangenbukta.no — forsiden og en beliggenhetsside — som viser hvordan Placy limes inn i kundens egen nettside. Samme grep som `app/demo/nyhavna-nettside/`.

**Avgrenset (Andreas, 16.09):** Boardet ligger som det er. Denne runden handler kun om nettsiden.

---

## 1. Mønsteret vi gjentar

Nyhavna-kopien (`app/demo/nyhavna-nettside/`, bruksanvisning i `docs/demos/nyhavna-nettside.md`) er bygd slik:

- `original.css` — kundens egen CSS, hver selektor avgrenset til `.nyhavna-site`. `demo.css` — våre tillegg. Ingen global Placy-CSS rørt.
- `public/demo/nyhavna-nettside/` — logo, fonter, film og bilder lokalt. Ingen forespørsel går til kundens domene ved lasting.
- Forsiden og **én ny side** er bygd. Alle andre menypunkter peker til de ekte sidene.
- Beliggenhet-siden har én CTA som åpner boardet i ny fane, på samme origin, så port- og domenebytte ikke krever endring i lenken.
- CMS-, cookie-, sporings- og nyhetsbrevskript importeres ikke.

## 2. Hva Leangenbukta stiller med

**WordPress med Salient-temaet (18.0.2).** 37 stylesheets fra tema og plugins, 13 inline `<style>`-blokker, fonter Mukta / Zilla Slab / Open Sans fra Google Fonts. Tyngre å hente enn nyhavna.no sin ene `main.css`, men samme mekaniske grep.

**Forsiden har allerede en kart-seksjon.** `id="kart"` viser deres eget illustrerte nabolagskart (`wp-content/uploads/2024/08/Kart-over-leangenbukta-1.png`). Nyhavna hadde ingenting tilsvarende — der måtte vi finne på et menypunkt. Her finnes seksjonen fra før, og det er derfor det beste stedet å vise innliming: statisk tegning over, inngang til det levende nabolaget rett under.

**`/om-prosjektet/` har et `#beliggenhet`-anker** med fyldig prosa om kollektivknutepunkt, Ladestien, sykkelveier og skolenærhet. Vi bygger ikke den siden, men teksten der er råstoff til beliggenhetssiden vår, og ankeret viser at «beliggenhet» er deres eget ord.

**Boardet CTA-en peker til:** `/eiendom/placy-demo/leangenbukta/rapport-board` — det eksisterende nivå-2-boardet i produksjonsdata (1 209 steder, strøket Lade). Urørt i denne runden.

---

## U1. Snapshot av leangenbukta.no

Hent forsiden med alle 37 stylesheets, de 13 inline-blokkene, fonter, det illustrerte kartet og bildene forsiden bruker. Lagre under `public/demo/leangenbukta-nettside/`. Skript for CMS, cookie-samtykke, sporing og skjema importeres ikke. Kilde, hentedato og rettighetshaver dokumenteres slik `docs/demos/nyhavna-nettside.md` gjør det.

**Ferdig når:** alle ressurser ligger lokalt, nettverksfanen viser null forespørsler til leangenbukta.no ved lasting, og kildelista er skrevet.

## U2. Rutestativ og avgrenset CSS

`app/demo/leangenbukta-nettside/` med `layout.tsx` (fonter, header, footer, `.leangenbukta-site`-wrapper), `original.css` (kundens sammenslåtte CSS, hver selektor prefikset) og `demo.css` (våre tillegg). Headerens lenker peker til de ekte sidene på leangenbukta.no, unntatt Beliggenhet. `data-no-transition` på interne lenker — Placy-layoutens capture-handler tar dem ellers før headerens `onClick` (funnet og rettet på Nyhavna).

**Ferdig når:** forsiden er visuelt sammenlignet side-ved-side med originalen på desktop og 390 × 844, menyen åpner og lukker, og ingen Placy-side har endret utseende.

## U3. Forsiden med Placy-inngangen i kart-seksjonen

Forsiden gjenskapt, med to tillegg: «Beliggenhet» inn i hovedmenyen (som på Nyhavna), og under deres illustrerte kart i `#kart` en kort linje som anerkjenner kartet de har laget, pluss en knapp — «Utforsk nabolaget» — som åpner boardet i ny fane.

**Ferdig når:** begge inngangene virker i nettleser på desktop og mobilbredde, og kart-seksjonen ser ut som deres egen, ikke som et Placy-felt limt oppå.

## U4. Beliggenhetssiden

Egen side under samme skall: kort ingress bygd på deres eget `#beliggenhet`-språk (kollektivknutepunkt, Ladestien, fjorden, Lade som handelsakse), ett bilde fra deres materiale, og hoved-CTA-en «Utforsk nabolaget med Placy» — med bildet som klikkflate i tillegg, slik Nyhavna har det. `robots: noindex, nofollow`. Brødsmulesti tilbake til forsiden.

**Ferdig når:** siden er kontrollert på desktop og 390 × 844, CTA-en åpner faktisk boardet i ny fane, og teksten er sjekket mot kilden på leangenbukta.no.

## U5. Verifisering og bruksanvisning

`tsc`, `lint`, `npm test`, `npm run build`. Nettleserkontroll på 1440 × 900 og 390 × 844 i nystartet Chrome, 0 konsollfeil. Nyhavna-demoen kontrolleres uendret i samme runde. `docs/demos/leangenbukta-nettside.md` skrives etter samme mal som Nyhavna-dokumentet: flyt, filer, drift, kilder, kontroll og hvordan demoen fjernes igjen.

**Ferdig når:** alle mekaniske sjekker er grønne, hele flyten forside → `#kart` / Beliggenhet → board er kjørt uten stopp, og bruksanvisningen ligger i repoet.

---

## Avgrensning

**Ikke i denne runden:** boardets innhold (FAQ, kuraterte highlights, lokalt datasett, stemmeguide), publisering til Vercel eller et offentlig domene, skriving til Supabase, endring av det eksisterende produksjonsboardet, og ekte embed i kundens nettsted.

**Tas opp igjen etter møtet:** en faktisk embed på leangenbukta.no avhenger av hvem som eier nettsiden og om Salient-oppsettet tåler en iframe. Spørsmålet stilles i møtet, ikke før.

## Åpne punkter

- **Møteformen er ikke bekreftet** — Teams-lenke finnes, fysisk sted er uavklart. Demoen kjøres lokalt uansett, men skjermdeling av 3D-kartet over Teams bør prøves før mandag hvis det blir digitalt.
- **Demoen er sperret i produksjon** (`NODE_ENV === "production"` → `notFound()`), som Nyhavna-rutene. Det består til Andreas ber om noe annet.
