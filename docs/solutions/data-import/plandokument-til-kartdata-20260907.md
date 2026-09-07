---
name: Fra plandokument til kartdata — finn riktig plan, les tallene, plasser dem
description: Reguleringsplaner er den eneste kilden til byggehøyder for uoppførte prosjekter, men nabotomta har en plan som ser identisk ut. Terrengmodellen felte feil plan på ett minutt. Tekstlaget i arkitekt-PDF-er kan leses uten OCR (konstant kodeforskyvning), tegningen stadfestes mot tre veikryss fra OSM, og påskriftene tilordnes omrissene med en gate på flaggskipsbyggene.
type: data-import
problem_type: data_import
module: lib/map, scripts
date: 2026-09-07
tags: [reguleringsplan, pdf, ocr, georeferering, kartverket, dtm1, osm, overpass, byggehøyder, 3d, massing, wesselslokka, broset, verifisering]
---

# Fra plandokument til kartdata

## Kontekst

Volumene for Brøset sto på anslåtte 12 og 14 meter — flatt og likt, så feltet
leste som én kake i 3D. Oppgaven var å hente etasjetall fra en kilde i stedet
for å gjette. Prosjektet er ikke bygd, så det finnes ingen FKB-bygning, ingen
OSM-omriss og ingen fotogrammetri å måle på. Reguleringsplanen er den eneste
kilden som finnes.

Tre problemer måtte løses i rekkefølge, og det første er det som koster mest
hvis man hopper over det.

## 1. Er dokumentet i det hele tatt om tomta di?

Første treff var reguleringen for **Søndre del av Brøset** (2025). Den har en
aksonometri med etasjetall skrevet på hvert eneste bygg, samme arkitektkontor,
samme stedsnavn, samme bekkedrag og allé i teksten. Den er feil plan.

**Terrengmodellen avgjorde det.** Planbeskrivelsen sier hvor området ligger:

> Laveste punkt på nordlige del av planområdet ligger på kote +79 over havnivå
> og stiger til høyeste punkt i sør på kote +98.

Våre omriss ligger på 70,7–84,8 m, målt med Kartverkets punkt-API mot samme
høydemodell planen selv bruker:

```bash
curl -sS "https://ws.geonorge.no/hoydedata/v1/punkt?ost=10.4553&nord=63.4224&koordsys=4258"
# {"punkter":[{"datakilde":"dtm1","terreng":"DyrketMark","z":70.89, ...}]}
```

Ni til fjorten meter for lavt, konsekvent over hele feltet. Brøsetjordet er
plangrensa: vår markedsplan ligger nord for gata, den planen sør for. To
naboreguleringer, samme arkitekt, samme språk.

OSM bekreftet det uavhengig — utviklingen vår har sitt eget omriss
(way 1502590317, «Brøsetporten / Bo Brøset / Wesselsløka»), og gata som er vår
sørkant er way 1502590316 «Brøsetjordet».

**Regelen:** før du tror på ett eneste tall i et plandokument, sjekk at området
er ditt. Planbeskrivelser oppgir nesten alltid kotehøyde nord/sør og
utstrekning i meter. Det er et gratis falsifiseringspunkt mot en uavhengig
kilde, og det tar ett API-kall. Stedsnavn, arkitektnavn og tegnestil gjør det
ikke — nabotomta deler alle tre.

Riktig plan var **Del av Brøset med tilliggende veger, r20210042** (Dyrvik
arkitekter / ATSITE, 07.04.2022). Kommunens kunngjøringsside lister alle
vedleggene; det er `28. situasjonsplan` (en takplan) som bærer tallene, ikke
planbeskrivelsen.

Nedlasting: bruk `https://www.trondheim.kommune.no/globalassets/...`, ikke
`https://globalassets.trondheim.kommune.no/...` — sistnevnte er samme fil men
sertifikatet matcher ikke vertsnavnet, og curl feiler med SSL-feil 60.

## 2. Les tallene uten OCR

Arkitekt-PDF-er har som regel et ekte tekstlag. `pdftotext -bbox` gir hvert ord
med koordinat, som er nøyaktig det man trenger — men teksten kan se ut som
søppel:

```
<word xMin="621.5" ...>HWJ</word>
<word xMin="1024.0" ...>7XQJD</word>
```

Fonten er innebygd med egen koding. Her lå hver bokstav **29 kodepunkt for
lavt**: `H`→`e`, `W`→`t`, `J`→`g` gir «etg», og `7XQJD` blir «Tunga». Sifrene
havner i kontrolltegn-området og overlever som `\x15\x10\x16` = «2-3».

```python
def decode(s):
    return "".join(chr(ord(c) + 29) if 32 <= ord(c) + 29 < 127 else c for c in s)
```

Finn forskyvningen ved å ta et ord du kjenner formen på — en gateadresse i
tittelfeltet, eller den samme korte strengen som gjentar seg hundre ganger.
Sjekk om differansen er konstant. Er den det, er OCR bortkastet arbeid: du får
101 påskrifter med eksakt posisjon i stedet for gjetning på 6 px høye sifre i
en JPEG.

**Ikke prøv å lese en aksonometri.** Det første forsøket var å OCR-e
etasjetallene av et 3D-oppriss. Selv om tallene er lesbare, står de på taket,
og takets skjermposisjon er forskjøvet med byggets egen høyde — nettopp den
ukjente du prøver å finne. En plantegning har ikke det problemet.

## 3. Stadfest tegningen, ikke bildet

Takplanen er målestokkriktig og nord-opp, men har ingen koordinater. Tre
veikryss vi kjenner posisjonen til fra OSM binder den til verden:

```python
TAKPLAN_ANCHORS = [
    ("Rundkjøring Tungasletta", (939.6, 490.0), (10.4607323, 63.4215661)),
    ("Brøsetvegen x Sigurd Munns veg", (161.6, 483.7), (10.449732, 63.421765)),
    ("Brøsetvegen x Brøsetflata", (466.6, 231.7), (10.454243, 63.423268)),
]
```

Krysspunktene hentes med ett Overpass-kall som finner noder delt av to navngitte
veier:

```
[out:json];(way["highway"]["name"](63.4170,10.4430,63.4270,10.4620););out geom;
```

— og så noder som opptrer i mer enn ett veinavn. Det gir kryss med
koordinat, uten å måtte klikke i et kart.

Bruk **similaritet** (skala + rotasjon + flytting), ikke full affin. Tre punkt
plukket for hånd har hver noen få piksler slark; en affin tilpasning bruker den
slarken til å legge inn skjevhet som ikke finnes i tegningen. Similariteten kan
ikke det, og residualene blir dermed en ærlig feilmåling: 0,7026 m per
PDF-enhet, −1,98°, avvik 1,5 / 2,1 / 3,0 m over 800 m.

**Legg residualen inn som en gate i generatoren**, ikke bare i en logglinje:

```python
if max(residuals) > TAKPLAN_MAX_RESIDUAL_M:
    sys.exit("takplanen sitter ikke godt nok — sjekk holdepunktene")
```

Flytter noen på et holdepunkt senere, stopper skriptet i stedet for å skrive
femti bygg på feil sted.

**Kryssjekk skalaen mot målestokkstreken.** Den er upresis (etikettene «0», «50»
og «100» er venstrestilt, så etikettbredden forskyver dem), men den fanger
grove feil. Vårt første håndregnede anslag var 0,7776 m/enhet — 10 % feil — og
streken viste 0,71–0,745, som var nok til å se at anslaget var galt.

## 4. Tilordne påskrift til omriss

Regel, i denne rekkefølgen:

1. Påskriften som ligger **inne i** omrisset vinner. 36 av 52 bygg hadde en.
2. Ellers **nærmeste innen 35 m**.
3. Ligger flere inne i samme omriss — et sammenslått rekkehusfelt — gjelder den
   **høyeste**, slik «2-3 etg» også leses som 3.

**Gaten som betyr noe: flaggskipsbyggene.** 2022-planen er eldre enn
salgsoppdelingen, så A1/A2/B finnes ikke i den. Nærmeste-påskrift ga dem 6, 7 og
4 etasjer. Salgsmaterialet sier fem, fem og sju — hus B er det høye. Regelen
ville altså gjort det viktigste bygget i prosjektet lavest, og det ville ingen
test fanget.

Bygg som er navngitt i salgsmaterialet skal ha tall fra salgsmaterialet.
Nærmeste-påskrift er for konteksten rundt, der ingen teller etasjer.

## 5. Etasje til meter

Ikke gjett faktoren — planen har den. Ta maks kotehøyde som står på bygget,
trekk fra terrenget under det (Kartverket DTM1), del på etasjetallet. Gjør det
over mange bygg og bruk **de høyeste**: en meters slingring i regradering betyr
lite på åtte etasjer og mye på to. Her ga byggene på 6–8 etasjer omtrent 3,5 m
per etasje, mens totalmedianen var forurenset til 3,91 av lave bygg på oppfylt
terreng.

Faktoren skal matche hvordan volumet plasseres. Vi setter volumene på **dagens**
terreng i 3D (`RELATIVE_TO_GROUND`), så det er nettopp «kote minus dagens
terreng» som skal treffe.

## Testen som fanger at avlesningen dør

En avlesning som stille faller tilbake til én verdi ser ikke gal ut noe sted —
kartet tegner fortsatt 55 bygg, bare uten silhuett. Derfor:

```ts
const sorted = [...heights].sort((a, b) => a - b);
expect(sorted.length).toBeGreaterThanOrEqual(5);
expect(sorted.at(0)).toBe(7);
expect(sorted.at(-1)).toBe(28);
```

## Se også

- `docs/research/2026-09-07-wesselslokka-planregistrering.md` — hele
  registreringen for dette prosjektet, inkludert de to forkastede sporene
- [overlay-opasitet-2d-kart-vs-3d-fotofliser](../ui-patterns/overlay-opasitet-2d-kart-vs-3d-fotofliser-20260907.md)
  — hvorfor de samme volumene må tegnes ulikt i de to kartmotorene
- `scripts/extract-broset-massing.py` — implementasjonen
