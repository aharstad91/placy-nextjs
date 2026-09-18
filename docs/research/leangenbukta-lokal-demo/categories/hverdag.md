# U6-kategorivurdering: Hverdag

Kontrolldato: 2026-09-18. Status: **innhold kuratert; runtime-import blokkert av U4**.

Alle **18 av 18** strukturerte kandidater er vurdert. Ingen reisetid eller avstand er beregnet.

## Beslutningsregnskap

| Beslutning | Antall |
|---|---:|
| `defer` | 4 |
| `member` | 10 |
| `start_set` | 3 |
| `topic_only` | 1 |

## Kandidater

| ID | Kandidat | Beslutning | Kartbehandling | Begrunnelse |
|---|---|---|---|---|
| DG-01 | Obs City Lade | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| DG-02 | Meny Lade | `defer` | `hold` | Mangler fersk primærkilde, faktisk inngang, driftsstatus eller tilstrekkelig presisjon for publisering. |
| DG-03 | Rema 1000 Lade Arena | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| DG-04 | Coop Mega Sirkus Shopping | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| DG-05 | Bunnpris Lade | `defer` | `hold` | Mangler fersk primærkilde, faktisk inngang, driftsstatus eller tilstrekkelig presisjon for publisering. |
| KS-01 | City Lade | `start_set` | `create_after_entrance_and_coordinate_check` | Relevant for kategorien og støttet av kontrollert primærkilde. Kartpublisering venter dersom inngang eller koordinat ikke er verifisert. |
| KS-02 | Sirkus Shopping | `start_set` | `create_after_entrance_and_coordinate_check` | Relevant for kategorien og støttet av kontrollert primærkilde. Kartpublisering venter dersom inngang eller koordinat ikke er verifisert. |
| KS-03 | Lade Arena | `start_set` | `create_after_entrance_and_coordinate_check` | Relevant for kategorien og støttet av kontrollert primærkilde. Kartpublisering venter dersom inngang eller koordinat ikke er verifisert. |
| AP-01 | Vitusapotek City Lade | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| AP-02 | Apotek 1 Elefanten Lade | `defer` | `hold` | Mangler fersk primærkilde, faktisk inngang, driftsstatus eller tilstrekkelig presisjon for publisering. |
| AP-03 | Vitusapotek Lade Arena | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| AP-04 | Boots apotek LadeTorget | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| PO-01 | Lade Post i Butikk (REMA 1000 Ladetorget) | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| PO-02 | Lade Arena Post i Butikk (REMA 1000 Lade Arena) | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| VM-01 | Vinmonopolet Lade | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| VM-02 | Vinmonopolet Sirkus Shopping | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| RE-01 | Returpunkt glass/metall Lade | `defer` | `hold` | Mangler fersk primærkilde, faktisk inngang, driftsstatus eller tilstrekkelig presisjon for publisering. |
| LB-01 | Leangenbukta næringslokale (Bygg E/H) | `topic_only` | `no_marker_reuse_or_conversation_only` | Relevant samtalekunnskap eller gjenbruk av et sted med annen primærkategori; skal ikke opprette en ny markør her. |

## Prøvbare kjøperspørsmål

### broad: Hvilke hverdagstilbud er dokumentert?

City Lade, Sirkus Shopping og Lade Arena er kontrollerte ankre. Dagligvare, apotek, post og servering representeres som medlemmer under sentrene.

### specific: Hva er åpent på City Lade på søndag?

Selve senteret er stengt. City Lade oppgir egne søndagstider for Solrekka: Egon 12–22 og Snurr 10–16.

### follow_up: Finnes dagligvare og apotek på Lade Arena?

Ja. Senterets gjeldende butikkside lister Rema 1000 og Vitusapotek. Åpningstid må leses per virksomhet.

### unknown: Hvilket apotek kommer man raskest til?

Det er ikke beregnet. Flere apotek er dokumentert, men en slik sammenlikning krever kontrollert startpunkt og rute.

### interruption_resume: Fortsett om sentrene etter et avbrudd.

Fortsett fra valgt senter og dets medlemmer; ikke opprett egne kartmarkører for hvert medlem.

## Runtime- og kartstatus

Denne leveransen oppretter ingen runtime-POI-er. U4s felles `local-board`-skjema, register og kontrollerte startpunkt finnes ikke ennå. Kandidater med `start_set` er derfor innholdsvalg, ikke ferdigimporterte kartpunkter. Faktisk inngang og koordinat må lukkes før kartpublisering.

Den maskinlesbare og komplette vurderingen, inkludert råfelter og kilder, ligger i JSON-filen med samme navn.
