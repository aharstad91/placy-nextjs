import type { Metadata } from "next";
import Image from "next/image";
import PitchDeck from "@/components/pitch/PitchDeck";
import BoardEmbed from "@/components/pitch/BoardEmbed";
import {
  Eyebrow,
  Fact,
  FactRow,
  Headline,
  Lede,
  PitchSlide,
  Quote,
  Step,
} from "@/components/pitch/slide-parts";

const BOARD_URL =
  "https://placy.no/eiendom/broset-utvikling-as/wesselslokka/rapport-board";

export const metadata: Metadata = {
  title: "Wesselsløkka — nabolaget som produkt",
  description:
    "Placy for Heimdal Eiendomsmegling: nærområdet som levende produkt i stedet for et stillbilde.",
  // Ulistet lenke — skal kunne videresendes internt, men ikke dukke opp i søk.
  robots: { index: false, follow: false },
};

export default function WesselslokkaPitchPage() {
  return (
    <PitchDeck label="Placy · Wesselsløkka">
      {/* 1 — Tittel */}
      <PitchSlide>
        <Eyebrow>Placy for Heimdal Eiendomsmegling</Eyebrow>
        <Headline size="lg">
          Nærområdet er det dyreste
          <br />
          dere lager på nytt hver gang.
        </Headline>
        <Lede>
          Wesselsløkka, Solsletta, Brøset — tre prosjekter, tre helt forskjellige
          måter å vise nabolaget på, bygget fra bunnen hver gang. Placy gjør det
          til ett produkt som kan gjenbrukes, oppdateres og måles.
        </Lede>
        <p className="mt-10 text-[13px] text-[#8a8a8a]">
          Bruk piltastene, eller prikkene nederst, for å bla.
        </p>
      </PitchSlide>

      {/* 2 — Speilet: deres eget områdekart */}
      <PitchSlide>
        <Eyebrow>Slik løser dere det i dag</Eyebrow>
        <Headline>Områdekartet på wesselslokka.no</Headline>
        <div className="mt-5 overflow-hidden rounded-2xl border border-[#eae6e1] bg-white">
          <Image
            src="/pitch/wesselslokka/omradekart-hem.png"
            alt="Områdekartet på wesselslokka.no: stilisert kart med håndplasserte pins, kategoriikoner og avstandsmarkering «Kun 500m»"
            width={1664}
            height={995}
            className="max-h-[48vh] w-full object-contain"
            priority
          />
        </div>
        <p className="mt-5 max-w-4xl text-[15px] leading-relaxed text-[#57534e] md:text-base">
          Tallet stemmer — Valentinlyst Senter ligger 512 meter fra
          Wesselsløkka. Men se hva kartet inneholder:{" "}
          <strong className="font-semibold text-[#1a1a1a]">
            kategoriikoner, en avstand, to reisemåter og en klynge butikker
            samlet under ett navn.
          </strong>{" "}
          Det er nøyaktig det Placy regner ut — her tegnet for hånd, én gang,
          for ett utsnitt.
        </p>
      </PitchSlide>

      {/* 3 — Bevisveggen: tre prosjekter, tre løsninger */}
      <PitchSlide wide>
        <Eyebrow>Og dere har gjort det fire ganger</Eyebrow>
        <Headline>Fire prosjekter, fire løsninger, null gjenbruk</Headline>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <EvidenceCard
            src="/pitch/wesselslokka/omradekart-hem.png"
            alt="Områdekart på wesselslokka.no"
            title="wesselslokka.no"
            body="Stilisert kart som bilde. Kan ikke klikkes, søkes i eller oppdateres."
          />
          <EvidenceCard
            src="/pitch/wesselslokka/broset-destinasjonen.jpg"
            alt="Interaktivt destinasjonskart på broset.no med Google Maps og reisetid-chips"
            title="broset.no"
            body="Interaktivt kart med reisetider. Hvert sted er skrevet inn i koden for hånd."
          />
          <EvidenceCard
            src="/pitch/wesselslokka/solsletta-omradet.jpg"
            alt="Områdeseksjonen på solsletta-hageby.no med tre trekkspill og satellittbilde"
            title="solsletta-hageby.no"
            body="Tre kategorier i tekst, et satellittbilde uten pins, og en knapp ut av siden."
          />
          <EvidenceCard
            src="/pitch/wesselslokka/hem-ovre-nyhavna.jpg"
            alt="Områdebilde for Øvre Nyhavna: flyfoto med påskrevne stedsnavn og en avstandstabell nederst"
            title="Øvre Nyhavna"
            body="Flyfoto med 20 påskrevne steder og 40 reisetider satt inn under bildet."
          />
        </div>
        <p className="mt-6 max-w-4xl text-[15px] leading-relaxed text-[#57534e] md:text-base">
          Ingenting av dette kan gjenbrukes på neste prosjekt. Kunnskapen om
          Trondheim bor i fire filer hos fire leverandører, og forsvinner når
          prosjektet er utsolgt: Øvre Nyhavna er solgt, nettsiden er borte, og
          kartet finnes i dag bare som en JPEG i en FINN-annonse fra 2022.{" "}
          <strong className="font-semibold text-[#1a1a1a]">
            Dere har 13 boligprosjekter ute nå.
          </strong>{" "}
          Det er 13 nærområder som må løses hver for seg, hver gang.
        </p>
      </PitchSlide>

      {/* 4 — Bransjeveggen: dette er ikke en HEM-svakhet, det er en kategori */}
      <PitchSlide wide>
        <Eyebrow>Og det er ikke bare dere</Eyebrow>
        <Headline>Hele bransjen tegner det samme kartet</Headline>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <EvidenceCard
            src="/pitch/wesselslokka/andre-nergrenda.jpg"
            alt="Områdekart for Nergrenda på Overvik med håndsatte etiketter og en liste over sykkelavstander"
            title="Nergrenda, Overvik"
            body="Håndsatte etiketter, og en tabell med elleve sykkelavstander skrevet inn ved siden av."
          />
          <EvidenceCard
            src="/pitch/wesselslokka/andre-lille-lade.webp"
            alt="Områdekart for Lille Lade med ikonpins per kategori og en liste over sykkeldistanser"
            title="Lille Lade"
            body="Egne kategoriikoner per sted — tegnet fra bunnen, kun for dette prosjektet."
          />
          <EvidenceCard
            src="/pitch/wesselslokka/andre-saupstad.jpg"
            alt="Områdekart for Saupstad Torg med håndplasserte stedsnavn over et kartutsnitt"
            title="Saupstad Torg"
            body="Stedsnavn skrevet oppå et kartutsnitt. Samme jobb, tredje variant."
          />
        </div>
        <p className="mt-6 max-w-4xl text-[15px] leading-relaxed text-[#57534e] md:text-base">
          Tre andre utbyggere, tre nye kart, samme oppgave. Alle vet at
          beliggenhet selger — ingen har et verktøy for det, så alle tegner
          sitt eget. Og to av disse tre kartene fant vi ikke på prosjektets
          egen nettside i det hele tatt:{" "}
          <strong className="font-semibold text-[#1a1a1a]">
            de lå som karusellbilder i FINN-annonsen.
          </strong>{" "}
          Det er der kjøperen faktisk ser dem — som et flatt bilde man ikke kan
          trykke på.
        </p>
      </PitchSlide>

      {/* 5 — Tallene bak broset.no */}
      <PitchSlide>
        <Eyebrow>Hva det koster å gjøre det for hånd</Eyebrow>
        <Headline>Kartet på broset.no, talt opp</Headline>
        <FactRow cols={3}>
          <Fact value="16" label="destinasjoner, hver skrevet inn i koden med navn, koordinat, bilde og fire reisetider" />
          <Fact value="63 av 64" label="reisetider tastet inn manuelt — den siste står tom, og ingen har oppdaget det" />
          <Fact value="16 av 16" label="destinasjoner har nøyaktig samme beskrivelse" />
        </FactRow>
        <Quote source="Teksten som står på alle de 16 stedene på broset.no — Midtbyen, Estenstadmarka, IKEA og Sirkus Shopping får den samme.">
          «Med miljøvennlige alternativer som buss og sykkel har du kort vei til
          det meste.»
        </Quote>
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-[#57534e]">
          Dette er ikke slurv — det er hva som skjer når hvert sted må skrives
          av et menneske. Ingen sjekker om tallene fortsatt stemmer, og den
          manglende busstiden til Valentinlyst har stått tom siden kartet ble
          laget. Placy gir 104 steder rundt Wesselsløkka hver sin tekst og
          egen reisetid, fordi begge deler er regnet ut, ikke skrevet.
        </p>
      </PitchSlide>

      {/* 6 — Knappen ut av siden */}
      <PitchSlide>
        <Eyebrow>Det dyreste enkeltvalget</Eyebrow>
        <Headline>
          Solsletta sender kjøperen
          <br />
          til FINN for å lese om nabolaget
        </Headline>
        <div className="mt-6 grid items-center gap-6 md:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-[#eae6e1] bg-white">
            <Image
              src="/pitch/wesselslokka/solsletta-omradet.jpg"
              alt="Områdeseksjonen på solsletta-hageby.no med den gule knappen «Åpne nabolagsprofil»"
              width={1600}
              height={1000}
              className="max-h-[46vh] w-full object-contain"
            />
          </div>
          <div>
            <p className="text-base leading-relaxed text-[#57534e]">
              Den gule knappen heter{" "}
              <strong className="font-semibold text-[#1a1a1a]">
                «Åpne nabolagsprofil»
              </strong>{" "}
              og går til <code className="text-[13px]">profil.nabolag.no</code>.
              Kjøperen som endelig er nysgjerrig på området, blir sendt ut av
              deres egen side — til en tjeneste FINN driver, som viser den samme
              profilen for alle boliger i strøket, og som ikke forteller dere
              noe om hvem som klikket.
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#57534e]">
              Placy holder kjøperen på siden, viser deres utvalg av stedene, og
              gir dere tallene på hva folk faktisk så på.
            </p>
          </div>
        </div>
      </PitchSlide>

      {/* 7 — Demoen */}
      <PitchSlide>
        <Eyebrow>Det samme nabolaget, som produkt</Eyebrow>
        <Headline>Wesselsløkka i Placy</Headline>
        <BoardEmbed
          src={BOARD_URL}
          poster="/pitch/wesselslokka/board-poster.jpg"
          posterAlt="Placy-boardet for Wesselsløkka: historiekolonne med redaksjonell tekst ved siden av kart med kategorimarkører"
        />
        <FactRow cols={4}>
          <Fact value="104" label="steder rundt Wesselsløkka, hvert med egen tekst og reisetid" />
          <Fact value="7" label="temaer — hverdag, barn, mat, natur, transport, trening, opplevelser" />
          <Fact value="3" label="reisemåter, med faktisk beregnet tid til hvert sted" />
          <Fact value="122" label="leiligheter deler det samme nabolaget — bygget én gang" />
        </FactRow>
      </PitchSlide>

      {/* 8 — Lokalkunnskapen bak */}
      <PitchSlide>
        <Eyebrow>Hva som ligger bak</Eyebrow>
        <Headline>Vi kuraterer strøket, ikke boligen</Headline>
        <Lede>
          Brøset er gjennomgått én gang: hvilke steder som finnes, hva de er, hva
          som er verdt å nevne. Den jobben ligger nå i databasen vår — og den
          gjelder like mye for neste prosjekt på Brøset, og for hver bruktbolig
          dere selger i samme strøk.
        </Lede>
        <div className="mt-8 space-y-4">
          <Step n="I dag" title="Kunnskapen bor i prosjektet">
            Områdekartet for Wesselsløkka hjelper ikke Solsletta. Når prosjektet
            er utsolgt, er arbeidet borte.
          </Step>
          <Step n="Med Placy" title="Kunnskapen bor i strøket">
            Neste Brøset-prosjekt starter med et ferdig kuratert nabolag. Det
            gjør prosjekt nummer to raskere og billigere enn nummer én.
          </Step>
          <Step n="Konsekvensen" title="Det skalerer til bruktbolig">
            Samme kuraterte strøk kan ligge under en helt vanlig bruktannonse —
            uten at noen må lage noe nytt.
          </Step>
        </div>
      </PitchSlide>

      {/* 9 — Målingen */}
      <PitchSlide>
        <Eyebrow>Hva dere får tilbake</Eyebrow>
        <Headline>For første gang: tall på hva kjøperen lurer på</Headline>
        <Lede>
          Et bilde forteller ingenting om hvem som så på det. Et levende board
          forteller hvilke temaer som åpnes, hvilke steder som klikkes, og hvor
          besøket kom fra — annonsen, visningsbekreftelsen eller prosjektsiden.
        </Lede>
        <FactRow cols={3}>
          <Fact value="Temaer" label="Er det skolene eller kollektivtilbudet som betyr noe for akkurat disse kjøperne?" />
          <Fact value="Steder" label="Hvilke steder i nabolaget blir faktisk sjekket — og hvilke bryr ingen seg om?" />
          <Fact value="Kilde" label="Hvilken kanal sender interesserte kjøpere, ikke bare klikk?" />
        </FactRow>
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-[#57534e]">
          Dette er data ingen leverandør gir dere i dag — og som er verdt noe
          også når prosjektet er solgt, fordi det sier hva neste prosjekt bør
          fremheve.
        </p>
      </PitchSlide>

      {/* 10 — Prosessen */}
      <PitchSlide>
        <Eyebrow>Slik kommer vi i gang</Eyebrow>
        <Headline>Live på deres side om to uker</Headline>
        <div className="mt-8 space-y-4">
          <Step n="Uke 1" title="Innholdsworkshop, ett møte per temaområde">
            Vi går gjennom hva vi har funnet om Brøset, og dere retter, stryker
            og legger til. Ingenting publiseres som dere ikke har sett.
          </Step>
          <Step n="Uke 1–2" title="Bygging og kvalitetssikring">
            Vi setter opp boardet med deres profil, kontrollerer reisetider og
            tekster, og tester på mobil.
          </Step>
          <Step n="Uke 2" title="Publisering">
            Boardet legges inn på wesselslokka.no. Nettsiden er bygget i Tilda,
            som tar imot innhold utenfra — det krever ingen ombygging av siden.
          </Step>
          <Step n="Løpende" title="Datagjennomgang">
            Vi går gjennom tallene sammen underveis, og justerer innholdet etter
            hva kjøperne faktisk ser på.
          </Step>
        </div>
      </PitchSlide>

      {/* 11 — Asken */}
      <PitchSlide>
        <Eyebrow>Neste steg</Eyebrow>
        <Headline size="lg">
          Et møte med marked og IT.
        </Headline>
        <Lede>
          Ikke en beslutning i dag. Det vi trenger er en halvtime med de som
          eier nettsidene og kjøperreisen, så vi kan vise det samme der — og
          snakke om hvordan dette ser ut på tvers av flere prosjekter enn
          Wesselsløkka.
        </Lede>
        <div className="mt-10 border-t border-[#eae6e1] pt-6">
          <div className="font-medium">Andreas Harstad</div>
          <div className="mt-1 text-sm text-[#8a8a8a]">
            Placy · andreas.harstad@initialforce.com
          </div>
        </div>
      </PitchSlide>
    </PitchDeck>
  );
}

function EvidenceCard({
  src,
  alt,
  title,
  body,
}: {
  src: string;
  alt: string;
  title: string;
  body: string;
}) {
  return (
    <figure className="overflow-hidden rounded-xl border border-[#eae6e1] bg-white">
      <div className="relative aspect-[4/3] w-full bg-[#f2efe9]">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 400px"
          className="object-contain"
        />
      </div>
      <figcaption className="px-4 py-3">
        <div className="text-sm font-medium">{title}</div>
        <p className="mt-1 text-[13px] leading-snug text-[#78716c]">{body}</p>
      </figcaption>
    </figure>
  );
}
