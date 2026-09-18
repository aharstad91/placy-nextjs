# U6-kategorivurdering: Trening

Kontrolldato: 2026-09-18. Status: **innhold kuratert; runtime-import blokkert av U4**.

Alle **18 av 18** strukturerte kandidater er vurdert. Ingen reisetid eller avstand er beregnet.

## Beslutningsregnskap

| Beslutning | Antall |
|---|---:|
| `defer` | 4 |
| `exclude` | 1 |
| `external_reference` | 1 |
| `member` | 3 |
| `start_set` | 5 |
| `topic_only` | 4 |

## Kandidater

| ID | Kandidat | Beslutning | Kartbehandling | Begrunnelse |
|---|---|---|---|---|
| TRE-01 | 3T-Lade | `start_set` | `create_after_entrance_and_coordinate_check` | 3Ts gjeldende avdelingsside dokumenterer spa-basseng, dampbad og kaldkulp ved 3T-Lade; dette var uavklart i rårapporten. |
| TRE-02 | Impulse Leangen | `start_set` | `create_after_entrance_and_coordinate_check` | Relevant for kategorien og støttet av kontrollert primærkilde. Kartpublisering venter dersom inngang eller koordinat ikke er verifisert. |
| TRE-03 | Impulse Lade | `start_set` | `create_after_entrance_and_coordinate_check` | Relevant for kategorien og støttet av kontrollert primærkilde. Kartpublisering venter dersom inngang eller koordinat ikke er verifisert. |
| TRE-04 | Fresh Fitness Lade Arena | `exclude` | `never_import_as_current_place` | Kjedens egen side varslet at senteret ikke skulle være i drift etter 1. februar 2026. Det skal ikke vises som aktivt tilbud uten ny direkte bekreftelse. |
| TRE-05 | Treningssenteret i Trygg/Lade-hallen | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| ANL-01 | Leangen idrettspark | `start_set` | `create_after_entrance_and_coordinate_check` | Relevant for kategorien og støttet av kontrollert primærkilde. Kartpublisering venter dersom inngang eller koordinat ikke er verifisert. |
| ANL-02 | Leangen kunstisbane | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| ANL-03 | Leangen Arena / Leangen Ungdomshall (ishaller) | `member` | `attach_to_parent_without_duplicate_marker` | Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører. |
| ANL-04 | Lade idrettspark | `defer` | `hold` | Mangler fersk primærkilde, faktisk inngang, driftsstatus eller tilstrekkelig presisjon for publisering. |
| ANL-05 | Trygg/Lade-hallen | `start_set` | `create_after_entrance_and_coordinate_check` | Relevant for kategorien og støttet av kontrollert primærkilde. Kartpublisering venter dersom inngang eller koordinat ikke er verifisert. |
| ANL-06 | Lade Tennisarena | `defer` | `hold` | Mangler fersk primærkilde, faktisk inngang, driftsstatus eller tilstrekkelig presisjon for publisering. |
| UTE-01 | Ladestien | `topic_only` | `no_marker_reuse_or_conversation_only` | Relevant samtalekunnskap eller gjenbruk av et sted med annen primærkategori; skal ikke opprette en ny markør her. |
| UTE-02 | Trimstasjon Ladestien (Djupvika) | `defer` | `hold` | Mangler fersk primærkilde, faktisk inngang, driftsstatus eller tilstrekkelig presisjon for publisering. |
| SVØ-01 | Husebybadet | `external_reference` | `outside_core_no_local_marker` | Dekker et behov som ikke er dokumentert lokalt. Beholdes som tydelig merket referanse utenfor kjerneområdet. |
| SVØ-02 | A4 Arena, Tiller | `defer` | `hold` | Mangler fersk primærkilde, faktisk inngang, driftsstatus eller tilstrekkelig presisjon for publisering. |
| KLU-01 | SK Trygg/Lade | `topic_only` | `no_marker_reuse_or_conversation_only` | Relevant samtalekunnskap eller gjenbruk av et sted med annen primærkategori; skal ikke opprette en ny markør her. |
| KLU-02 | Trondheim Sandvolleyballklubb | `topic_only` | `no_marker_reuse_or_conversation_only` | Relevant samtalekunnskap eller gjenbruk av et sted med annen primærkategori; skal ikke opprette en ny markør her. |
| BEB-01 | Treningsrom, Knutepunktet | `topic_only` | `no_marker_reuse_or_conversation_only` | Relevant samtalekunnskap eller gjenbruk av et sted med annen primærkategori; skal ikke opprette en ny markør her. |

## Prøvbare kjøperspørsmål

### broad: Hvilke treningstilbud er dokumentert?

3T-Lade, Impulse Leangen, Impulse Lade, Leangen idrettspark og Trygg/Lade-hallen er kontrollerte kandidater. Fresh Fitness skal ikke vises som aktivt tilbud.

### specific: Når kan publikum bruke Leangen kunstisbane?

I sesong er gratis tid uten reservasjon publisert tirsdag/torsdag 11.15–16 og onsdag/fredag 10–16. Kveld og helg varierer og må sjekkes.

### follow_up: Har 3T-Lade basseng?

Ja. Avdelingens gjeldende side oppgir spa-basseng, dampbad og kaldkulp.

### unknown: Er beboertreningsrommet i Knutepunktet ferdig?

Det er ikke dokumentert ferdigstilt. Det behandles som en planlagt beboerfasilitet, uten offentlig adgang eller kjent utstyrsliste.

### interruption_resume: Fortsett om treningssentre etter et avbrudd.

Fortsett fra valgt senter og hold adgangstid og bemannet tid adskilt.

## Runtime- og kartstatus

Denne leveransen oppretter ingen runtime-POI-er. U4s felles `local-board`-skjema, register og kontrollerte startpunkt finnes ikke ennå. Kandidater med `start_set` er derfor innholdsvalg, ikke ferdigimporterte kartpunkter. Faktisk inngang og koordinat må lukkes før kartpublisering.

Den maskinlesbare og komplette vurderingen, inkludert råfelter og kilder, ligger i JSON-filen med samme navn.
