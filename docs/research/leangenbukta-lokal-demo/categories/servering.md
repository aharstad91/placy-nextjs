# U6-kategorivurdering: Servering

Kontrolldato: 2026-09-18. Status: **innhold kuratert; runtime-import blokkert av U4**.

Alle **21 av 21** strukturerte kandidater er vurdert. Ingen reisetid eller avstand er beregnet.

## Beslutningsregnskap

| Beslutning | Antall |
|---|---:|
| `defer` | 1 |
| `exclude` | 1 |
| `member` | 15 |
| `start_set` | 3 |
| `topic_only` | 1 |

## Kandidater

| ID | Kandidat | Beslutning | Kartbehandling | Begrunnelse |
|---|---|---|---|---|
| SRV-01 | Ladekaia | `start_set` | `create_after_entrance_and_coordinate_check` | Relevant for kategorien og støttet av kontrollert primærkilde. Kartpublisering venter dersom inngang eller koordinat ikke er verifisert. |
| SRV-02 | Sponhuset (Vertshuset Strandheim) | `defer` | `hold` | Mangler fersk primærkilde, faktisk inngang, driftsstatus eller tilstrekkelig presisjon for publisering. |
| SRV-03 | Egon Lade | `start_set` | `create_after_entrance_and_coordinate_check` | Relevant for kategorien og støttet av kontrollert primærkilde. Kartpublisering venter dersom inngang eller koordinat ikke er verifisert. |
| SRV-04 | Snurr Håndverksbakeri | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| SRV-05 | Kompis Lade | `start_set` | `create_after_entrance_and_coordinate_check` | Relevant for kategorien og støttet av kontrollert primærkilde. Kartpublisering venter dersom inngang eller koordinat ikke er verifisert. |
| SRV-06 | DIGG Sirkus | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| SRV-07 | Dromedar Sirkus Shopping | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| SRV-08 | Krem Mat og Kaffehus | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| SRV-09 | Rosenborg Bakeri LadeTorget | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| SRV-10 | Café Victoria | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| SRV-11 | Rosenborg Bakeri City Lade | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| SRV-12 | Espresso House City Lade | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| SRV-13 | Obs! Kafé | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| SRV-14 | Sabrura Sticks & Sushi | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| SRV-15 | Wood | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| SRV-16 | ThaiThai | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| SRV-17 | Big Bite City Lade | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| SRV-18 | Jordbærpikene City Lade | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| SRV-19 | Burger King Lade Arena | `member` | `attach_to_parent_without_duplicate_marker` | Lade Arenas gjeldende offisielle butikkside lister Burger King; rårapportens driftsstatus er dermed styrket, men stedet beholdes som sentermedlem. |
| SRV-20 | Næringslokale, Leangenbukta Bygg E/H | `topic_only` | `no_marker_reuse_or_conversation_only` | Relevant samtalekunnskap eller gjenbruk av et sted med annen primærkategori; skal ikke opprette en ny markør her. |
| SRV-21 | Lounge, Knutepunktet | `exclude` | `never_import_as_current_place` | Loungen er dokumentert som beboerfellesareal, ikke offentlig eller kommersiell servering. Den utelates fra serveringssteder. |

## Prøvbare kjøperspørsmål

### broad: Hvilke serveringssteder er dokumentert?

Ladekaia, Egon Lade, Kompis Lade og Burger King Lade Arena er reviderte, selvstendige kartpunkter. Fyr på Lade og Franske Nytelser vises som selvstendige registerpunkter. Øvrige spisesteder beholdes som medlemmer under kjøpesentre eller andre ankre.

### specific: Hva er åpent på City Lade søndag?

Egon i Solrekka oppgis åpent 12–22 og Snurr 10–16. Resten av senteret er stengt med mindre virksomheten publiserer egen tid.

### follow_up: Kan jeg bestille takeaway fra Kompis?

Kompis publiserer egne takeaway-tider som følger restauranttidene, inkludert søndag 13–22.

### unknown: Leverer de til Haakon VIIs gate 14?

Det er ikke kontrollert. Leveringsområde må sjekkes for den konkrete adressen i bestillingstjenesten.

### interruption_resume: Fortsett om sjøservering etter et avbrudd.

Fortsett med Ladekaia og sesongforbeholdet; ikke love at publisert tid gjelder uten oppfriskning.

## Runtime- og kartstatus

Denne leveransen oppretter ingen runtime-POI-er. U4s felles `local-board`-skjema, register og kontrollerte startpunkt finnes ikke ennå. Kandidater med `start_set` er derfor innholdsvalg, ikke ferdigimporterte kartpunkter. Faktisk inngang og koordinat må lukkes før kartpublisering.

Den maskinlesbare og komplette vurderingen, inkludert råfelter og kilder, ligger i JSON-filen med samme navn.
