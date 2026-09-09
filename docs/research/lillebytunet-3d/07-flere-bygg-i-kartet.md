# Flere bygg i samme kart

Skrevet 2026-09-09. Demoen viste tidligere én modell av gangen, så de to leverte byggene
kunne bare åpnes i to separate URL-er. Nå står de i samme kart, og det er det som gjør
naboforholdet kontrollerbart: hvert bygg er kontrollert alene i sin egen runde, men
**«Hus B og Hus C står riktig i forhold til hverandre» er en egen påstand**, og ingen
enkeltbygg-kontroll kan avvise den.

## Slik åpnes den

```
http://localhost:3002/demo/lillebytunet-3d?buildings=husB,husC&focus=husC
```

`buildings` leser de leverte byggene ut av registeret i
`lib/map/lillebytunet-buildings.ts`, hvert med sin egen målte plassering. `focus` sier
hvilket bygg de faste vinklene sikter på; vinkelen «Begge bygg» sikter i stedet på
midtpunktet og trekker seg langt nok ut til å ha begge i bildet.

Uten `buildings` gjelder de gamle enkeltmodell-parameterne uendret (`model`, `lat`, `lng`,
`heading`, `alt`, `altmode`, `scale`). Det er veien `capture-quality.mjs` og
kjøreoppskriftene bruker, og en modell som ikke er levert ennå har ingen plass i
registeret. Ukjente id-er i `buildings` hoppes over, så en skrivefeil gir de byggene som
faktisk ble navngitt i stedet for en tom side.

Registeret er kilden til plasseringen, ikke URL-en: `lat`, `lng`, `heading` og fotavtrykk
per bygg kommer fra `georef_building.py` og er de samme tallene som er publisert i
[Hus C-rapporten](05-hus-c.md). Høyde og skala hører ikke til bygget og kommer fortsatt
fra URL-en.

## Hvordan raden rammes inn

`siteExtent` regner ut midtpunktet og utstrekningen, og `siteCameraPreset` gjør
utstrekningen til en `range`. Utstrekningen er ikke avstanden mellom byggsentrene, men
boksen om sentrene utvidet med hvert byggs **egen halve diagonal** — ellers faller enden av
det lengste bygget utenfor bildet så snart det ligger ytterst i raden. For Hus B og Hus C
gir det 77,1 m diagonal og `range` 231 m, mot 150 m for ett bygg alene.

## Kontrollen

Fanget med `capture-quality.mjs --buildings husB,husC --focus husC`, som nå krever **én
tilknyttet `Model3DElement` og ett 200-svar per bygg** i hver visning — en visning der bare
det ene bygget kom fram, feiler kjøringen i stedet for å bli et bilde ingen ser feilen i.
Bevis i `site/` (`capture.json` og fem bilder), Chrome 152, ingen console-feil, 2 av 2
modeller i alle fem visninger.

| Visning | Kamera | Hva den viser |
|---|---|---|
| `site.jpg` | 200° / tilt 55 / 231 m | Begge byggene i samme bilde, med gata og nabokvartalene rundt. Byggene skjærer ikke i hverandre: åpningen mellom dem måler omtrent 9 m, som er det de publiserte målene tilsier (33,8 m mellom sentrene, minus 13,8 m og 11,2 m halve langsider). |
| `n.jpg` | 180° / tilt 45 / 150 m | Hus C (øst, hvitpusset) og Hus B (vest, kledd i tre) fra baksiden. Høydeforskjellen leser riktig: Hus C er 25,75 m mot Hus Bs 19,31 m. |
| `e.jpg` | 270° / tilt 45 / 150 m | Hus C foran Hus B. Den eneste visningen der det ene bygget dekker det andre — riktig, siden de står på linje mot ØSØ. |
| `s.jpg` | 0° / tilt 45 / 150 m | **Begge balkongsidene vender samme vei**, mot SSV. Det er den kontrollen ingen enkeltmodell kunne gjøre: 200° for Hus B og 202,4° for Hus C er målt hver for seg, og at de faktisk står parallelt i kartet er en bekreftelse på fortegnsregelen i `georef_building.py`. |
| `near.jpg` | 25° / tilt 60 / 65 m | Materialene side om side. Her blir det tydelig som var en subtil feil hver for seg: **Hus Bs tak er for lyst.** Ved siden av Hus Cs målte, mørke membran leser Hus Bs tak lyst rosagrått. Til gjengjeld har Hus Bs trekledning tekstur der Hus Cs nærhvite puss er flat — en materialforskjell, ikke en feil. |

Funnene om Hus Bs tak er de samme som er dokumentert i
[Hus C-rapporten](05-hus-c.md): medianen i den leverte teksturen er (0,55, 0,53, 0,58) mot
(0,34, 0,34, 0,38) målt med samme metode. Rettelsen er ett felt i `hus_b_quality.json`, men
Hus B er regresjonsgrunnlaget som holder de delte skriptene ærlige, så den venter på en
uttalt beslutning.

## Grenser

- **Registeret har bare de leverte byggene.** Hus A, Hus D og rekkehusene er stedfestet i
  [Hus C-rapporten](05-hus-c.md), men ikke modellert, så de finnes ikke som `.glb`.
- **Terrenghøyden `HUS_B_GROUND_MASL` er felles.** Den flytter ikke byggene — modellene er
  `CLAMP_TO_GROUND` — men siktepunktets høyde er Hus Bs terreng for begge. Kartverket gir
  16,9 m ved Hus C mot 16,53 m ved Hus B.
- **Render-riggens avstand er fortsatt Hus Bs.** `?cam=render` bruker det valgte byggets
  eget nullpunkt, men riggens 46,6 m og siktehøyde 8 m er Hus Bs, så et høyere bygg
  beskjæres. Samme åpne punkt som i [arbeidsmåten](../../solutions/workflow-issues/render-til-byggmodell-krever-visuelle-akseptansekriterier.md).
- **Fotavtrykkene i registeret er oversiktsmålene**, ikke GLB-enes egne mål. De brukes bare
  til å ramme inn bildet.

## Slik legges neste bygg inn

Én oppføring i `LILLEBYTUNET_BUILDINGS` med `georef_building.py`s utdata, og bygget kan
stå i kartet ved siden av de andre samme dag som GLB-en er levert. Da bør også
kontrollpunktet for naboforhold kjøres — se
[arbeidsmåten](../../solutions/workflow-issues/render-til-byggmodell-krever-visuelle-akseptansekriterier.md).

## Relatert

- [Hus C: pilot, kjøreoppskrift og restavvik](05-hus-c.md)
- [Hus B: kvalitetsrunde](04-kvalitetsrunde.md)
- [Kartintegrasjonen: aksene Google faktisk leser](02-kartintegrasjon.md)
- [Gjenoppbygging av datagrunnlaget](06-gjenoppbygging.md)
