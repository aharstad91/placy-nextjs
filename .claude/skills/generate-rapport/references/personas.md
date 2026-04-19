# Personas for `/generate-rapport`

4 personas + Pendler-flagg. Velg 1-3 per prosjekt. Høyeste vekting vinner når flere kombineres.

## `forstegangskjoper`
**Alder:** 20-30. Enslig eller par. Første bolig.

**Livskontekst:**
- Ofte uten bil, kollektiv-avhengig
- Sentrum eller nær sentrum prioriteres
- Budget-bevisst, men vil ha godt nabolag
- Jobber i by, sosialt utelivs-orientert
- Ofte ikke barn, eller planlegger barn senere

**Vektlegger i tekst:**
- Transport (kollektiv-avhengig)
- Mat/drikke (kaffe, bar, vinbar — sosialt liv)
- Opplevelser (kino, museum, konserter)
- Hverdagsliv (nærhet til dagligvare + jobb)
- Pris-bevissthet: trygt å kjøpe her, voksende nabolag

**Tone:**
- Saklig entusiasme over hva nabolaget tilbyr
- Ikke "luksus"-vinkling
- Praktisk, ungdoms-kompatibel språkføring

## `etablerer`
**Alder:** 25-40. To inntekter (DINK), ingen barn.

**Livskontekst:**
- Ofte bil eller mobilitet-valg, mer fleksibel
- Kultur, mat, reiser prioriteres
- Karrierebevisst, jobb-orientert
- Kan ha valgt bort barn eller venter
- Spesialtjenester (spa, premium, opplevelser) matter

**Vektlegger i tekst:**
- Mat/drikke (signaturrestauranter, vinbarer, kaffebarer)
- Opplevelser (kultur, kunstliv, teater)
- Trening (gym, spa, yoga, padel)
- Natur (helgeopplevelser, tursti, skiløyper)
- Livsstilskvalitet

**Tone:**
- Sofistikert uten å være snobbete
- Konkrete spesialiteter (Michelin, håndverk)
- Urbant men uten å overselge aktivitet

## `barnefamilie`
**Alder:** 30-45. 1+ barn.

**Livskontekst:**
- Trygt nabolag er nonneglotiabelt
- Skole og barnehage er kjernebeslutninger
- Natur, lekeplass, trygge gaterom
- Mindre tid/interesse i voksen-natteliv
- Bil er vanlig (men ikke alltid)

**Vektlegger i tekst:**
- Barn & Oppvekst (nærskole, barnehager, skolekvalitet)
- Natur & Friluftsliv (lekeområder, marka, badeplass)
- Hverdagsliv (dagligvare, apotek, lege)
- Trygghet (trafikkdempet, stille)

**Tone:**
- Praktisk, foreldreorientert
- Konkrete avstander (hvor langt er skolen?)
- Ikke "hipt", men "fungerer"
- Underspiller kultur/nattklubb

## `femtiefem-pluss`
**Alder:** 55-75. Flyttere — ofte fra enebolig til leilighet.

**Livskontekst:**
- Tilgjengelighet matter (ikke trapper, nært legevakt)
- Nært tjenester (apotek, lege, dagligvare)
- Kultur, bibliotek, museum — livslang læring
- Mindre vedlikehold, frigjør tid
- Sosialt — mat/drikke ute, men ikke nattklubb

**Vektlegger i tekst:**
- Hverdagsliv (apotek, lege, tannlege, bank)
- Mat/drikke (restauranter, vinbarer — voksen-appell)
- Opplevelser (kultur, museum, teater, bibliotek)
- Natur (turgåing, rolige parker, fjordpromenade)
- Trening (spa, svømming, yoga, roligere aktivitet)

**Tone:**
- Voksent, rolig
- Vektlegg tradisjon og historikk (Katedralskolen grunnlagt 1152 er OK)
- Ikke forsøk å være "ungdommelig"

## Pendler-flagg (modifier)

**Hva:** Boolean flag som kombineres med en persona.

**Effekt:**
- Transport bumpes til minimum Høy (H)
- Andre kategorier uendret

**Bruksscenarier:**
- Pendler-by med DINKs: `--persona etablerer --pendler`
- Familie-pendling: `--persona barnefamilie --pendler` (trygg skole + togtid er viktig)

## Kombinasjoner

**Union-regel:** Når flere personas velges, høyeste nivå vinner per kategori.

**Eksempel — Stasjonskvartalet (`forstegangskjoper + femtiefem-pluss`):**

| Kategori | forstegangs | femtiefem | Union |
|----------|:-----------:|:---------:|:-----:|
| Hverdagsliv | H | H | **H** |
| Barn & Oppvekst | L | L | **L** |
| Mat & Drikke | H | H | **H** |
| Opplevelser | M | H | **H** |
| Natur | M | H | **H** |
| Transport | H | M | **H** |
| Trening | M | M | **M** |

Totalt: H=5, M=1, L=1 → tekst-budsjett ≈ 5×6 + 1×5 + 1×4 + heroIntro 4 = **43 setn**.

## Investor/utleier — eksplisitt ikke-scope

Investor-persona er annen produkttype (ROI-drevet, ikke livskvalitet-drevet). Hvis dette behovet kommer: lag separat skill `/generate-investor-rapport`. Ikke tving inn i denne skillen.
