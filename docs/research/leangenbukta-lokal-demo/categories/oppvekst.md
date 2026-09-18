# U6-kategorivurdering: Oppvekst

Kontrolldato: 2026-09-18. Status: **innhold kuratert; runtime-import blokkert av U4**.

Alle **20 av 20** strukturerte kandidater er vurdert. Ingen reisetid eller avstand er beregnet.

## Beslutningsregnskap

| Beslutning | Antall |
|---|---:|
| `defer` | 5 |
| `member` | 2 |
| `start_set` | 6 |
| `topic_only` | 7 |

## Kandidater

| ID | Kandidat | Beslutning | Kartbehandling | Begrunnelse |
|---|---|---|---|---|
| OPP-01 | Lade skole | `start_set` | `create_after_entrance_and_coordinate_check` | Relevant for kategorien og støttet av kontrollert primærkilde. Kartpublisering venter dersom inngang eller koordinat ikke er verifisert. |
| OPP-02 | Lade SFO | `member` | `attach_to_parent_without_duplicate_marker` | Lade SFO publiserer nå konkret åpningstid 07.15–16.30; rårapportens uavklarte tidsfelt er foreldet. |
| OPP-03 | Ladesletta barnehage | `start_set` | `create_after_entrance_and_coordinate_check` | Relevant for kategorien og støttet av kontrollert primærkilde. Kartpublisering venter dersom inngang eller koordinat ikke er verifisert. |
| OPP-04 | Tiriltoppen barnehage | `defer` | `hold` | Mangler fersk primærkilde, faktisk inngang, driftsstatus eller tilstrekkelig presisjon for publisering. |
| OPP-05 | Leangen kulturbarnehage SA | `start_set` | `create_after_entrance_and_coordinate_check` | Relevant for kategorien og støttet av kontrollert primærkilde. Kartpublisering venter dersom inngang eller koordinat ikke er verifisert. |
| OPP-06 | Lade barnehager (enhet) | `defer` | `hold` | Mangler fersk primærkilde, faktisk inngang, driftsstatus eller tilstrekkelig presisjon for publisering. |
| OPP-07 | Lademoen barnehage | `defer` | `hold` | Mangler fersk primærkilde, faktisk inngang, driftsstatus eller tilstrekkelig presisjon for publisering. |
| OPP-08 | Persaunet barnehage | `defer` | `hold` | Mangler fersk primærkilde, faktisk inngang, driftsstatus eller tilstrekkelig presisjon for publisering. |
| OPP-09 | Planlagt offentlig barnehage, Leangenbukta | `topic_only` | `no_marker_reuse_or_conversation_only` | Relevant samtalekunnskap eller gjenbruk av et sted med annen primærkategori; skal ikke opprette en ny markør her. |
| OPP-10 | Lade skole lek | `start_set` | `create_after_entrance_and_coordinate_check` | Relevant for kategorien og støttet av kontrollert primærkilde. Kartpublisering venter dersom inngang eller koordinat ikke er verifisert. |
| OPP-11 | Ladeparken lek | `start_set` | `create_after_entrance_and_coordinate_check` | Relevant for kategorien og støttet av kontrollert primærkilde. Kartpublisering venter dersom inngang eller koordinat ikke er verifisert. |
| OPP-12 | Ringvebukta lek | `topic_only` | `no_marker_reuse_or_conversation_only` | Relevant samtalekunnskap eller gjenbruk av et sted med annen primærkategori; skal ikke opprette en ny markør her. |
| OPP-13 | Leangen gård park | `topic_only` | `no_marker_reuse_or_conversation_only` | Relevant samtalekunnskap eller gjenbruk av et sted med annen primærkategori; skal ikke opprette en ny markør her. |
| OPP-14 | Torg og uteområder, Leangenbukta | `topic_only` | `no_marker_reuse_or_conversation_only` | Relevant samtalekunnskap eller gjenbruk av et sted med annen primærkategori; skal ikke opprette en ny markør her. |
| OPP-15 | Lade fritidsklubb | `start_set` | `create_after_entrance_and_coordinate_check` | Kommunens gjeldende side oppgir gaming mandag 16–18 med påmelding, ikke onsdag som i rårapporten. |
| OPP-16 | Lade Motor | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| OPP-17 | Lade skoles musikkorps | `topic_only` | `no_marker_reuse_or_conversation_only` | Relevant samtalekunnskap eller gjenbruk av et sted med annen primærkategori; skal ikke opprette en ny markør her. |
| OPP-18 | SK Trygg/Lade — allidrett | `topic_only` | `no_marker_reuse_or_conversation_only` | Relevant samtalekunnskap eller gjenbruk av et sted med annen primærkategori; skal ikke opprette en ny markør her. |
| OPP-19 | Leangen idrettspark (kunstisbane) | `topic_only` | `no_marker_reuse_or_conversation_only` | Relevant samtalekunnskap eller gjenbruk av et sted med annen primærkategori; skal ikke opprette en ny markør her. |
| OPP-20 | Leangen Ishall | `defer` | `hold` | Mangler fersk primærkilde, faktisk inngang, driftsstatus eller tilstrekkelig presisjon for publisering. |

## Prøvbare kjøperspørsmål

### broad: Hvilke oppveksttilbud er dokumentert?

Lade skole, Lade SFO, Ladesletta barnehage, Leangen kulturbarnehage, kommunale lekeområder og Lade fritidsklubb er relevante kandidater. Skolekretsen for adressen er fortsatt uavklart.

### specific: Hva er åpningstiden til Lade SFO?

Skolens gjeldende SFO-side oppgir 07.15–16.30.

### follow_up: Sokner Haakon VIIs gate 14 til Lade skole?

Det er ikke verifisert. Lade skole er en relevant skole i området, men skolekrets må slås opp for adressen i kommunens løsning.

### unknown: Er det ledig plass i barnehagen?

Det kan ikke utledes fra kapasitetstall. Ledig plass varierer og må avklares gjennom kommunens opptak.

### interruption_resume: Fortsett om fritidstilbud etter et avbrudd.

Fortsett med Lade fritidsklubb og tilknyttede tilbud; bruk oppdatert mandagsprogram og ikke rårapportens onsdagsopplysning.

## Runtime- og kartstatus

Denne leveransen oppretter ingen runtime-POI-er. U4s felles `local-board`-skjema, register og kontrollerte startpunkt finnes ikke ennå. Kandidater med `start_set` er derfor innholdsvalg, ikke ferdigimporterte kartpunkter. Faktisk inngang og koordinat må lukkes før kartpublisering.

Den maskinlesbare og komplette vurderingen, inkludert råfelter og kilder, ligger i JSON-filen med samme navn.
