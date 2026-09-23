# Leangenbukta.no — inventar, snapshot og dekningsregnskap (U1)

Sjekket 23.09.2026. Kilde: `https://leangenbukta.no`. Metode og skript: se
`scripts/demo/leangenbukta-inventory/README.md`.

## Kontrollsum

**295 URL-er oppdaget = 295 URL-er disponert.** (Sitemap ga 53 unike sider av
55 oppføringer i `wp-sitemap.xml`; resten er lenker fulgt fra forsiden, menyen,
footer og de oppdagede sidene — inkludert dokumenter/medier under
`/wp-content/`, arkiv-/paginering-sider og to sitekilde-bugs, se under.)

| | Antall |
|---|---|
| URL-er oppdaget totalt | 295 |
| — herav dokument/media (`/wp-content/uploads`, ikke lastet ned) | 92 |
| — herav de to samlede bug-gruppene (personvern-lenke 103, mailto-lenke 19) | 122 |
| Manifest-rader (`manifest.json`, bug-grupper telt én gang hver) | 175 |
| `disposition: local` | 49 |
| `disposition: duplicate` | 21 |
| `disposition: external` | 93 (73 media/dokumenter + boligvelger/kundeportal-familien) |
| `disposition: unavailable` | 12 (10 boligvelger-dyplenker, 1 ekte brukket lenke, 1 samle-oppføring mailto-bug) |

## To bugs på kildesiden (samlet til én rad hver, ikke 60+)

- **Relativ personvern-lenke.** Cookie-samtykkebanneret lenker med
  `href="personvern"` (uten ledende `/`) på alle sider. Nettleseren løser
  dette relativt til gjeldende side, så WordPress serverer den ekte
  `/personvern/`-siden ett nivå ned (`<side>/personvern/`, 200, canonical
  peker korrekt til `/personvern/`) og 404 to nivåer ned. 103 berørte URL-er,
  ingen av dem er egne sider. Ekte side: `/personvern/`.
- **Relativ mailto-lenke.** Kontakt-e-posten i footeren på artikkel-sider
  mangler `mailto:`-prefiks (`href="jan.erik.fjeldseth@obos.no"`), løses
  relativt og 404-er. 19 forekomster. Den ekte, fungerende lenken
  (`mailto:jan.erik.fjeldseth@obos.no`) ligger på forsiden.

Begge bør flagges til kunden som reelle bugs på leangenbukta.no, uavhengig av
kundedemoen.

## Byggsider (kind: building), 12 med egen side + 5 duplikat-slugger

| Bygg | URL (id) | Status ifølge siden selv | Lenker til boligvelger | Lenker til prospekt |
|---|---|---|---|---|
| Bygg C (Saltakshus C) | saltakshusc | «Ferdigstilt» nevnt i teksten | Nei | Ja |
| Bygg C — tilvalg | tilvalgbyggc | Undersides for bygg C, ingen egen status | Nei | Nei |
| Knutepunktet | knutepunktet | Ikke eksplisitt i statisk tekst (boligvelger-widget) | Ja | Ja |
| Saltakshus H | saltakshush | Ikke eksplisitt i statisk tekst (boligvelger-widget) | Ja | Ja |
| Saltakshus I | saltakshus-i | Tittel: «36 nye leiligheter for salg» — i salg | Nei | Ja |
| Saltakshus J | saltakshus-j | Tittel: «39 nye leiligheter for salg» — i salg | Nei | Ja |
| Saltakshus K | saltakshusk-2 | Innhold er en byggestart-nyhet, ikke ordinær byggside; «Nytt salgstrinn» nevnt | Nei | Nei |
| Byvilla 1 og 2 | byvilla-1-og-2 | Tittel: «24 nye leiligheter for salg» — i salg | Nei | Ja |
| Bygg L (Saltakshus L) | nytt-salgstrinn-bygg-l | «Nytt salgstrinn» | Nei | Ja |
| Toppleilighet L504 (enhet i Bygg L) | toppleilighetl504 | Ikke eksplisitt i statisk tekst | Nei | Nei |
| Rekkehus 19–27 | rekkehus19-27 | «ferdigstilt», «kommer for salg» og «solgt» forekommer alle — blandet status per enhet | Nei | Ja |
| Parktunet 1 (Bygg D) | parktunet1-2 | Ikke eksplisitt i statisk tekst (boligvelger-widget) | Nei | Ja |

Duplikat-slugger (canonical peker til byggsiden over, samme innhold, ikke
egne sider): `byggetrinn-1-byvilla-4-og-5` → saltakshusk-2,
`byggetrinn-1-rekkehus` → nytt-salgstrinn-bygg-l, `saltakshusk` →
saltakshusk-2, `parktunet1` → parktunet1-2.

**Fant ingen dedikert byggside for «Byvilla 3, Rekkehus 1-4»** — lenket fra
forsiden, men URL-en (`/byvilla-3-rekkehus1-4/`) gir 404. Ekte, uforklart
brukket lenke — flagg til kunden.

Status er lest av statisk HTML alene. De fleste byggsidene bruker et
JavaScript-drevet boligvelger-widget (Plyo) for faktisk ledighet/pris, som
denne crawlen ikke utfører — «ikke eksplisitt angitt» betyr at statusen
sannsynligvis vises dynamisk, ikke at den mangler på det ekte nettstedet.

## Sidetyper og hva de krever utover forsiden

Forsiden (`original.css`, `public/demo/leangenbukta-nettside/*`) dekker
Salient-kjernen (grid, off-canvas-meny, skin, responsive), Font Awesome 4
(legacy), Google Fonts Mukta/Open Sans, WPBakery/js_composer,
sticky-side-buttons, smooth-scroll, contact-form-7 kjerne-CSS, leaflet og
magnific-popup.

| Sidetype (kind) | Antall lokale sider | Ekstra stilark utover forsiden | Komponenter observert |
|---|---|---|---|
| home | 2 (forside, test-framside) | — | video-bakgrunn, kart (interactive image map), slider |
| building | 12 | `single.css` (post-type byggsider), `widget-nectar-posts.css` | flickity-galleri, lightbox/magnific, tabs (tilvalg), video på enkelte |
| project | 5 | `salient-portfolio/portfolio.css` (galleri), `nectar-slider.css` (innflyttingsklare) | slider, flickity-galleri |
| article | 7 | `single.css`, `salient-social/style.css` (delingsknapper) | lightbox, sosiale delingsknapper |
| info | 40 | `tablepress-combined.min.css` (prislister/tabeller), `element-toggles.css` (FAQ-akkordeoner), Font Awesome 6 (cdnjs, brukt parallelt med legacy 4) | accordion/toggle, kontaktskjema (cf7 + honeypot), tabeller |
| archive | 12 | `blog/masonry-core.css`, `blog/masonry-classic-enhanced.css` | masonry-grid, forfatter/kategori-filter (WP-standard, ingen egen kode) |

Site-globale ekstra stilark funnet på **alle** lokale sider (ikke i
`original.css` fra før): `wp-includes/css/dist/block-library/style.min.css`
(Gutenberg-kjerneblokker), `webtoffee-gdpr-cookie-consent` sine tre CSS-filer
(cookie-banneret — kilden til personvern-lenke-bugen over),
`image-map-pro-wordpress/image-map-pro.min.css` (det interaktive kartet på
forsiden/beliggenhet-lignende seksjoner), `contact-form-7-honeypot` (0 byte —
tom fil på kildeserveren) og `useanyfont/uaf.css` (0 byte — samme). Alle 18
nedlastbare er lagt i `docs/research/leangenbukta-nettside/css/` med
rekkefølge og brukssider i `css-manifest.json`. Ett stilark (en `ver=6.9.9`
variant av Mukta/Zilla Slab-fonten med en dobbel skråstrek-URL,
`/css/?family=…`) 404-et på kilden — ufarlig, `ver=6.9.7`-varianten av samme
fontfamilie er allerede hentet til forsiden.

## Boligvelger-familien (`leangenbukta.no/boligvelger/…`)

Egen understi på selve domenet som viser/proxyer Plyo sitt
boligvelger-widget. Rot-URL-en (`/boligvelger/`) har canonical til
`https://leangenbukta.plyo.cloud/standalone-aptcho/` — ekte funksjonalitet
er ekstern. Tre byggspesifikke varianter (`knutepunktet`, `rekkehus`,
`saltakshush`) har canonical tilbake til selve byggsiden — registrert som
duplikat. Ti enhets-dyplenker (`saltakshush/h103` osv.) og to
byggspesifikke innganger (`saltakshusi`, `saltakshusl`) gir 404 — dette er
klientsiderute i Plyo-appen, ikke server-URL-er, og registrert som
`unavailable`.

## Eksterne domener

20 domener katalogisert i `external-links.json`, med URL-er, hvilke sider
som lenker dit og anbefalt disposisjon (ekstern lenke til original). De
viktigste for kundedemoen: `leangenbukta.plyo.cloud` (boligvelger, 13
URL-er), `app.locka.cloud`/`haakonviigt14.locka.cloud`/`client.journeyapp.tech`
(kundeportaler per byggetrinn — **også `libitum.cloud`-varianter observert i
markup**, trolig en pågående migrering fra Locka til Libitum, samme
funksjon), `koteng.no`/`kotengjenssen.no`/`obos.no` (utbygger/medutbygger).

## Dokumenter og media (`/wp-content/uploads/`)

92 URL-er, **ikke lastet ned** (HEAD-sjekket for status/content-type/størrelse
i `head-probe.json`, alle 200). 19 PDF-er (`kind: document`, prislister,
prospekter, kjøpebekreftelser), 73 bilder (`kind: media`, 68 JPEG, 4 WebP,
1 PNG). Alle registrert med `disposition: external` — lenkes til originalen,
ikke kopiert inn i repoet (referansestørrelse hvis de hadde blitt lastet ned:
~281 MB, langt over budsjettet alene).

## Nedlastet størrelse (faktisk lagt i repoet)

| | Størrelse |
|---|---|
| HTML-snapshots (`snapshot/`, 118 sider — alle 200-svar inkl. personvern-lenke-bugens 55 duplikat-URL-er) | 25 MB |
| Bilder for lokale sider (`public/demo/leangenbukta-nettside/pages/`) | 188 MB (351 filer, mellomstore srcset-varianter 800–1600 px valgt fremfor original) |
| Nye stilark (`css/`) | 0,67 MB (18 filer) |
| **Sum nytt nedlastet innhold** | **~214 MB**, innenfor 350 MB-taket |

Disk hadde 4,5 GB ledig ved start; 4,2–4,4 GB ledig etter kjøring (noe
svingning fra andre samtidige agenter i samme mappe).

**Rettet feil underveis:** Første kjøring av crawleren lastet ned og
UTF-8-dekodet 92 `/wp-content/`-URL-er (PDF-er/bilder) som om de var HTML,
og skrev dem til `snapshot/*.html` (507 MB). Disse 92 filene er slettet;
`crawl.py` er rettet til å aldri lese body for annet enn
`content-type: text/html`, og til aldri å følge `/wp-content/`-lenker inn i
kø for videre crawling — dokument/media hentes nå kun via HEAD
(`head_probe.py`).

## Avvik og observasjoner

- **Sider i sitemap men ikke i menyen:** de fleste byggsidene, alle
  artikler/nyheter, alle info-sider (kjøpsprosess, fordeler, «stort til
  mindre» osv.), `test-framside` (utkast til ny forside, ikke publisert i
  navigasjonen — bygg ikke lokalt uten avklaring), portfolio/sjøparken x2
  (referanseprosjekt, ikke del av Leangenbukta).
- **Sider i lenker men ikke i sitemap:** ingen reelle — alle
  lenke-oppdagede URL-er utover sitemap-settet er enten
  dokument/media (`/wp-content/`), de to bug-familiene, arkiv-paginering,
  eller boligvelger-familien.
- **Redirects:** ingen ekte 30x-kjeder observert blant de 295 URL-ene (kun
  et par kosmetiske selv-referanser i `redirectChain` fra normaliserings-
  sammenligning i crawleren, ingen reell HTTP-redirect).
- **Kryssjekk mot meny (`site-chrome.tsx`):** alle 8 leangenbukta.no-lenkene
  i hovedmenyen (`aktuelt`, `apenhetsloven`, `bli-obos-medlem`, `galleri`,
  `kundeportal`, `om-prosjektet-2`, `personvern`, `salgsmateriell`) samt
  «Kart»-ankeret (`leangenbukta.no#kart` → forsiden) finnes i manifestet.
  De fire eksterne kundeportal-undermenylenkene og Plyo-boligvelgeren
  finnes i `external-links.json`.
- **Usikkerhet:** salgsstatus for 5 av 12 byggsider er ikke lesbar fra
  statisk HTML (rendres trolig i boligvelger-widgetet) — angitt eksplisitt i
  tabellen over i stedet for gjettet. `saltakshusk-2`/`byggetrinn-1-*`-
  krysningen (én artikkel dekker to ulike slugger for potensielt to ulike
  bygg — K og Byvilla 4/5) bør verifiseres manuelt mot kunden før bygging;
  crawlen kan bare bekrefte hva canonical-taggen sier, ikke hensikten bak
  URL-strukturen.
