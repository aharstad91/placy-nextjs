# Tekst og tale i Leangenbukta-chatten — UX-prøve 24.09.2026

## Observerte behov

Andreas' tre minutters muntlige prøve av demoen ga disse konkrete observasjonene:

- 00:25: «Hva er Leangenbukta?» ga et svar om manglende grunnlag. Dette er et eget problem med faktagrunnlag/oppslag, ikke et utslag av modusbyttet.
- 00:51: Mikrofoninformasjonen hører hjemme i chatloggen, men kan utformes som en lesbar boble.
- 01:18: Modusvalgene kan hete «Skriv» og «Snakk». «Snakk med Anja» er langt i den smale raden.
- 01:24–02:17: Statusprikk, start/stopp og skrivefelt vises samtidig i talemodus. Det gjør det uklart hva brukeren skal gjøre. Ved «Snakk» bør komponisten bli et talefelt, mens tidligere meldinger blir stående.
- 02:47: Muligheten til å skrive mens stemmen er aktiv er uavklart. I denne demoen prioriteres et tydelig valg mellom de to måtene å sende neste melding på.

## Mønstre og beslutning

[ChatGPT Voice](https://help.openai.com/en/articles/20001274-chatgpt-voice) har både integrert tekst og tale i én samtale og en separat taleopplevelse. Den viser også talte svar som tekst i chatloggen. Det bekrefter verdien av én historikk, men avgjør ikke hvordan Placy skal bruke plassen i et smalt nettstedspanel. Her skal «Skriv» vise tekstfelt og sendeknapp, mens «Snakk» viser én tydelig talekontroll og status i samme bunnområde. Loggen, panelrammen og samtalekonteksten blir stående under byttet. Skriving blir tilgjengelig igjen med ett trykk på «Skriv», som også avslutter mikrofonen og overfører historikken.

[Apples tilgjengelighetsråd](https://developer.apple.com/design/human-interface-guidelines/accessibility) sier at status ikke bør uttrykkes bare med farge, og at viktig lydinformasjon må finnes som tekst. Derfor skal statusprikken ha ord ved siden av, Anjas tale fortsatt vises som tekst, og skjermlesere få statusendringene. Overgangen skal være rolig og respektere redusert bevegelse.

Mikrofoninformasjonen vises første gang som en nøytral, venstrejustert boble i loggen. Korte meldinger om modusbytte og om historikken ble med forblir egne systemmeldinger. Dette skiller praktisk informasjon fra det Anja faktisk sier.

## Prøvekriterier

Ved bytte mellom «Skriv» og «Snakk» skal bunnfeltet endre funksjon uten at hele panelet hopper. I talemodus skal skrivefelt og sendeknapp være skjult også for tabulatornavigasjon. Status skal være forståelig uten farge. Ved retur til «Skriv» skal neste melding vente på serverens historieoverføring, og en feil skal forklares i loggen. Det nye datagrunnlaget og formatet som utvikles parallelt er utenfor denne UX-endringen.

## Tillegg: kategorier som samtalestart

I en ny muntlig tilbakemelding ønsket Andreas Boardets horisontale kategorirad under chatheaderen (00:12–00:26 og 01:41–02:08). Bildet han viste tilsvarer `StoryRail` i `components/variants/report/board/story/StoryRail.tsx`: lys avrundet skinne, fargede ikonsirkler og hvit aktiv brikke. I den frittstående chatwidgeten kan React-komponenten ikke importeres direkte; utseende, kategorinavn, ikoner og farger skal hentes fra samme Board-kontrakt og vises med widgetens egen DOM.

De eksisterende spørsmålsforslagene skal fortsatt finnes. Valgt kategori skal gi tre konkrete spørsmål i samme forslagsoverflate, og bytte av kategori skal ikke starte en ny samtale eller endre kunnskapsgrunnlaget. Raden skal kunne rulles horisontalt i det smale panelet. Kategoriene kommer fra dagens Board; de kuraterte spørsmålene kan ligge i demoens visningslag til det parallelle dataarbeidet har avklart formatet.
