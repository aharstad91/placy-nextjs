# Wesselsløkka: lokalkunnskap og harness — kontekst før kompaktering

## Brukerens retning og neste steg

Andreas vil bygge videre på FAQ-arbeidet for å akkumulere delt lokalkunnskap
(Moat 1), automatisere leveranser og senere støtte flere produkter, muligvis chat.
Wesselsløkka-demoen er uttrykkelig førsteprioritet. Han ba om konkret neste steg
og håndtering av kontekstvinduet før implementering. Ingen implementering eller
databaseskriving er gjort for kunnskapsarbeidet ennå.

Foreslått neste leveranse: kartlegg alle Wesselsløkkas FAQ-er mot dagens katalog
og data, velg en liten sammenhengende demonstrasjon (kandidat: turmuligheter i
Brøset), og bygg hele veien fra kildebelagt, delt opplysning til synlig FAQ-svar.
Valg av konkrete spørsmål og datakontrakt er ikke endelig landet. Lag eksplisitte
akseptansekriterier: svar synlig i demoen, sporbart grunnlag, endring slår gjennom,
gjenbruk testes uten å endre andre kunders innhold, manglende kunnskap blir synlig
i intern dekningsrapport. Chat er fremtidig retning, ikke bestilt første leveranse.

## Samarbeid og lokal tilstand

- Les CLAUDE.md og AGENTS.md. En annen Claude-sesjon håndterer merging.
- Ikke merge selv eller endre andres pågående innsiktsarbeid. Sjekk branch,
  worktrees og port 3001 på nytt etter kompaktering; tilstanden kan være endret.
- Sist hovedrepo: fix/postgrest-radtak, med flere ukommitterte innsiktsfiler.
- Sist port 3001: placy-kategorigrid, feat/kategori-grid-forside.
- Vår tidligere UI-fiks: 198dd7d i kategorigrid (grå kategoribakgrunn tilbake,
  separator etter Tilbake fjernet). Lint, tsc og 3512 tester bestått. Ikke pushet.
- Supabase MCP finnes ikke blant eksponerte verktøy. Direkte read-only REST
  fungerer med .env.local, service key i header og Accept-Profile: v2.
- Nett og filesystem er nå tilgjengelig uten approval. Ikke skriv ut secrets.
- Bruk isolert worktree for parallell kodejobb. Ingen subagenter bestilt.

## Målt i live v2-databasen 2026-09-06

Dette var strukturell kartlegging, ikke faktasjekk av hver tekst. Alle sider ble
hentet med eksplisitt paginering og avstemt mot count=exact.

- place_knowledge: 231/231 oppføringer; 26 unike POI-er og ett unikt area_id.
  177 har ikke-tomt structured_data. 196 har source_name eller source_url.
  217 er MERKET verified, men 21 av disse mangler begge kildefelt. 10 uverifiserte
  har display_ready=true. Nyeste updated_at er 2026-02-16. Etiketten er ikke
  bevis for at innholdet er sant eller oppdatert.
- Skjemaet har poi_id, area_id, topic, fact_text, structured_data, confidence,
  source_url, source_name, display_ready, verified_at, created_at, updated_at.
  Innhold blander ofte flere påstander og varige/tidsavhengige opplysninger.
- areas: 46/46; 9 med report_editorial. Brøset-raden (broset) har NULL editorial.
  Ranheim har seks FAQ-er totalt, inkludert global FAQ.
- products: 12/12, alle report. Ranheims seks FAQ-er finnes identisk i tre
  konfigurasjoner: intern_martin-barstads-veg-23c,
  megler-harstad_strindfjordvegen-10-7053-ranheim-norge,
  placy-demo_strindfjordvegen-10. Dette beviser lagret gjenbruk, IKKE automatisk
  oppdatering ved senere endring i strøket.
- Fire produkter har config.reportConfig.boardFacts. Wesselsløkka
  (broset-utvikling-as_wesselslokka; product 58791fc5-15de-4fce-b117-aefe3129882d)
  har stops, schools, frequency, cityCentre, workplaces, lastDeparture samt
  fetchedAt, departureAt, factsVersion.
- pois: 6498/6498 relevante felt lest. 2591 editorial_hook, 1373 local_insight,
  ingen ikke-tomme editorial_sources. Andre kildefelt finnes i metadata og
  knowledge-tabellen, så dette betyr ikke at hele poolen mangler kilder.
  285 har parent_poi_id (sted-i-sted-relasjoner).
- events: count=exact ga 19 faq_opened og 387 poi_clicked. Ikke kontrollert om
  demo/test eller representativ kundetrafikk. Må ikke selges som kjøperinnsikt.
- Råuttrekk uten credentials ligger midlertidig i /tmp/placy-knowledge-audit.json.
  Inneholder knowledge, areas, utvalgte POI-felt og produkter. Ikke commit rådata.

## Kode og dokumentasjon å starte med

- lib/pipeline/apply-area-staging.ts: kuratering skriver areas.report_editorial,
  uttrykkelig IKKE place_knowledge.
- lib/pipeline/inherit-area-editorial.ts: områdeoppslag, validering og arv/kopi
  av editorial og FAQ til products.config. Kontroller oppdateringssemantikk.
- lib/pipeline/area-staging.ts og find-area-for-point.ts.
- lib/generators/faq-generator.ts: dagens deterministiske FAQ-byggere.
- lib/supabase/v2-queries.ts: aktiv lesesti.
- Søk i app/, components/, lib/ fant ingen aktiv lesing av place_knowledge.
  PRD 8 omtaler gamle SEO-konsumenter; stol på dagens kode fremfor gamle planer.
- lib/insight/aggregate.ts aggregerer faq_opened via payload.faq_id.
- supabase/migrations/070_baseline.sql har kunnskapsskjemaet ved linje 229.
- PROJECT-LOG.md: to FAQ-entries fra 6. september; kveldens oppføring rapporterer
  53 svar på Wesselsløkka (8 område, 10 hverdag, 7 oppvekst, 8 transport,
  7 trening, 6 servering, 4 opplevelser, 3 natur). Dette antallet ble ikke
  gjenskapt gjennom render i vår kartlegging.
- docs/research/2026-09-06-faq-katalog-sammenslatt.md og tilhørende katalogfiler.
- docs/strategy/LOG.md, særlig 2026-08-13 og 2026-08-04: Moat 1 er dømmekraft,
  korreksjoner og lokal kunnskap; tekstvolum er ikke i seg selv moat. Bidrag
  skal gjenbrukes per strøk, uten konkurrent-byline på steder.

## Viktige avgrensninger

Poolen er ufullstendig: manglende POI betyr ikke at tilbudet ikke finnes.
Høy oppmerksomhet på FAQ påvirkes av eksponering/plassering; åpninger alene
viser ikke hele behovet. Runtime LLM er forbudt i gjeldende prosjektregler;
eventuell fremtidig chat krever en egen eksplisitt arkitekturbeslutning.
Medium ble anbefalt for kartlegging; high for neste arkitektur-/implementeringsfase.
