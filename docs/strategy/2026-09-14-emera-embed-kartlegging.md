# Emera Eiendomsmegling — embed-kartlegging og kontaktbilde

**Dato:** 2026-09-14
**Utløser:** Andreas sendte objektsiden https://emeraeiendomsmegling.no/eiendom/708F2AFD-0CE5-4ECC-823C-F19F0AFDACAE og spurte om Placy kan limes inn, og hvilken leverandør de bruker.
**Metode:** Hentet objektsiden, forsiden, `/kontorer/administrasjon`, robots.txt og sitemap.xml med curl; inspiserte responsheadere, RSC-payload og Sanity-referanser. Supplert med nettsøk (Proff, Kreativt Forum) for roller og byrå.

---

## Hva som ble målt

| Funn | Bevis |
|------|-------|
| Meglersystem = **Vitec Next** | Budknappen peker til `https://bud.vitecnext.no/?Installationid=MSEMERA&Estateid=<GUID>` |
| Nettsiden er **egenutviklet Next.js på Vercel** | `server: Vercel`, `x-powered-by: Next.js`, Mantine-klassenavn, Cookiebot + GTM |
| CMS = **Sanity** | `cdn.sanity.io/images/7c1lp8sf/production`, `/studio` sperret i robots.txt |
| **Ingen CSP, ingen X-Frame-Options** | Responsheaderne inneholder ingen av delene |
| **Null iframes** på objektsiden | Ingen `<iframe>` i markup; eneste `dangerouslySetInnerHTML` er Next.js' egen feilside-CSS |
| Objektsiden har **koordinater og adresse i eget datalag** | `"latitude":63.3683416595572,"longitude":10.3628818713625`, `"municipality":"Trondheim"` — objektet er Kolstadtunet 8A på Heimdal |
| **Ingen nabolagsinnhold** på objektsiden | Eneste stedsreferanse er en «Åpne i Google Maps»-lenke |
| Skala: **~700 aktive objektsider**, 80 meglerprofiler, 10 kontorsider | sitemap.xml |
| Kontorer | Oslo Øst, Oslo Vest, Lillestrøm, Halden, Bergen, Bergen Sør, Trondheim, Narvik + Administrasjon |

**Ironien som er pitchen:** hver eneste meglerbio sier «vi kjenner nabolagene like godt som vi kjenner prosessen fra start til slutt» (79 treff på «nabolag» i markupen, alle i bio-tekst), mens objektsiden ikke viser ett eneste ord om området.

## Juridiske enheter bak kontorene

Kontorene er oppkjøpte selskaper som beholder org-identiteten sin: Emera No1 AS (Oslo Vest), Emera No2 AS (Oslo Øst), Meglerhuset Romerike AS (Lillestrøm), Fjell og Fjord eiendomsmegling AS (Bergen), **Era eiendomsmegling AS (Trondheim)**, Halden Eiendomsmegling AS, Narvik Eiendomsmegling AS.

## Kontaktbilde

Administrasjonen har **ingen markedssjef, ingen IT- eller teknologirolle, ingen utviklere**. Titlene er adm.dir, drift/økonomi, juridisk, salg, kvalitet, kontorsjef og backoffice.

| Navn | Rolle | E-post |
|------|-------|--------|
| Sveinung Lüthcke Solberg | Administrerende direktør, daglig leder Emera Norge AS | sveinung.solberg@emera.no |
| Katarina Nakken | Salgsdirektør, eiendomsmegler MNEF | katarina.nakken@emera.no |
| Øyvind Lein Eng | Drift- og økonomidirektør | oyvind.eng@emera.no |
| Nina Fodstad Skumsrud | Juridisk direktør, advokat, styreleder | nina.skumsrud@emera.no |
| Ingrid Løvberg | Kvalitetssjef | ingrid.lovberg@emera.no |

Nettsiden er kjøpt inn: designstudioet **Vii** laget navn, identitet og nettsted, med Swoon, Workhorse, Hvemm og Smør som underleverandører (Kreativt Forum). Koden eies altså av byrået, ikke av Emera.

**Selskapstall (Proff, Emera Norge AS, org.nr. 834 963 442):** stiftet 08.01.2025, 6 ansatte i morselskapet, 2025 viste 2,714 mill. i omsetning, 10,220 mill. i driftsunderskudd og negativ egenkapital på 10,147 mill. Morselskap: Emera Group AS. Tallene er ikke kontrollert mot årsregnskapet.

## To distribusjonsslotter

1. **Objektsiden på egen nettside.** Trenger ikke Vitec. Koordinatene ligger allerede i sidens datalag, så en Placy-komponent kan bygge board-URL-en per objekt. Én kodeendring dekker alle ~700 annonsene automatisk — ingen per-objekt-arbeid. Men endringen må bestilles hos Vii, siden Emera ikke har utviklere.
2. **«Nyttige lenker» i FINN-annonsen.** Mates fra Vitec Next (fri tekst + vilkårlig URL per oppdrag), jf. funnet 2026-08-11. Uavhengig av nettsiden og enklere å teste først.

## Begrensning

Self-serve-geofencen godtar bare strøk vi har kuratert med `boundary`. Emera har annonser i Oslo, Bergen, Trondheim, Lillestrøm, Halden og Narvik — vi kan i dag bare levere i Trondheim. Derfor er **Emera Trondheim (Era eiendomsmegling AS) pilotenheten**, med resten av kjeden som opptrapping.

## Åpne punkter

- Ingen kontakt tatt. Ingen pris nevnt eller vurdert for Emera.
- Ikke verifisert hvem hos Emera som eier Vii-relasjonen, eller hva et komponentoppdrag der koster.
- Ikke verifisert om Emera Trondheim har egen beslutningsmyndighet over nettsiden, eller om alt går via Oslo.
- Ikke undersøkt om Emera allerede bruker FINN Nabolagsprofil i «Nyttige lenker».
