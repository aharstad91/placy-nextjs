# Nyhavna-nettside for Lene-demo

Lokal inngang: <http://localhost:3103/demo/nyhavna-nettside>.

Flyt: forsiden → **Beliggenhet** → **Utforsk Nyhavna med Placy** → eksisterende `/demo/nyhavna-lokal` i ny fane. Kun forsiden og Beliggenhet er bygd. Andre menypunkter peker til originalsidene på nyhavna.no. Nyhetsbrev/backend og øvrige undersider er ikke gjenskapt.

## Filer og drift

- `app/demo/nyhavna-nettside/`: egne React-sider, header og medieavspilling. `original.css` er originalens CSS med selektorer avgrenset til `.nyhavna-site`; `demo.css` inneholder demoens tillegg. Ingen global Placy-CSS er redigert.
- `public/demo/nyhavna-nettside/`: lokale bilder, logo, animasjon, film og fonter.
- Arbeidskopi/branch: `../placy-nyhavna-nettside`, `feat/nyhavna-nettside-demo`. Bare de to nye mappene er kopiert additivt til hovedarbeidskopien for serveren på 3103. Eksisterende demo-/stemme-/dataendringer er ikke en del av denne leveransen.
- Lenken til Placy bruker samme origin, slik at port/domenebytte ikke krever endring i lenken. Eksisterende `/demo/nyhavna-lokal` er fortsatt sperret i produksjon; Vercel-publisering må håndteres separat når Andreas ber om det.
- Slett de to nye mappene for å fjerne demoinngangen. Ikke gjenopprett andre filer eller fjern eksisterende `/demo/nyhavna-lokal`.

## Kilder og ressurser

Snapshot av <https://nyhavna.no/> og <https://nyhavna.no/dist/css/main.css>, hentet 2026-09-14. Tekst, design, logo, bilder og film tilhører respektive rettighetshavere og brukes i den bestilte lokale replikaen. Originalens CMS-, cookie-, sporing- og nyhetsbrevskript er ikke importert.

- Logoanimasjon: <https://nyhavna.no/media/ssepufz4/nyhavna-lottie.json>.
- Film: Nyhavnas egen forsidefilm (Vimeo 1094958438). `harbour-poster.jpg` og `nyhavna-aerial.jpg` er stillbilder ved 3 og 4,5 sekunder.
- Nyhetsbilder: originalforsidens fire artikkelbilder, lagret som `news-0.webp` til `news-3.webp`.
- Unbounded: Google Fonts, vekter 400, 600 og 700. Figtree gjenbrukes fra Placy-layouten.
- Avspiller: `lottie-web` 5.13.0, lokal kopi fra npm/unpkg. MIT-lisens i `LOTTIE-LICENSE.md`.

## Kontroll

Safari: original og replika visuelt sammenlignet på desktop; begge nye sider kontrollert ved 390 × 844. Menyen åpner/lukker, Beliggenhet er tilgjengelig i toppmeny og snarveier, og CTA åpnet faktisk `/demo/nyhavna-lokal` i egen fane på 3103. Den eksisterende demos velkomstside ble observert lastet. Ingen ny talesamtale startet.

En feil funnet under mobiltesten ble rettet: Placy-layoutens capture-handler tok interne lenker før headerens `onClick`. Menylenkene bruker nå den eksisterende `data-no-transition`-reservasjonen, og ny nettlesertest bekreftet lukket meny etter valg.

Ingen nye enhetstester for den reversible visuelle demosiden; nettlesertesten er funksjonsbeviset. Redusert bevegelse er håndtert i kode, men ikke prøvd ved endring av brukerens OS-innstillinger. Full sjekkstatus og review-referanse loggføres i `PROJECT-LOG.md`.
