# Nyhavna /bo — aktivt demogrunnlag

Kontrollert 14. september 2026. Alle sju sider funnet i `/bo/`-navigasjonen er gjennomgått. Kildene er Nyhavna Utviklings egen beskrivelse; framtidige tilbud lagres som planer.

| Side | Bruk i demoen |
|---|---|
| [Bo](https://nyhavna.no/bo/) | Global felleskontekst, introduksjon og manus for bydelen |
| [Transittkaia](https://nyhavna.no/bo/transittkaia/) | Planpunkt, tre fakta og FAQ |
| [Kullkranpiren](https://nyhavna.no/bo/kullkranpiren/) | Planpunkt, tre fakta og FAQ |
| [Strandveikaia](https://nyhavna.no/bo/strandveikaia/) | Planpunkt, tre fakta og FAQ |
| [Ladehammerkaia](https://nyhavna.no/bo/ladehammerkaia/) | Planpunkt, tre fakta og FAQ |
| [Bunkerkvartalet](https://nyhavna.no/bo/bunkerkvartalet/) | Planpunkt, tre fakta og FAQ |
| [Nyhetsbrev](https://nyhavna.no/bo/nyhetsbrev/) | FAQ med lenke for å følge utviklingen; ingen automatisk påmelding |

## Redaksjonelle valg

Fem delområder, ikke fem nummererte byggetrinn. Transittkaia har selv flere etapper. Bunkerkvartalet beskrives med næring og kultur og presenteres ikke som et rent boligtrinn.

Framdrift fra utbygger beholdes med forbehold: Transittkaias 2027/2029 avhenger av planvedtak; Vitensenterets 2030 er en ambisjon. Pausen i Strandveien 100 er tatt med. Illustrasjoner og mulige aktiviteter presenteres ikke som vedtatte eller eksisterende tilbud.

Kort muntlig formidling ligger i `board.json` og `places.json`. Kilde-ID-er, kontrolldato og utdypende fakta ligger bak svarene. Globale temaer i `topics.json` følger backendens felleskontekst. Spørsmålet om hele bydelen står først i den nye kategoriens FAQ.

## Kartankre

En avgrenset agentoppgave kontrollerte plasseringene mot Kartverket. Koordinatene er representative områdepunkter, ikke grenser, innganger eller boligadresser. Ingen reisetider er lagt på disse fem punktene.

| Område | Breddegrad | Lengdegrad | Grunnlag |
|---|---:|---:|---|
| Transittkaia | 63.44244 | 10.41744 | Kartverket SSR, stedsnr. 116205 |
| Kullkranpiren | 63.44229 | 10.42076 | Kartverket SSR, stedsnr. 662041 |
| Strandveikaia | 63.44082 | 10.42420 | Kartverket SSR, stedsnr. 56048 |
| Ladehammerkaia | 63.44381 | 10.42216 | Kartverket SSR, stedsnr. 784047 |
| Bunkerkvartalet | 63.4405914777 | 10.4158908693 | Dora 2 / Transittgata 15 som områdeanker |

Eksakte oppslags-URL-er og kontrolldato ligger i `sources.json`, under `bo-kart-*`, `bo-dora2-adresse` og `bo-bunker-plassering`. Dora 2-ankeret er koblet til delområdet med [Nyhavnas verkstedmateriale](https://www.nyhavna.no/media/i1rlrrh0/251125-1.pdf).

## Verifisering

74 målrettede tester passerer, inkludert alle fem planpunktenes fakta, kart-ID-er og begge presentasjonsinnganger. TypeScript og målrettet ESLint passerer. Nettleseren viser den nye kategorien, planmerkingen og Transittkaias eget innhold ved klikk. Muntlig flyt, tempo og forståelsen av brukerens valg må prøves i en ny samtale.
