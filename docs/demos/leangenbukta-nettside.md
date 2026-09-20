# Leangenbukta-nettside for Koteng-demoen

Lokal inngang: <http://localhost:3103/demo/leangenbukta-nettside> (porten er den dev-serveren din kjører på).

Flyt: forsiden → deres eget illustrerte kart → **Utforsk nabolaget** → den kildekontrollerte lokale demoen `/demo/leangenbukta-lokal` i ny fane. Samme knapp ligger på **Beliggenhet**, som er nytt punkt i hovedmenyen. Kun forsiden og Beliggenhet er bygd; alle andre menypunkter går til de ekte sidene på leangenbukta.no.

## Poenget med demoen

Leangenbukta har allerede en nabolagsseksjon på forsiden: først deres eget illustrerte kart, så et Leaflet-kart med åpne OpenStreetMap-fliser og én markør. Replikaen beholder illustrasjonen og setter Placy der Leaflet-kartet ligger i dag. Det er altså ikke et nytt felt limt oppå siden — det er den eksisterende kartseksjonen med et bedre innhold, og det er hele argumentet i møtet.

## Filer og drift

- `app/demo/leangenbukta-nettside/`: `page.tsx` (forsiden), `beliggenhet/page.tsx`, `site-chrome.tsx` (header, mobilmeny, bunnfelt), `placy-row.tsx` (Placy-inngangen), `arrow.tsx`. `original.css` er kundens stilark med hver selektor avgrenset til `.leangenbukta-site`; `demo.css` er våre tillegg. Ingen global Placy-CSS er endret.
- `public/demo/leangenbukta-nettside/`: bilder, logoer, fonter, ikonfonter og forsidefilmen. Ingen forespørsel går til leangenbukta.no eller fonts.gstatic.com ved lasting — kontrollert i nettverksfanen.
- Rutene er sperret i produksjon: `layout.tsx` kaller `notFound()` når `NODE_ENV === "production"`, og begge sidene har `robots: noindex, nofollow`.
- Lenken til boardet er relativ, så port- og domenebytte ikke krever endring.
- Slett `app/demo/leangenbukta-nettside/` og `public/demo/leangenbukta-nettside/` for å fjerne demoen. Ingenting annet er rørt — boardet, Nyhavna-demoen og produksjonsdataene står som før.

## Hva som er vårt og hva som er deres

Markupen er kundens egen, hentet fra et øyeblikksbilde av forsiden. Klasse- og data-attributtene fra Salient/WPBakery er beholdt slik at temaets CSS treffer nøyaktig som på deres side. Tre ting er våre:

1. **Filmen i helten** spilles av et ekte `<video>`-element. Originalen lar plugin-en Advanced Backgrounds sette den inn med JavaScript vi ikke importerer.
2. **Leaflet-raden er byttet ut** med Placy-inngangen (`placy-row.tsx`), som bruker kundens egne klasser (`wpb_row`, `nectar-button`) og fargene fra deres eget stilark.
3. **Beliggenhet** er en ny side. Teksten er bygd på kundens eget språk fra `/om-prosjektet/#beliggenhet` og fra forsidens «En del av Ladestien, fjæra og kulturlandskapet».

Kontaktskjemaet vises, men sender ingenting: `method="dialog"` gjør at knappen ikke poster noe sted. Originalens Contact Form 7-, cookie-, sporing- og reCAPTCHA-skript er ikke importert.

## Kilder og ressurser

Øyeblikksbilde av <https://leangenbukta.no/> og <https://leangenbukta.no/om-prosjektet/>, hentet 16.09.2026, sammen med de 37 stilarkene og de 13 inline-blokkene forsiden laster. Tekst, design, logo, bilder og film tilhører Koteng Jenssen og OBOS og brukes i den lokale replikaen.

- Film: `Film-til-landingside_low.mov` fra deres mediebibliotek, omkodet til H.264 (`hero-film.mp4`) fordi HEVC i .mov ikke er trygt i Chrome. `hero-poster.jpg` er et stillbilde fra 1 sekund.
- Illustrert kart: `wp-content/uploads/2024/08/Kart-over-leangenbukta-1.png`.
- Fonter: Mukta, Zilla Slab og Open Sans fra Google Fonts, lagret lokalt som woff2. Salients ikonfont (icomoon) og Font Awesome 4.7 er lagret som woff.
- Stilark som ikke er tatt med fordi forsiden ikke bruker dem: Gutenberg block-library, image-map-pro, nectar-slider, TablePress, cookie-consent og Font Awesome 6.

## Kjente forskjeller fra originalen

- **Salients innganimasjoner er slått av.** Temaet flytter og toner inn seksjoner med waypoints i `init.js`. Vi importerer ikke temaets skript, så elementene settes rett i ferdig tilstand i `demo.css`. Uten dette ville halve siden stått forskjøvet.
- **Det illustrerte kartet vises ikke på mobil.** Kunden har selv satt `vc_hidden-sm vc_hidden-xs` på den kolonnen — på telefon viser originalen Leaflet-kartet i stedet. I replikaen står Placy-inngangen der. Kjør demoen på desktop hvis du vil vise før/etter-poenget med illustrasjonen.
- **Undermenyene i mobilmenyen har ikke pil-ikoner.** Salient legger dem inn med JavaScript.
- **Lukkeknappen i mobilmenyen** er vår egen enkle X. Temaets versjon tegnes av JavaScript vi ikke kjører.

## Fallgruver i CSS-en (verdt å huske til neste replika)

Tre ting stoppet arbeidet og er fikset i skriptet som bygger `original.css`:

1. **`html`/`body` må fjernes fra selektorene, men spesifisiteten må kompenseres.** `html body .vc_row-fluid>.span_12` er avhengig av å slå `.col`; stryker du bare `html body`, snur rekkefølgen og kolonnene kollapser. Hver fjernet rot-node erstattes derfor av `:is(div)`, som har spesifisiteten til ett type-selektor og alltid treffer wrapperen.
2. **`display:-ms-flexbox` rett etter `display:flex`** får Lightning CSS i Next 16 til å droppe hele `display`-erklæringen. Alle `-ms-`-erklæringer fjernes.
3. **IE-hacks og skrivefeil i kundens egen CSS** (`*line-height`, `!improtant`) stopper bygget. De ryddes bort før parsing.

Salient setter også `material-ocm-open` på `<body>` og har regler der body-klassen er forfar til bakteppet. Når klassen i stedet står på wrapperen, må de tre reglene gjentas med klassen slått sammen med scope-klassen — det ligger i `demo.css`.

## Kontroll

Chrome, nystartet profil. Desktop 1440 × 900: forsiden sammenlignet rad for rad med originalen — alle radene ligger på samme y-posisjon og har samme høyde som på leangenbukta.no. Mobil 390 × 844: samme kontroll, radhøydene er innenfor noen få piksler av originalen. Mobilmenyen åpner, viser Beliggenhet, lukker seg ved valg, ved klikk på bakteppet og med Escape. CTA-en åpner boardet i ny fane. 0 feil og 0 advarsler i konsollen, og ingen forespørsler til leangenbukta.no.

`npx tsc --noEmit`, `npm run lint`, `npm test` (4 384 tester) og `npm run build` er grønne. Nyhavna-demoen er kontrollert uendret i samme runde — `git diff` viser ingen endringer i `app/demo/nyhavna-nettside/` eller `public/demo/nyhavna-nettside/`.
