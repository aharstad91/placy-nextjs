# Anti-eksempler — ikke skriv slik

Disse er de eksisterende vanilla-LLM-genererte manusene for Stasjonskvartalet (Gemini/Claude med "ren agentisk" prompt uten curator-stemme). De er ikke uten kvalitet — de leser greit overflate-sett. Men de bryter v3-regler systematisk. Bruk dem som **konkret diagnose** av hva som drifter mot detaljnivå, klisjé, og verifiserings-overreach.

---

## Mat & Drikke — eksisterende manus

> "Du bor midt i smørøyet av Trondheims matkultur, med kort gangavstand til populære spisesteder på Solsiden og i Midtbyen. Enten du ønsker en rask kaffe i arkaden eller en bedre middag langs kanalen, er alternativene mange og varierte. Området rundt Brattøra og de historiske bryggene byr på alt fra uformelle kafeer til restauranter i toppklasse."

**Diagnose per påstand:**

| Brudd | Konkret | Hvorfor |
|---|---|---|
| Klisjé | "midt i smørøyet" | Curator-banned-klassiker. Sier ingenting. |
| Subjektivt | "populære spisesteder" | "Populært" er meningsmåling, ikke fakta. Curator: aldri "populær" uten grunnlag. |
| Vag bevegelse | "rask kaffe i arkaden", "middag langs kanalen" | Hvilken arkade? Hvilken kanal? Genererisk meglerspråk. |
| Fyll | "alternativene mange og varierte" | Generic. Sier ikke hva mangfoldet består av. |
| Klisjé | "restauranter i toppklasse" | Ikke verifiserbart. Curator: aldri "best i byen" uten dokumentasjon. |
| You-narrativ | "Du bor", "du ønsker" | OK for intro, men for tett i en kategori-tekst. Faktisk beskrivelse er sterkere. |

**Sammenligning:** Anker-eksempel for Mat & Drikke har samme tema men 0 klisjéer, 0 subjektive påstander, hvert utsagn dokumenterbart.

---

## Natur & Friluftsliv — eksisterende manus

> "Her får du det beste fra to verdener: byens puls og naturens ro. Du kan starte dagen med en kajakktur på kanalen eller en forfriskende løpetur langs Ladestien som ligger like ved. Med fjorden som nærmeste nabo og utsikt mot både sjøen og bykjernen, har du alltid tilgang til frisk luft og rekreasjon."

**Diagnose per påstand:**

| Brudd | Konkret | Hvorfor |
|---|---|---|
| Klisjé-stable | "det beste fra to verdener", "byens puls", "naturens ro", "fjorden som nærmeste nabo" | Fire klisjéer i tre setninger. |
| POI-navn brudd | "Ladestien" | 1 navn over budsjett (regel: 0). Ladestien er en sti, ikke et POI per se, men det er en navngitt struktur — beskriv funksjonelt heller ("en kyststi langs fjorden") med mindre navnet er hele poenget. |
| Adjektiv-fyll | "forfriskende løpetur" | "Forfriskende" sier ingenting. Hvilken løpetur er ikke forfriskende? |
| Meglerspråk | "Du kan starte dagen med en kajakktur" | Påtatt scenario, ikke fakta. Curator: beskriv tilbudet, ikke en hypotetisk dag. |
| Overpåstand | "alltid tilgang til frisk luft" | Tomt utsagn. Alle bor med "tilgang til frisk luft". |

**Sammenligning:** Anker-eksempel for Natur & Friluftsliv beskriver 4 separate akser av tilbud (vann/parker/elv/bading) uten klisjé, uten POI-navn, uten "du-kan-starte-dagen"-narrativ.

---

## Nabolaget (heroAudio) — eksisterende manus

> "Stasjonskvartalet er Trondheims mest spennende og sentrale boligprosjekt, perfekt plassert midt i hjertet av det nye kollektivknutepunktet. Her får du en unik kombinasjon av moderne arkitektur og umiddelbar nærhet til byens puls, med alt fra nisjebutikker til fjorden rett utenfor døren. Boligene byr på førsteklasses bokvalitet med spektakulære takterrasser og utsikt som binder Midtbyen og Brattøra sammen. Dette er det ultimate valget for deg som ønsker en sømløs urban livsstil uten kompromisser. Et hjem her betyr mindre tid på logistikk og mer tid på det som faktisk betyr noe."

**Diagnose per påstand:**

| Brudd | Konkret | Hvorfor |
|---|---|---|
| Superlativer (kjedet) | "mest spennende", "perfekt plassert", "førsteklasses", "spektakulære", "ultimate" | 5 banned-superlativer i 5 setninger — én per setning i snitt. |
| Klisjéer | "midt i hjertet av", "unik kombinasjon", "umiddelbar nærhet til byens puls", "uten kompromisser" | Hver setn har minst én. |
| Genre-feil | Hele manuset selger *boligprosjektet*, ikke *nabolaget*. "Boligene byr på", "førsteklasses bokvalitet", "spektakulære takterrasser" hører til en megler-pitch, ikke en nabolagsbeskrivelse. |
| Cheesy ending | "mer tid på det som faktisk betyr noe" | Slogan-aktig retorisk landing. Sier ingenting. |
| Generic | "sømløs urban livsstil" | Jargon. Hva betyr "sømløs" konkret? |
| Du-narrativ tett | "Her får du", "for deg som ønsker" | OK i åpning av intro, men dette er gjennomgående salgsspråk. |

**Sammenligning:** Anker-eksempel for Nabolaget (intro) er fakta-anker + tease, 0 superlativer, 0 klisjéer, beskriver *nabolaget* og *plasseringen*, ikke boligprosjektets kvalitetsfølelse.

---

## Felles mønster i alle tre anti-eksempler

1. **Tomme superlativer.** "Mest", "perfekt", "ultimate", "spektakulære", "best", "førsteklasses". Disse signaliserer entusiasme men gir ingen informasjon.
2. **Klisjéer.** "Midt i hjertet av", "byens puls", "det beste fra to verdener", "fjorden som nærmeste nabo", "smørøyet". Disse er deler av et generisk meglerspråk.
3. **Påståtte scenarier i stedet for fakta.** "Du kan starte dagen med kajakk", "enten du ønsker en rask kaffe". Hypotetisk bruk, ikke beskrivelse av tilbudet.
4. **Selger prosjektet, ikke nabolaget.** Når Nabolaget-manuset snakker om "spektakulære takterrasser" og "førsteklasses bokvalitet", har vi skrevet inn salgsmateriale i feil sjanger.
5. **Cheesy retorisk landing.** "Mer tid på det som faktisk betyr noe", "uten kompromisser". Trenger en forklaring etter seg — derfor er det skrevet feil.

**Diagnostisk regel:** Hvis en setning fjernes og leseren ikke mister konkret informasjon, var den fyll.
