# Vektmatrise — persona × kategori

Tre nivåer styrer adaptiv lengde:

| Nivå | Setninger | Betydning |
|------|-----------|-----------|
| **H** (Høy) | 6-7 | Kjernetema for denne personaen |
| **M** (Medium) | 5 | Relevant men ikke kjerne |
| **L** (Lav) | 4 | Minimum, alltid inkludert |

## Matrise

| Kategori | `forstegangskjoper` | `etablerer` | `barnefamilie` | `femtiefem-pluss` |
|----------|:---:|:---:|:---:|:---:|
| **Hverdagsliv** | H | M | H | H |
| **Barn & Oppvekst** | L | L | **H** | L |
| **Mat & Drikke** | H | H | L | H |
| **Opplevelser** | M | H | M | H |
| **Natur & Friluftsliv** | M | M | H | H |
| **Transport & Mobilitet** | H | M | M | M |
| **Trening & Aktivitet** | M | H | M | H |

## Pendler-modifier

`--pendler` flag: Transport settes til minimum **H** (bumpes hvis ikke allerede).

Ingen andre kategorier endres.

## Union-regel

Når flere personas kombineres: **høyeste nivå vinner** per kategori.

Nivå-hierarki: L < M < H.

### Eksempel 1 — Stasjonskvartalet (forstegangskjoper + femtiefem-pluss)

| Kategori | forstegangs | femtiefem | **Union** | Setn |
|----------|:---:|:---:|:---:|:---:|
| Hverdagsliv | H | H | **H** | 6-7 |
| Barn & Oppvekst | L | L | **L** | 4 |
| Mat & Drikke | H | H | **H** | 6-7 |
| Opplevelser | M | H | **H** | 6-7 |
| Natur | M | H | **H** | 6-7 |
| Transport | H | M | **H** | 6-7 |
| Trening | M | H | **H** | 6-7 |

Totalbudsjett: 6×6-7 + 1×4 + heroIntro 4 = **~44-46 setninger** for hele rapporten.

### Eksempel 2 — Brøset (barnefamilie)

| Kategori | barnefamilie | Setn |
|----------|:---:|:---:|
| Hverdagsliv | H | 6-7 |
| Barn & Oppvekst | H | 6-7 |
| Mat & Drikke | L | 4 |
| Opplevelser | M | 5 |
| Natur | H | 6-7 |
| Transport | M | 5 |
| Trening | M | 5 |

Totalbudsjett: 3×6-7 + 3×5 + 1×4 + heroIntro 4 = **~41-43 setninger**.

### Eksempel 3 — Ung-pendler DINK-bolig (etablerer + pendler)

| Kategori | etablerer | +pendler | **Final** | Setn |
|----------|:---:|:---:|:---:|:---:|
| Hverdagsliv | M | — | M | 5 |
| Barn & Oppvekst | L | — | L | 4 |
| Mat & Drikke | H | — | H | 6-7 |
| Opplevelser | H | — | H | 6-7 |
| Natur | M | — | M | 5 |
| Transport | M | **+H** | H | 6-7 |
| Trening | H | — | H | 6-7 |

## Rasjonale bak de viktigste valgene

**Barn & Oppvekst = L for alle utenom barnefamilie.** Ikke-familie-personas trenger ikke lang skole-tekst, men 4 setn må finnes:
- Kan forklare skolekretsen som faktum (ikke appell)
- Barnebarn-besøk (55+-personas)
- Framtidsverdi (verdsetting hvis barn senere)

**Mat & Drikke = L for barnefamilie.** Familier er ikke primært utelivs-orientert:
- 4 setn fokuserer på familie-vennlige bakerier/kaffebarer
- Spar plass til Barn & Natur

**Trening = H for 55+ og etablerer.** Aktive personas:
- 55+: svømming, spa, yoga, lavintensiv
- Etablerer: gym, padel, crossfit — livsstilsvalg

**Transport = H for forstegangskjoper.** Uten bil:
- Kollektiv-nett er kritisk
- Nærhet til stasjon matter mer

## Justerbart i plan-fasen

Denne matrisen er førsteversjon. Kan kalibreres basert på faktiske rapporter og tilbakemelding.

Endringer gjøres her (denne filen), ikke i selve SKILL.md — holder logikken datadrevet.
