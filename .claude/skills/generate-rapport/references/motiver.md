# Motiv-generering

Motiver er ryggraden i rød tråd. 2-3 per rapport, etablert i heroIntro, referert i hver kategori-tekst.

## Motiv-typer

### 1. Geografisk anker
Fysisk referansepunkt leseren kan *se* eller *gå til*.

**Eksempler:**
- *kaifronten mellom Brattørkaia og TMV-kaia* (Stasjonskvartalet)
- *langs Nidelva* (Bakklandet-prosjekt)
- *under Strindfjellet* (Brøset)
- *ved Folkeparken* (Wesselsløkka)
- *på Byåsen-sida* (boligprosjekt på Byåsen)

**Kilder:**
- Kartdata: landemerker, vannflater, parker innen 500m av prosjektet
- Google Places: "natural features" og "landmarks" innenfor radius
- Lokal kunnskap fra WebSearch

**Kvalitetssjekk:**
- Skal være *ekte* (ikke konstruert) — kaifronten er ekte, "det grønne hjertet" er konstruert
- Skal være *synlig* fra prosjektet eller veldig nær
- Skal være *konkret* nok til at leseren kan se det for seg

### 2. Avstands/tempo
Hvor raskt leseren er "fremme" — tidsoppfatningen av sentralitet.

**Eksempler:**
- *10-minutters-livet til Midtbyen* (Stasjonskvartalet)
- *kvartal-til-kvartal-tempoet* (tett sentrum)
- *nabolag-rundt-hjørnet* (forstad med lokal-nav)
- *20 minutter med direktetog til Oslo* (pendler-bolig)

**Kilder:**
- Travel-times-matrise til kjente målpunkter (sentrum, stasjon, by-kjerne)
- Haversine mellom prosjekt og bydels-sentrum
- Dominant gangtid: "hvor mange minutter til X?"

**Kvalitetssjekk:**
- Tall skal være verifisert (ikke fake 10 minutter hvis det faktisk er 14)
- Skal matche hvordan leseren *opplever* sentralitet, ikke bare tekniske minutter

### 3. Karakter-motiv
Nabolagets *sosiale identitet* — hva området *er kjent for*.

**Eksempler:**
- *stasjonsnabolaget — der togene, kaien og byen møtes* (Stasjonskvartalet)
- *familie-stedet øst i byen* (Brøset)
- *Bakklandet-kanten med trehus og baker* (Wesselsløkka)
- *det voksende sentrums-prosjekt* (Stasjonskvartalet alt)
- *høstens pub-rute* (Brønnleira?)

**Kilder:**
- WebSearch `"{bydel} {by}" + nabolag/bydel/karakter`
- Wikipedia om området
- Lokale aviser og reportasjer

**Kvalitetssjekk:**
- Skal være *verifiserbart* fra minst én kilde
- Skal ikke være generisk ("flotte omgivelser" er ikke motiv)
- Skal ha *en konkret bildedannelse*

## Mekanisme — Fast med fallback (C)

### Steg 1: Prøv fast struktur
Generer én kandidat av hver type.

### Steg 2: Evaluer styrke
Per kandidat: Er den *konkret* og *verifisert*?

- **Sterk** ≥ 2 kilder bekrefter + konkret bildedannelse
- **Middels** 1 kilde + konkret, eller 2 kilder men vag
- **Svak** 0 kilder, eller kun generisk formulering

### Steg 3: Fallback hvis noen er svake
Hvis en type er svak:
- **Geografisk svak** → legg til ekstra avstands-tempo-motiv (de er trygge)
- **Avstand svak** → legg til ekstra geografisk-motiv
- **Karakter svak** → dropp, bruk kun 2 motiver (ikke tving inn generisk motiv)

**Minimum:** 2 motiver. **Maksimum:** 3.

## heroIntro-format

heroIntro skal etablere motivene *eksplisitt* i 3-4 setninger.

**Mal:**
```
Setning 1: Plassering + geografisk motiv
Setning 2: Karakter-motiv + byens rolle
Setning 3: Avstand/tempo motiv
[Optional Setning 4: Hvem prosjektet er for eller kontrast]
```

**Eksempel — Stasjonskvartalet (motiver: kaifronten, stasjonsnabolaget, 10-minutters-livet):**

> StasjonsKvartalet ligger på kaifronten mellom Brattørkaia og TMV-kaia, der Trondheim møter fjorden. Dette er stasjonsnabolaget — der togene, kaien og havnepromenaden løper inn i hverandre. Fra inngangsdøren er Trondheim S 85 meter unna, og Midtbyen en ti minutters tur gjennom Søndre gate.

3 setninger, alle 3 motiver etablert, konkret geografi.

## Motiv-referering i kategori-tekster

Hver kategori-tekst skal referere minst ett motiv. Ikke ordrett — bruk varianter.

### Varianter av "kaifronten"
- langs kaien
- ved Brattørkaia
- på TMV-siden
- fra kaia du bor ved
- langs havnepromenaden
- på kaikanten

### Varianter av "stasjonsnabolaget"
- ved stasjonen
- i gangavstand fra stasjonen
- der togene stopper
- fra togperrongene

### Varianter av "10-minutters-livet"
- en ti minutters tur unna
- innen et kvarter
- på kort tid
- til fots fra døren

## Coverage-regel

Hvert motiv skal refereres i **minst 2** kategori-tekster. Det sikrer rød tråd faktisk bærer gjennom hele rapporten.

Eksempel — Stasjonskvartalet:
- *kaifronten*: Natur, Barn & Oppvekst (lekeplass langs kaien), Trening (badstuflåte)
- *stasjonsnabolaget*: Transport, Hverdagsliv (pendling + tjenester)
- *10-minutters-livet*: Mat & Drikke, Opplevelser, Hverdagsliv

## Motiv-override

Bruker kan overstyre med `--motiver "motiv1,motiv2,motiv3"` for:
- Spesifikke prosjekter hvor pipelinen finner svake motiver
- Markedsføringsmessige valg (f.eks. utbygger vil løfte en bestemt historisk referanse)

Format: komma-separert, norsk. Ingen typeklassifisering — skillen tolker.
