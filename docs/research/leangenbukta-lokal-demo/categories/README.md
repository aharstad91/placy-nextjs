# Leangenbukta U6 — kategoripakke

Kontrolldato: 2026-09-18.

Alle **145 av 145** strukturerte kandidater i de syv rårapportene er vurdert. Pakken inneholder **35** prøvbare kjøperspørsmål.

Denne katalogen er det kuraterte beslutningsgrunnlaget for runtime-importen. `start_set` betyr at kandidaten er valgt redaksjonelt og kildekontrollert på innholdsnivå. Selve importkvitteringen ligger i `../runtime-import-report.json`; koordinat- og rutekvitteringene ligger ved siden av.

| Kategori | Kandidater | Startsett | Medlemmer | Tema | Eksterne | Utsatt | Utelatt |
|---|---:|---:|---:|---:|---:|---:|---:|
| [Natur](natur.md) | 15 | 4 | 0 | 7 | 1 | 3 | 0 |
| [Transport](transport.md) | 39 | 1 | 0 | 19 | 0 | 15 | 4 |
| [Hverdag](hverdag.md) | 18 | 3 | 10 | 1 | 0 | 4 | 0 |
| [Oppvekst](oppvekst.md) | 20 | 6 | 2 | 7 | 0 | 5 | 0 |
| [Servering](servering.md) | 21 | 3 | 15 | 1 | 0 | 1 | 1 |
| [Trening](trening.md) | 18 | 5 | 3 | 4 | 1 | 4 | 1 |
| [Opplevelser](opplevelser.md) | 14 | 3 | 0 | 4 | 4 | 1 | 2 |

## Gjenbruk

Kanoniske steder har ID-er som `place:ringve-musikkmuseum`, `place:ladekaia` og `place:leangen-stasjon`. De tilhører ikke Leangenbukta og kan gjenbrukes av senere boards, blant annet bruktboliger. `board_id` beskriver bare at stedet er valgt til dette boardet. Prosjektfasiliteter bruker `facility:leangenbukta:*` og skal ikke gjenbrukes som globale steder.

## Importstatus

Alle 26 startsteder og 29 medlemmer er importert. LadeTorget er lagt til som ett avledet strukturanker for tre valgte medlemmer. Kartpunktene er kontrollert mot Google Places eller en dokumentert primærkoordinat; der faktisk publikumsinngang ikke er bekreftet, er plasseringen eksplisitt merket omtrentlig. Mapbox Matrix har beregnet gange, sykkel og bil fra boardets kontrollerte startpunkt til alle 27 synlige reviderte ankre. Tidsfølsomme felt har fortsatt kontrolldato 18.09.2026 og må oppfriskes før senere publisering.

`status`- og `runtime_status`-feltene i kategori-JSON-ene beskriver fasen da beslutningspakken ble generert, før U4-runtime var koblet. De er historiske revisjonsfelt og skal ikke leses som dagens importstatus. Gjeldende sannhet ligger i `../import-manifest.json` og `../runtime-import-report.json`.

## Reproduser vurderingen

`_build_u6.py` gjenskaper beslutningspakken fra de bevarte rårapportene. `_measure_travel_times.py` lager rutekvitteringen, og `_build_runtime.py` bygger runtime-JSON utelukkende fra reviderte pakker og kvitteringer. Det siste skriptet leser aldri rårapportene.
