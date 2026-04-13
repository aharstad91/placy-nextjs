import type { BrokerInfo, ReportCTA, ReportSummary } from "@/lib/types";

export const WESSELSLOKKA_SUMMARY: ReportSummary = {
  headline:
    "Brøset er for de som vil ha natur rett utenfor døren uten å gi opp bysentrum.",
  insights: [
    "Halvparten av området er grøntareal, med 7 parker og tursystem innen gangavstand.",
    "Valentinlyst Senter dekker hverdagsbehovene på 8 minutter — dagligvare, apotek, frisør og vinmonopol.",
    "Skolekretsen har Eberg barneskole, Blussuvoll ungdomsskole og Strinda VGS, alle innen 18 minutter.",
    "Buss-linje 12 går hvert 15. minutt til sentrum, og nærmeste stopp er rett utenfor døren.",
    "95 tilbud innen gangavstand, snitt 4.2 stjerner — et helhetlig tilbud, ikke enkeltsteder.",
  ],
  brokerInviteText:
    "Du har sett syv temaer om Brøset. Vil du vite mer om prosjektet, fellesgjeld eller innflytting — ta en uforpliktende prat med megler.",
};

// Placeholder — oppdateres med reell megler fra wesselslokka.no/kontakt før demo
export const WESSELSLOKKA_BROKERS: BrokerInfo[] = [
  {
    name: "DEMO – Ansvarlig megler",
    firstName: "Megleren",
    title: "Eiendomsmegler MNEF",
    phone: "+47 73 87 15 00",
    email: "kontakt@heimdal-eiendom.no",
    photoUrl: "",
    officeName: "Heimdal Eiendomsmegling",
    bio: "Bor og jobber i nabolaget",
  },
];

export const WESSELSLOKKA_CTA: ReportCTA = {
  leadUrl: "https://www.wesselslokka.no/kontakt",
  primaryLabel: "Meld interesse",
  primarySubject: "Interesse for Wesselsløkka",
  shareTitle: "Wesselsløkka – Nabolagsrapport",
};
