# Lillebytunet — kilder for brand-pakken

Alt i `2026-09-20-production-brand.json` er hentet fra prosjektets egen side,
`https://bolig.skanska.no/prosjekter/lillebytunet` (hentet 2026-09-20). Ingen
farge, logo eller bilde er oppfunnet, og ingen Skanska-konsernmerkevare er brukt
— bare Lillebytunets egen prosjektidentitet.

## Assets

| Fil i repoet | Kilde |
|---|---|
| `public/illustrations/lillebytunet-logo.png` | `/imager/uploads/projects/lillebytunet/36181762/Lillebytunet_logo2_positiv_rgb_*.png` (1200×188, RGBA), uendret |
| `public/illustrations/lillebytunet-pin.png` | Samme logo, beskåret til kløvermerket (186×186 px av originalen), skalert til 360 px og sentrert i en 512×512 transparent flate med sikker luft rundt, slik markørens sirkelklipp krever |
| `public/illustrations/lillebytunet-splash.jpg` | `/imager/uploads/projects/lillebytunet/interior/50712083/Lillebytunet_Eksterioer_Drone-26_Plyo_*.jpg`, skalert til 2000 px bredde |

Ingen hero-film finnes på prosjektsiden (siden har én Vimeo-embed som ikke er en
splash-film), derfor er `splashVideoUrl` utelatt. Det var tidligere et påkrevd
felt; se worklogen 2026-09-20 for generaliseringen.

## Farger

Målt i nettleseren på prosjektsiden, eller samplet direkte i logo-PNG-en:

| Felt | Verdi | Hvor den kommer fra |
|---|---|---|
| `surfaceColor` | `#fff9e1` | Sidens og headerens bakgrunnsfarge (`rgb(255, 249, 225)`), den mest dominerende flaten |
| `inkColor` | `#304323` | Samplet i ordmerkets stamme i logo-PNG-en |
| `accentColor` | `#5fc091` | Samplet i det grønne kløverbladet |
| `accentForegroundColor` | `#1b3c27` | Sidens mørkegrønne seksjonsfarge (`rgb(27, 60, 39)`); gir lesbar kontrast på `#5fc091`, der hvit ikke gjør det |
| `mutedColor` | `#fffdf3` | Sidens lyse seksjonsfarge (`rgb(255, 253, 243)`) |
| `mutedForegroundColor` | `#6f7b67` | Dempet grønn i sidens palett |
| `pinAccent` | `#5fc091` | Samme som `accentColor` — kløvergrønnen leses godt mot satellittkartet |

## Avvik som er valgt bevisst

- **`headingFontFamily: "Figtree"`.** Prosjektsiden bruker «Shape Sans Display»,
  som ikke er blant de godkjente boardfontene (`Mukta`, `Unbounded`, `Figtree`).
  Figtree er den nærmeste i karakter. Vekt 600 er sidens egen h1-vekt.
- **`radius: "2px"`.** Prosjektsidens knapper er helt firkantede (`0px`).
  2px følger de to boardene som allerede er verifisert i produksjon, og
  forskjellen er ikke synlig i boardets komponenter. Endres om Skanska ber om det.

## Innholdsfelt (`2026-09-20-production-content.json`)

| Felt | Verdi | Belegg |
|---|---|---|
| `label` | `Lillebytunet` | Prosjektets eget navn |
| `city` | `Trondheim` | Boardets POI-adresser (f.eks. «Stjørdalsveien 4, Trondheim») |
| `district` | `Lilleby` | Prosjektsidens egen stedfesting, «Leiligheter og rekkehus på Lilleby»; området heter det samme i boardets egne data (Lilleby stasjon, Extra Lilleby, KIWI Lilleby) |
| `pinSubtitle` | `Nybygg 2028` | Prosjektsiden oppgir «Estimert innflytting 2028». Verdien er skrevet EKSPLISITT selv om den er lik markørens globale default, slik at årstallet er kildebelagt for dette prosjektet og ikke arvet |
| `pinAccent` | `#5fc091` | Kløvergrønnen fra logoen |
| `hideBrokerCard` | `true` | Boardet har ingen `brokers`-data; kortet rendret en tom «Ansvarlig megler»-seksjon. Samme valg som Nyhavna og Leangenbukta |
| `heroIntro` | se JSON | Bygd på prosjektsidens egen ingress («Leiligheter og rekkehus på Lilleby», «Nye hjem mellom Trondheim sentrum og Lade») pluss boardets eget løfte. Ingen påstand om kvalitet, pris, regulering eller ferdigstillelse ut over årstallet over |

Ingen temaer og ingen FAQ-er er lagt til her: Lillebytunet har ingen
researchpakker, og et prosjekttema krever en redaksjonell brødtekst som må
kildekontrolleres. Se worklogen for hva som gjenstår.
