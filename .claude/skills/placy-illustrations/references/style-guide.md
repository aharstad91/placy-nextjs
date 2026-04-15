# Placy Watercolor Style Guide

The "Wesselsløkka-akvarell"-stilen — destillert fra illustrasjonene i `public/illustrations/` og dokumentert her som den kanoniske spec'en.

## Visuell signatur

**Én setning:** Løs pen/ink-skisse med dempet akvarell-vask på pure-white papir — arkitektur-illustrasjon, ikke tegneserie.

## Palett

| Farge | Bruk |
|-------|------|
| Terrakotta-teglstein | Bygningsvolum, varme flater |
| Sage-grønn | Løvverk, parker, natur |
| Varm krem / off-white | Fasader, pussede overflater |
| Mykt grå | Tak, stein, sekundærbygg |
| Varmt brunt | Trestrukturer, benker, lekestativ |
| Dempet gul/oker | Aksent — sjeldent |
| Pure white | Bakgrunn, papiroverflate som skinner gjennom |

Fargene skal oppleves som akvarell-pigmenter (dempet, kalkaktige), ikke foto-mettet.

## Teknikk

- **Ink-strek:** synlig håndtegnet pennstrek på alle arkitektoniske kanter. Lett ujevn, ikke teknisk ren.
- **Akvarell-wash:** fyller IKKE konturene helt. Hvit papir skinner gjennom i partier.
- **Papir-tekstur:** akvarell-granulering skal være synlig.
- **Bakgrunn:** fader til pure white mot kantene. INGEN rektangulær crop, INGEN ramme, INGEN fotoramme.
- **Himmel:** for det meste hvitt papir, eventuelt 1-2 veldig lette vask-strøk.
- **Refleksjoner i vann:** løse akvarell-strøk, aldri fotografisk.
- **Skygger:** myke, minimale. Aldri hardt kontrastfull eller dramatisk belysning.

## Komposisjon

- **Format:** landscape. Standardvalg `3:2` eller `16:9`. Bruk `4:3` for nærscener.
- **Figurer:** ALLE i middle-ground. Skala 8–15 % av canvas-høyde. Aldri close-ups. Aldri én figur som dominerer.
- **Bygninger:** norsk urban-forstad-realisme. Mixed-use 3–4 etasjer, kommersielt i 1. etg + leiligheter over. IKKE standalone trehus.
- **Vegetasjon:** løse klumpe-klyngetrær rammer ofte scenen fra kantene.
- **Lys:** myk ettermiddagsdagslys. Ingen solnedgang-drama, ingen neon, ingen nattscener.

## Negativlista (ALDRI)

- ❌ Tekst eller skilt med lesbar tekst
- ❌ Fotorealisme eller foto-mettet belysning
- ❌ Dramatisk solnedgang / neon / night-mode
- ❌ Nærbilder av ansikter eller close-up karakterer
- ❌ Karikert / tegneserie-stil
- ❌ Hard rektangulær crop eller bildeframe
- ❌ Standalone trehus som eneste bygg-type i norsk urban-forstad
- ❌ Kunstige glorier/highlights som "pluggy CGI"

## Kvalitetscheck før godkjenning

1. Fader bakgrunnen til hvitt papir mot kantene?
2. Er alle figurer i middle-ground, 8–15 % canvas-høyde?
3. Er ink-streken synlig og "hand-drawn" ujevn?
4. Skinner hvitt papir gjennom akvarell-washen noen steder?
5. Er paletten dempet (akvarell-pigmenter), ikke foto-mettet?
6. Finnes det tekst i bildet? (skal IKKE være der)
7. Er belysningen myk dagslys, ikke dramatisk?

Hvis ett av disse feiler: regenerer med strengere style-lock, eller iterer på prompten.

## Faste stil-ankre (`assets/`)

Ankere skal **alltid** brukes som reference images ved generering. Velg 1–3 basert på scenens karakter:

| Asset | Karakter | Bruk når scenen er... |
|-------|----------|----------------------|
| `anchor-playground.jpg` | Nærscene, liten bygning, få figurer | Oppvekst, barnehage, nabolagscorner |
| `anchor-cafe.jpg` | Gatenivå, café, middels tempo | Mat & drikke, smågate, handel |
| `anchor-wesselslokka.png` | Bredere kompleks, park, mange figurer | Master-scener, parkanlegg, overoversikt |
