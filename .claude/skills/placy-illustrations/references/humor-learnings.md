# Humor i illustrasjoner — Mode C (tørr juxtaposition)

Destillert fra humor-eksperimentet 2026-04-15 (5 varianter generert via Gemini Nano Banana Pro).

## Konsept

Mode C = **tørr juxtaposition.** To elementer i scenen som kommenterer hverandre uten å si det. Ikke to separate spøker — én joke med to synlige elementer. Subtilt voksen-humor, ikke slapstick.

> Humoren skal oppdages, ikke skrikes.

## Kjerneregler

1. **Alle figurer i middle-ground.** 8–15 % av canvas-høyde. Aldri close-ups, aldri "sticker-på-bakgrunn"-effekt.
2. **Maks 2 humor-detaljer per bilde.** Flere enn det blir rotete og mister den tørre tonen.
3. **Samme skala som andre figurer** i scenen. Humor-figurene skal smelte inn, ikke dominere.
4. **Humoren oppdages på andre blikk.** Første gang: ser man et nabolag. Andre gang: smiler man.

## Bevist-sterke mønstre

### A. Visuelt rim mellom menneske og dyr (SVAKESTE å få til, STERKESTE når det lykkes)
Hund i play-bow-positur ved siden av person i yoga child's pose.
Play-bow er en ekte hund-gest som ser yoga-aktig ut — katalyserer umiddelbar gjenkjennelse.
**Brukes når:** scenen inkluderer trening, avslapping, eller park.

### B. Tempo-juxtaposition
Sprinter passerer eldre person med rollator / jogger passerer eldre par hånd-i-hånd.
Visuelt kodet: to hastigheter i samme ramme.
**Brukes når:** scenen viser bevegelse eller trening.

### C. Environment humor (bygg-nivå, ikke karakter-nivå)
Burger-sjappe rett ved siden av gymmet. Rødgult takskjerm + rund burger-logo (uten tekst).
Lesbart som "fast food" uten å bryte no-text-regelen.
**Brukes når:** mixed-use bygg er allerede i scenen.

### D. Parent & barn, ulike fokus
Forelder med telefon opp (scroller), barn i vogn peker på spurv/ting på bakken.
Barnet ser, forelderen scroller.
**Brukes med forsiktighet:** kan bli preachy hvis overdrevet.

## Kjente svakheter

- **Kroppsspråk-nyanser er svakere i Gemini.** "Sliten pull-up person, slumpet kropp, hengende hode" blir ofte nøytralisert. Hold emosjonelle cues enkle eller bruk visuelt rim (punkt A) i stedet.
- **Første-forsøk plasserer ofte humor-figurene i forgrunnen.** Må eksplisitt prompte middle-ground og skala. Stressteste outputen mot "ser figuren ut som sticker på bakgrunnsbildet?" — hvis ja: regenerer.
- **Standalone trehus er FEIL norsk kontekst.** Skift alltid til 3-etasjes bygård med kommersielt i 1. etg + leiligheter over for urban-forstad.

## Prompt-tillegg for humor

Lim inn i bunn av scene-prompten når humor er ønsket:

```
SUBTLE HUMOR (Mode C — dry juxtaposition, not slapstick):
- Include maximum 2 humor details, both as middle-ground figures at 8-15% canvas height
- [SPECIFIC DETAIL, e.g.: "a person in child's pose yoga with a dog in play-bow position next to them — the dog's posture visually rhymes with the yoga pose"]
- Humor should be discovered on second look, not shouted
- Same scale as other figures in the scene — never close-ups
- NO slapstick, NO cartoon exaggeration, NO facial comedy
```

## Status for kategori-humor

Parkert 2026-04-15. Konseptet bevist (trening-aktivitet-humor-c er sterkeste eksempel), men trenger fokusert sesjon for å:
- Lande stil-konsistens på tvers av alle 7 kategorier
- Bestemme hvilke humor-elementer som er "Placy-signaturer" vs per-bilde
- Eventuelt iterere trening-c for å fikse sliten-pull-up-svakheten

Originale illustrasjoner (uten humor) forblir i bruk inntil beslutning. Humor-varianter (5 stk) ligger i `public/illustrations/*-humor-*.jpg`.
