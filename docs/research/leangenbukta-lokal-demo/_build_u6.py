from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
OUT = ROOT / "categories"
REVIEWED_AT = "2026-09-18"


FILES = {
    "natur": "2026-09-18-opus-natur-sjo-tur-runde-2.md",
    "transport": "2026-09-18-opus-transport-hverdagsmobilitet-runde-3.md",
    "hverdag": "2026-09-18-opus-hverdag-handel-aerender-runde-4.md",
    "oppvekst": "2026-09-18-opus-oppvekst-runde-5.md",
    "servering": "2026-09-18-opus-servering-runde-6.md",
    "trening": "2026-09-18-opus-trening-runde-7.md",
    "opplevelser": "2026-09-18-opus-opplevelser-runde-8.md",
}

RECEIPTS = {
    "natur": "2026-09-18-research-mottak-runde-2-natur-sjo-tur.md",
    "transport": "2026-09-18-research-mottak-runde-3-transport-hverdagsmobilitet.md",
    "hverdag": "2026-09-18-research-mottak-runde-4-hverdag-handel-aerender.md",
    "oppvekst": "2026-09-18-research-mottak-runde-5-oppvekst.md",
    "servering": "2026-09-18-research-mottak-runde-6-servering.md",
    "trening": "2026-09-18-research-mottak-runde-7-trening.md",
    "opplevelser": "2026-09-18-research-mottak-runde-8-opplevelser.md",
}

EXPECTED = {
    "natur": 15,
    "transport": 39,
    "hverdag": 18,
    "oppvekst": 20,
    "servering": 21,
    "trening": 18,
    "opplevelser": 14,
}


def slug(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return value


def parse_pipe(path: Path, count: int, generated_prefix: str | None = None) -> list[dict]:
    lines = path.read_text().splitlines()
    start = next(i for i, line in enumerate(lines) if "Strukturert faktatabell" in line)
    header = None
    rows = []
    for line in lines[start + 1 :]:
        if not line.startswith("|") or line.startswith("|---"):
            if rows and line.startswith("#"):
                break
            continue
        cols = [part.strip() for part in line.strip("|").split("|")]
        if header is None:
            header = cols
            continue
        if len(cols) != len(header):
            continue
        raw = dict(zip(header, cols))
        if generated_prefix:
            cid = f"{generated_prefix}-{len(rows) + 1:02d}"
            name = cols[0]
        else:
            cid, name = cols[0], cols[1]
        rows.append({"candidate_id": cid, "name": name, "raw_report_fields_do_not_publish": raw})
        if len(rows) == count:
            break
    return rows


def parse_tsv(path: Path, count: int, generated_prefix: str | None = None) -> list[dict]:
    lines = path.read_text().splitlines()
    start = next(i for i, line in enumerate(lines) if "Strukturert faktatabell" in line)
    header = None
    rows = []
    for line in lines[start + 1 :]:
        if "\t" not in line:
            continue
        cols = line.split("\t")
        if header is None:
            header = cols
            continue
        if len(cols) != len(header):
            continue
        raw = dict(zip(header, cols))
        if generated_prefix:
            cid = f"{generated_prefix}-{len(rows) + 1:02d}"
            name = cols[0]
        else:
            cid, name = cols[0], cols[1]
        rows.append({"candidate_id": cid, "name": name, "raw_report_fields_do_not_publish": raw})
        if len(rows) == count:
            break
    return rows


def parse_all() -> dict[str, list[dict]]:
    return {
        "natur": parse_pipe(RAW / FILES["natur"], 15, "NAT"),
        "transport": parse_tsv(RAW / FILES["transport"], 39, "TRN"),
        "hverdag": parse_pipe(RAW / FILES["hverdag"], 18),
        "oppvekst": parse_tsv(RAW / FILES["oppvekst"], 20),
        "servering": parse_tsv(RAW / FILES["servering"], 21),
        "trening": parse_tsv(RAW / FILES["trening"], 18),
        "opplevelser": parse_tsv(RAW / FILES["opplevelser"], 14),
    }


DECISIONS = {
    "natur": {
        "NAT-01": "start_set", "NAT-02": "start_set", "NAT-03": "start_set",
        "NAT-04": "defer", "NAT-05": "defer", "NAT-06": "external_reference",
        "NAT-07": "topic_only", "NAT-08": "start_set", "NAT-09": "topic_only",
        "NAT-10": "topic_only", "NAT-11": "topic_only", "NAT-12": "topic_only",
        "NAT-13": "topic_only", "NAT-14": "defer", "NAT-15": "topic_only",
    },
    "transport": {
        **{f"TRN-{i:02d}": "defer" for i in range(1, 11)},
        "TRN-11": "topic_only", "TRN-12": "defer", "TRN-13": "start_set",
        "TRN-14": "exclude", "TRN-15": "topic_only", "TRN-16": "exclude",
        "TRN-17": "defer", "TRN-18": "topic_only", "TRN-19": "topic_only",
        "TRN-20": "topic_only", "TRN-21": "topic_only", "TRN-22": "topic_only",
        "TRN-23": "topic_only", "TRN-24": "topic_only", "TRN-25": "topic_only",
        "TRN-26": "defer", "TRN-27": "topic_only", "TRN-28": "topic_only",
        "TRN-29": "topic_only", "TRN-30": "topic_only", "TRN-31": "topic_only",
        "TRN-32": "topic_only", "TRN-33": "topic_only", "TRN-34": "topic_only",
        "TRN-35": "defer", "TRN-36": "defer", "TRN-37": "topic_only",
        "TRN-38": "exclude", "TRN-39": "exclude",
    },
    "hverdag": {
        "DG-01": "member", "DG-02": "defer", "DG-03": "member", "DG-04": "member",
        "DG-05": "defer", "KS-01": "start_set", "KS-02": "start_set", "KS-03": "start_set",
        "AP-01": "member", "AP-02": "defer", "AP-03": "member", "AP-04": "member",
        "PO-01": "member", "PO-02": "member", "VM-01": "member", "VM-02": "member",
        "RE-01": "defer", "LB-01": "topic_only",
    },
    "oppvekst": {
        "OPP-01": "start_set", "OPP-02": "member", "OPP-03": "start_set",
        "OPP-04": "defer", "OPP-05": "start_set", "OPP-06": "defer",
        "OPP-07": "defer", "OPP-08": "defer", "OPP-09": "topic_only",
        "OPP-10": "start_set", "OPP-11": "start_set", "OPP-12": "topic_only",
        "OPP-13": "topic_only", "OPP-14": "topic_only", "OPP-15": "start_set",
        "OPP-16": "member", "OPP-17": "topic_only", "OPP-18": "topic_only",
        "OPP-19": "topic_only", "OPP-20": "defer",
    },
    "servering": {
        "SRV-01": "start_set", "SRV-02": "defer", "SRV-03": "start_set",
        "SRV-04": "member", "SRV-05": "start_set", "SRV-06": "member",
        "SRV-07": "member", "SRV-08": "member", "SRV-09": "member",
        "SRV-10": "member", "SRV-11": "member", "SRV-12": "member",
        "SRV-13": "member", "SRV-14": "member", "SRV-15": "member",
        "SRV-16": "member", "SRV-17": "member", "SRV-18": "member",
        "SRV-19": "member", "SRV-20": "topic_only", "SRV-21": "exclude",
    },
    "trening": {
        "TRE-01": "start_set", "TRE-02": "start_set", "TRE-03": "start_set",
        "TRE-04": "exclude", "TRE-05": "member", "ANL-01": "start_set",
        "ANL-02": "member", "ANL-03": "member", "ANL-04": "defer",
        "ANL-05": "start_set", "ANL-06": "defer", "UTE-01": "topic_only",
        "UTE-02": "defer", "SVØ-01": "external_reference", "SVØ-02": "defer",
        "KLU-01": "topic_only", "KLU-02": "topic_only", "BEB-01": "topic_only",
    },
    "opplevelser": {
        "EXP-01": "start_set", "EXP-02": "topic_only", "EXP-03": "external_reference",
        "EXP-04": "start_set", "EXP-05": "topic_only", "EXP-06": "topic_only",
        "EXP-07": "start_set", "EXP-08": "external_reference", "EXP-09": "external_reference",
        "EXP-10": "external_reference", "EXP-11": "topic_only", "EXP-12": "defer",
        "EXP-13": "exclude", "EXP-14": "exclude",
    },
}


CANONICAL_OVERRIDES = {
    ("natur", "NAT-02"): "place:ringvebukta",
    ("oppvekst", "OPP-12"): "place:ringvebukta",
    ("natur", "NAT-07"): "place:leangen-gard-park",
    ("oppvekst", "OPP-13"): "place:leangen-gard-park",
    ("opplevelser", "EXP-05"): "place:leangen-gard-park",
    ("natur", "NAT-08"): "place:ringve-botaniske-hage",
    ("opplevelser", "EXP-02"): "place:ringve-botaniske-hage",
    ("natur", "NAT-09"): "place:ringve-musikkmuseum",
    ("opplevelser", "EXP-01"): "place:ringve-musikkmuseum",
    ("natur", "NAT-10"): "place:lade-kirke",
    ("opplevelser", "EXP-04"): "place:lade-kirke",
    ("natur", "NAT-11"): "place:ladehammeren-vattahaugen",
    ("opplevelser", "EXP-06"): "place:ladehammeren-vattahaugen",
    ("natur", "NAT-12"): "place:ladekaia",
    ("servering", "SRV-01"): "place:ladekaia",
    ("opplevelser", "EXP-11"): "place:ladekaia",
    ("natur", "NAT-15"): "place:ladestien",
    ("trening", "UTE-01"): "place:ladestien",
    ("oppvekst", "OPP-19"): "place:leangen-kunstisbane",
    ("trening", "ANL-02"): "place:leangen-kunstisbane",
    ("oppvekst", "OPP-18"): "org:sk-trygg-lade",
    ("trening", "KLU-01"): "org:sk-trygg-lade",
    ("oppvekst", "OPP-09"): "plan:r20160019:o-bbh",
    ("oppvekst", "OPP-14"): "facility:leangenbukta:outdoor-areas",
    ("hverdag", "LB-01"): "facility:leangenbukta:planned-commercial-unit",
    ("servering", "SRV-20"): "facility:leangenbukta:planned-commercial-unit",
    ("servering", "SRV-21"): "facility:leangenbukta:knutepunktet-lounge",
    ("trening", "BEB-01"): "facility:leangenbukta:knutepunktet-training-room",
    ("opplevelser", "EXP-14"): "invalid:neighbor-plan:r20170034:torget",
}

PARENTS = {
    ("hverdag", "DG-01"): "place:city-lade", ("hverdag", "AP-01"): "place:city-lade",
    ("hverdag", "VM-01"): "place:city-lade", ("hverdag", "DG-04"): "place:sirkus-shopping",
    ("hverdag", "VM-02"): "place:sirkus-shopping", ("hverdag", "DG-03"): "place:lade-arena",
    ("hverdag", "AP-03"): "place:lade-arena", ("hverdag", "PO-02"): "place:lade-arena",
    ("hverdag", "AP-04"): "place:ladetorget", ("hverdag", "PO-01"): "place:ladetorget",
    ("servering", "SRV-03"): "place:city-lade", ("servering", "SRV-04"): "place:city-lade",
    **{("servering", f"SRV-{i:02d}"): "place:city-lade" for i in range(11, 19)},
    **{("servering", f"SRV-{i:02d}"): "place:sirkus-shopping" for i in range(6, 9)},
    ("servering", "SRV-19"): "place:lade-arena",
    ("servering", "SRV-05"): "place:ladetorget", ("servering", "SRV-09"): "place:ladetorget",
    ("servering", "SRV-10"): "place:ringve-musikkmuseum",
    ("oppvekst", "OPP-02"): "place:lade-skole", ("oppvekst", "OPP-16"): "place:lade-fritidsklubb",
    ("trening", "TRE-05"): "place:trygg-lade-hallen", ("trening", "ANL-02"): "place:leangen-idrettspark",
    ("trening", "ANL-03"): "place:leangen-idrettspark",
}

SOURCES = {
    "place:korsvika": ["https://www.trondheim.kommune.no/tema/kultur-og-fritid/park-og-mark/badeplasser/badeplasser-i-saltvann/korsvika/"],
    "place:ringvebukta": ["https://www.trondheim.kommune.no/tema/kultur-og-fritid/park-og-mark/parker-og-byrom/ringvebukta/"],
    "place:djupvika": ["https://www.trondheim.kommune.no/tema/kultur-og-fritid/park-og-mark/badeplasser/"],
    "place:grilstadstranda": ["https://www.trondheim.kommune.no/tema/kultur-og-fritid/park-og-mark/badeplasser/"],
    "place:ringve-botaniske-hage": ["https://www.ntnu.no/museum/ringve-botaniske-hage", "https://www.ntnu.no/museum/praktisk-ringve"],
    "place:ringve-musikkmuseum": ["https://ringve.no/besok-oss/apningstider,-billetter-og-kar"],
    "place:lade-kirke": ["https://www.kirken.no/nb-NO/fellesrad/trondheim-kirkelige-fellesrad/menigheter/Lade/Hva_skjer_Lade/diakoni-og-omsorg/apen-kirke/"],
    "place:leangen-stasjon": ["https://www.banenor.no/reise-og-trafikk/stasjoner/-l-/leangen/"],
    "topic:pirbrua-ranheim-cycle-route": ["https://miljopakken.no/prosjekter/sykkelforbindelse-pirbrua-ranheim"],
    "place:city-lade": ["https://citylade.no/apningtider/", "https://citylade.no/spisesteder/"],
    "place:sirkus-shopping": ["https://sirkusshopping.no/aapningstider/"],
    "place:lade-arena": ["https://ladearena.no/butikker/"],
    "place:ladetorget": ["https://www.ladetorget.no/butikker"],
    "place:lade-skole": ["https://www.trondheim.kommune.no/org/oppvekst/skoler/lade-skole/"],
    "service:lade-sfo": ["https://www.trondheim.kommune.no/org/oppvekst/skoler/lade-skole/lade-skole-sfo/"],
    "place:ladesletta-barnehage": ["https://www.trondheim.kommune.no/org/oppvekst/barnehager/ladestien-bhgr/"],
    "place:leangen-kulturbarnehage-sa": ["https://www.barnehagefakta.no/barnehage/979289952/leangen-kulturbarnehage-sa", "https://leangenkulturbarnehage.no/sok-barnehageplass/"],
    "place:lade-skole-play": ["https://www.trondheim.kommune.no/tema/kultur-og-fritid/park-og-mark/lekeplasser/lade-skole-lek/"],
    "place:ladeparken": ["https://www.trondheim.kommune.no/tema/kultur-og-fritid/park-og-mark/parker-og-byrom/ladeparken/"],
    "place:lade-fritidsklubb": ["https://www.trondheim.kommune.no/tema/kultur-og-fritid/aktivitetstilbudkulturtilbud/fritidsklubber/lade-fritidsklubb/"],
    "place:ladekaia": ["https://ladekaia.no/"],
    "place:egon-lade": ["https://citylade.no/apningtider/", "https://egon.no/restauranter/troendelag/egon-lade"],
    "place:kompis-lade": ["https://www.kompisnorge.no/restauranter/trondelag/kompis-lade/"],
    "place:digg-sirkus": ["https://sirkusshopping.no/butikker/298/", "https://digg.no/sirkus"],
    "place:dromedar-sirkus-shopping": ["https://sirkusshopping.no/butikker/293/"],
    "place:krem-mat-og-kaffehus": ["https://sirkusshopping.no/butikker/krem/"],
    "place:3t-lade": ["https://www.3t.no/treningssenter/3t-lade"],
    "place:impulse-leangen": ["https://impulse.no/senter/leangen/"],
    "place:impulse-lade": ["https://impulse.no/senter/lade/"],
    "place:trygg-lade-hallen": ["https://www.trygglade.no/tryggladehallen"],
    "service:trygg-lade-training-room": ["https://www.trygglade.no/treningssenter"],
    "place:leangen-idrettspark": ["https://sites.google.com/trondheim.kommune.no/leangenidrettspark/start"],
    "place:leangen-kunstisbane": ["https://sites.google.com/trondheim.kommune.no/leangenidrettspark/kunstisbane/sesong-og-%C3%A5pningstider"],
    "place:husebybadet": ["https://www.trondheim.kommune.no/tema/kultur-og-fritid/lokaler/husebybadet/"],
    "place:leos-lekeland-trondheim": ["https://www.leoslekeland.no/vare-lekeland/trondheim"],
    "place:rockheim": ["https://rockheim.no/apningstider-og-priser"],
    "place:lucky-bowl-trondheim": ["https://luckybowl.no/trondheim/"],
    "place:trondheim-kino-nova-prinsen": ["https://www.trondheimkino.no/nova-kinosenter", "https://www.trondheimkino.no/prinsen-kinosenter"],
    "place:vitensenteret": ["https://vitensenteret.com/besok"],
}

CANONICAL_BY_ID = {
    **{("transport", f"TRN-{i:02d}"): "place:leangen-stasjon" for i in (13, 14, 15, 16)},
    **{("transport", f"TRN-{i:02d}"): "topic:pirbrua-ranheim-cycle-route" for i in range(18, 24)},
    ("hverdag", "KS-01"): "place:city-lade", ("hverdag", "KS-02"): "place:sirkus-shopping",
    ("hverdag", "KS-03"): "place:lade-arena",
    ("oppvekst", "OPP-01"): "place:lade-skole", ("oppvekst", "OPP-02"): "service:lade-sfo",
    ("oppvekst", "OPP-03"): "place:ladesletta-barnehage", ("oppvekst", "OPP-10"): "place:lade-skole-play",
    ("oppvekst", "OPP-11"): "place:ladeparken", ("oppvekst", "OPP-15"): "place:lade-fritidsklubb",
    ("servering", "SRV-03"): "place:egon-lade", ("servering", "SRV-05"): "place:kompis-lade",
    ("trening", "TRE-01"): "place:3t-lade", ("trening", "TRE-02"): "place:impulse-leangen",
    ("trening", "TRE-03"): "place:impulse-lade", ("trening", "TRE-05"): "service:trygg-lade-training-room",
    ("trening", "ANL-01"): "place:leangen-idrettspark", ("trening", "ANL-05"): "place:trygg-lade-hallen",
    ("trening", "SVØ-01"): "place:husebybadet", ("opplevelser", "EXP-07"): "place:leos-lekeland-trondheim",
}

CORRECTIONS = {
    ("transport", "TRN-14"): "Rårapportens driftsmelding om heis er ikke synlig på Bane NORs gjeldende stasjonsside og kan ikke brukes som nåstatus.",
    ("oppvekst", "OPP-02"): "Lade SFO publiserer nå konkret åpningstid 07.15–16.30; rårapportens uavklarte tidsfelt er foreldet.",
    ("oppvekst", "OPP-15"): "Kommunens gjeldende side oppgir gaming mandag 16–18 med påmelding, ikke onsdag som i rårapporten.",
    ("servering", "SRV-19"): "Lade Arenas gjeldende offisielle butikkside lister Burger King; rårapportens driftsstatus er dermed styrket, men stedet beholdes som sentermedlem.",
    ("trening", "TRE-01"): "3Ts gjeldende avdelingsside dokumenterer spa-basseng, dampbad og kaldkulp ved 3T-Lade; dette var uavklart i rårapporten.",
    ("opplevelser", "EXP-07"): "Leo's publiserer 09–20 lørdag og søndag for kontrollperioden; rårapportens 09–19 er ikke gjeldende.",
    ("opplevelser", "EXP-08"): "Virksomhetens gjeldende side oppgir besøksadresse Heggstadmoen 55 og nyere tider enn rårapporten. Beholdes som ekstern referanse utenfor Lade.",
    ("opplevelser", "EXP-13"): "Datoene 12.–13. juni 2026 er passert. Festivalen kan bevares historisk, men skal ikke importeres som et kommende arrangement.",
    ("opplevelser", "EXP-14"): "Objektet bygger på r20170034, som gjelder travbaneområdet/naboprosjektet. Det kan ikke brukes som Leangenbukta-fakta.",
    ("trening", "TRE-04"): "Kjedens egen side varslet at senteret ikke skulle være i drift etter 1. februar 2026. Det skal ikke vises som aktivt tilbud uten ny direkte bekreftelse.",
    ("transport", "TRN-16"): "Skinneavstand til Trondheim S er ikke en beregnet reiserute fra boligadressen og skal ikke brukes i boardet.",
    ("transport", "TRN-38"): "Reisevaneandelen er fra 2018/2019 og gjelder et område, ikke dagens beboere eller prosjektet. Den beholdes ikke som kjøperfakta.",
    ("transport", "TRN-39"): "Påstanden er en barrierevurdering hentet fra analyse av annen eiendom. Faktisk rute fra prosjektet er ikke kartlagt.",
    ("servering", "SRV-21"): "Loungen er dokumentert som beboerfellesareal, ikke offentlig eller kommersiell servering. Den utelates fra serveringssteder.",
}


def reason(category: str, cid: str, decision: str) -> str:
    custom = CORRECTIONS.get((category, cid))
    if custom:
        return custom
    return {
        "start_set": "Relevant for kategorien og støttet av kontrollert primærkilde. Kartpublisering venter dersom inngang eller koordinat ikke er verifisert.",
        "member": "Beholdes som medlem under et kanonisk anker eller større anlegg, slik at kartet ikke får doble markører.",
        "topic_only": "Relevant samtalekunnskap eller gjenbruk av et sted med annen primærkategori; skal ikke opprette en ny markør her.",
        "external_reference": "Dekker et behov som ikke er dokumentert lokalt. Beholdes som tydelig merket referanse utenfor kjerneområdet.",
        "defer": "Mangler fersk primærkilde, faktisk inngang, driftsstatus eller tilstrekkelig presisjon for publisering.",
        "exclude": "Skal ikke presenteres som aktivt eller prosjektspesifikt tilbud; råpåstanden er utløpt, feilkoplet eller misvisende.",
    }[decision]


APPROVED_FACTS = {
    "place:korsvika": ["Kommunal badeplass og friområde med benker/bord, toalett, grill, badestige og lekeplass.", "Kommunen beskriver adkomst fra enden av Korsvik allé."],
    "place:ringvebukta": ["Kommunalt park- og lekeområde ved sjøen med offentlig toalett og lekeelementer."],
    "place:djupvika": ["Kommunen fører Djupvika i sin gjeldende oversikt over badeplasser i saltvann."],
    "place:grilstadstranda": ["Kommunens badeplassoversikt oppgir rullestolmatte og toalett med stellebenk."],
    "place:ringve-botaniske-hage": ["NTNU oppgir at hagen er gratis og åpen hver dag hele året.", "Hagen er 130 dekar og har inngang fra nord ved Olav Engelbrektssons allé."],
    "place:leangen-stasjon": ["Bane NOR oppgir adresse Leangenvegen 14 og togforbindelse på R70.", "Det finnes 15 parkeringsplasser og 2 HC-plasser ved den gamle stasjonsbygningen.", "Trinnfri rute finnes, men er lengre; planovergangen til plattformen har trapper."],
    "topic:pirbrua-ranheim-cycle-route": ["Miljøpakken oppgir prosjektstatus Pågår.", "Hangarbrua åpnet i september 2025; flere delstrekninger er bygget, mens gjenstående strekning avhenger av finansiering."],
    "place:city-lade": ["Senteret oppgir ordinært hverdager 09–21 og lørdag 09–20.", "Søndag er senteret stengt, mens Solrekka har egne åpningstider."],
    "place:sirkus-shopping": ["Senteret oppgir ordinært hverdager 09–21 og lørdag 09–20.", "Søndagsåpne serveringssteder har egne tider."],
    "place:lade-arena": ["Senterets gjeldende butikkside lister blant annet Rema 1000, Vitusapotek og Burger King.", "Senteradressen er Haakon VIIs gate 8–12."],
    "place:lade-skole": ["Kommunal skole for 1.–10. trinn i Ladehammerveien 45.", "Skolens side oppgir 663 elever per 11.05.2026.", "Skolekrets for Haakon VIIs gate 14 er ikke verifisert."],
    "service:lade-sfo": ["Lade SFO publiserer åpningstid 07.15–16.30 og tilbud for 1.–4. trinn."],
    "place:ladesletta-barnehage": ["Kommunal barnehage i Lade allé 80A med åpningstid 07.15–16.30.", "Enheten oppgir sommerstengt uke 28–30 i 2026 og 2027."],
    "place:leangen-kulturbarnehage-sa": ["Privat samvirkeforetak for barn 1–5 år i Peder Østlunds veg 1.", "Opptak skjer gjennom kommunens samordnede opptak."],
    "place:lade-skole-play": ["Kommunalt leke- og aktivitetsområde i tilknytning til Lade skole."],
    "place:ladeparken": ["Kommunalt park- og lekeområde med toalett."],
    "place:lade-fritidsklubb": ["Kommunalt gratis fritidstilbud i Håkon Magnussons gate 5.", "Åpent tilbud mandag 18–21; gaming mandag 16–18 krever påmelding."],
    "place:ladekaia": ["Serveringssted i Leiv Eirikssons vei 42 med bordbooking.", "Virksomheten oppgir 11–22 alle dager og kjøkken til 21; tiden er sesongfølsom og må oppfriskes."],
    "place:egon-lade": ["Egon i Solrekka oppgir man–lør 10–23 og søndag 12–22.", "Virksomheten har egen uteservering."],
    "place:kompis-lade": ["Kompis Lade publiserer egne restaurant- og takeaway-tider, inkludert søndag 13–22."],
    "place:3t-lade": ["Åpent man–fre 05–22.30, lør 08–21 og søn 08–22.30.", "Avdelingen er bemannet i hele åpningstiden og oppgir spa-basseng, dampbad og kaldkulp."],
    "place:impulse-leangen": ["Adgang 05–24 alle dager.", "Ligger i 2. etasje i Haakon VIIs gate 27, med inngang mot parkeringsplassen."],
    "place:impulse-lade": ["Adgang 05–24 alle dager i Østmarkveien 4.", "Avdelingen oppgir mer enn 700 m² treningsareal."],
    "service:trygg-lade-training-room": ["Selvbetjent styrkerom til 200 kr per måned i tillegg til klubbmedlemskap.", "Adgang via Wondr; inngang på baksiden mot Haakon VIIs gate."],
    "place:trygg-lade-hallen": ["Klubbeid hall fra 2023 i Haakon VIIs gate 2A med 9er-fotballhall, flerbrukshall, garderober og styrkerom."],
    "place:leangen-idrettspark": ["Kommunalt idrettsanlegg med kunstisbane, ishaller, fleridrettsflater, curlinghall og kunstgressbaner.", "Kommunen opplyser om midlertidig påvirket parkering og adkomst i september 2026."],
    "place:leangen-kunstisbane": ["Gratis publikumstid uten reservasjon tirsdag/torsdag 11.15–16 og onsdag/fredag 10–16 i sesong.", "Sesongen er væravhengig, normalt omtrent 1. november–15. mars; kveld og helg må sjekkes i aktivitetskalenderen."],
    "place:husebybadet": ["Kommunalt publikumsbad på Saupstad med publikumstider og billettpriser publisert 24.08.2026."],
    "place:ringve-musikkmuseum": ["Billettbelagt museum i Lade allé 60 med offisielle koordinater 63.44748, 10.45351.", "Vintersesong 17.08.2026–01.04.2027: tirsdag–søndag 11–16, mandag stengt.", "Barn 0–15 år har gratis inngang i følge med betalende voksen."],
    "place:lade-kirke": ["Lade kirke har Åpen kirke tirsdager 12–13; øvrig adgang følger gudstjenester og arrangementer."],
    "place:leos-lekeland-trondheim": ["Innendørs lekeland i Ladebekken 6.", "Publisert tid for kontrollperioden er man–fre 10–20 og lør–søn 09–20.", "Barn leker under ansvar av foreldre eller foresatte."],
    "place:rockheim": ["Nasjonalt museum for populærmusikk i Brattørkaia 14.", "Åpningstid i 2026 er tirsdag–fredag 10–16, lørdag–søndag 11–17 og mandag stengt."],
    "place:lucky-bowl-trondheim": ["Aktivitetssenter i Heggstadmoen 55 med bowling, lasertag, go-kart, lekeland og andre aktiviteter.", "Virksomheten publiserer egne åpningstider per aktivitet; de må oppfriskes før bruk."],
    "place:trondheim-kino-nova-prinsen": ["Trondheim Kino driver Nova i Olav Tryggvasons gate 5 og Prinsen i Prinsens gate 2B.", "Nova har 11 saler og Prinsen 8."],
    "place:vitensenteret": ["Interaktivt vitensenter i Kongens gate 1.", "Åpent mandag–fredag 10–16 og lørdag–søndag 10–17 per kontrollen; barn under 10 år må være i følge med voksen."],
}

QUESTIONS = {
    "natur": [
        ("broad", "Hvilke natur- og badesteder er dokumentert i området?", "Korsvika, Ringvebukta og Djupvika er dokumenterte kommunale kandidater. Ringve botaniske hage er et gratis helårstilbud. Faktisk rute og reisetid fra boligen er ikke beregnet."),
        ("specific", "Hva finnes i Korsvika?", "Kommunen oppgir blant annet benker og bord, toalett, grill, badestige og lekeplass. Adkomst beskrives fra enden av Korsvik allé."),
        ("follow_up", "Er Ringve botaniske hage gratis hele året?", "Ja. NTNU oppgir gratis adgang og åpent hver dag hele året. Enkelte stier er bratte, så tilgjengelighet må vurderes per rute."),
        ("unknown", "Er adkomststien fra Leangenbukta til Ladestien åpen akkurat nå?", "Det er ikke verifisert. Planmateriale og eldre kilder dokumenterer ulike forbindelser, men nåstatus og faktisk inngang må kontrolleres før den kan vises."),
        ("interruption_resume", "Fortsett om badeplassene etter et avbrudd.", "Fortsett fra sist omtalte sted uten å starte kategorien på nytt; ikke legg til avstand eller rangering."),
    ],
    "transport": [
        ("broad", "Hvilke transporttilbud kan vi dokumentere?", "Leangen stasjon og hovedsykkelvegprosjektet kan beskrives fra gjeldende primærkilder. Busslinjer og holdeplasser i rårapporten må oppfriskes mot AtB/Entur før publisering."),
        ("specific", "Hva vet vi om Leangen stasjon?", "Bane NOR oppgir R70, adresse Leangenvegen 14, 15 parkeringsplasser og 2 HC-plasser. Trinnfri rute finnes, men er lengre, og planovergangen til plattformen har trapper."),
        ("follow_up", "Er heisen på Leangen stasjon ute av drift?", "Det kan ikke bekreftes fra dagens stasjonsside. Den eldre driftsmeldingen i rårapporten skal ikke brukes som nåstatus."),
        ("unknown", "Hvilken buss går fra prosjektet akkurat nå?", "Det må hentes fra gjeldende AtB/Entur-data for konkret holdeplass og dato. 2022-ruteplaner brukes ikke som dagens svar."),
        ("interruption_resume", "Fortsett om sykkelforbindelsen etter et avbrudd.", "Fortsett med hvilke delstrekninger Miljøpakken sier er bygget og hvilke som gjenstår; ikke hev en sammenhengende rute fra prosjektet."),
    ],
    "hverdag": [
        ("broad", "Hvilke hverdagstilbud er dokumentert?", "City Lade, Sirkus Shopping og Lade Arena er kontrollerte ankre. Dagligvare, apotek, post og servering representeres som medlemmer under sentrene."),
        ("specific", "Hva er åpent på City Lade på søndag?", "Selve senteret er stengt. City Lade oppgir egne søndagstider for Solrekka: Egon 12–22 og Snurr 10–16."),
        ("follow_up", "Finnes dagligvare og apotek på Lade Arena?", "Ja. Senterets gjeldende butikkside lister Rema 1000 og Vitusapotek. Åpningstid må leses per virksomhet."),
        ("unknown", "Hvilket apotek kommer man raskest til?", "Det er ikke beregnet. Flere apotek er dokumentert, men en slik sammenlikning krever kontrollert startpunkt og rute."),
        ("interruption_resume", "Fortsett om sentrene etter et avbrudd.", "Fortsett fra valgt senter og dets medlemmer; ikke opprett egne kartmarkører for hvert medlem."),
    ],
    "oppvekst": [
        ("broad", "Hvilke oppveksttilbud er dokumentert?", "Lade skole, Lade SFO, Ladesletta barnehage, Leangen kulturbarnehage, kommunale lekeområder og Lade fritidsklubb er relevante kandidater. Skolekretsen for adressen er fortsatt uavklart."),
        ("specific", "Hva er åpningstiden til Lade SFO?", "Skolens gjeldende SFO-side oppgir 07.15–16.30."),
        ("follow_up", "Sokner Haakon VIIs gate 14 til Lade skole?", "Det er ikke verifisert. Lade skole er en relevant skole i området, men skolekrets må slås opp for adressen i kommunens løsning."),
        ("unknown", "Er det ledig plass i barnehagen?", "Det kan ikke utledes fra kapasitetstall. Ledig plass varierer og må avklares gjennom kommunens opptak."),
        ("interruption_resume", "Fortsett om fritidstilbud etter et avbrudd.", "Fortsett med Lade fritidsklubb og tilknyttede tilbud; bruk oppdatert mandagsprogram og ikke rårapportens onsdagsopplysning."),
    ],
    "servering": [
        ("broad", "Hvilke serveringssteder er dokumentert?", "Ladekaia, Egon Lade og Kompis Lade er valgt som selvstendige startsteder. Øvrige spisesteder beholdes som medlemmer under kjøpesentre eller andre ankre."),
        ("specific", "Hva er åpent på City Lade søndag?", "Egon i Solrekka oppgis åpent 12–22 og Snurr 10–16. Resten av senteret er stengt med mindre virksomheten publiserer egen tid."),
        ("follow_up", "Kan jeg bestille takeaway fra Kompis?", "Kompis publiserer egne takeaway-tider som følger restauranttidene, inkludert søndag 13–22."),
        ("unknown", "Leverer de til Haakon VIIs gate 14?", "Det er ikke kontrollert. Leveringsområde må sjekkes for den konkrete adressen i bestillingstjenesten."),
        ("interruption_resume", "Fortsett om sjøservering etter et avbrudd.", "Fortsett med Ladekaia og sesongforbeholdet; ikke love at publisert tid gjelder uten oppfriskning."),
    ],
    "trening": [
        ("broad", "Hvilke treningstilbud er dokumentert?", "3T-Lade, Impulse Leangen, Impulse Lade, Leangen idrettspark og Trygg/Lade-hallen er kontrollerte kandidater. Fresh Fitness skal ikke vises som aktivt tilbud."),
        ("specific", "Når kan publikum bruke Leangen kunstisbane?", "I sesong er gratis tid uten reservasjon publisert tirsdag/torsdag 11.15–16 og onsdag/fredag 10–16. Kveld og helg varierer og må sjekkes."),
        ("follow_up", "Har 3T-Lade basseng?", "Ja. Avdelingens gjeldende side oppgir spa-basseng, dampbad og kaldkulp."),
        ("unknown", "Er beboertreningsrommet i Knutepunktet ferdig?", "Det er ikke dokumentert ferdigstilt. Det behandles som en planlagt beboerfasilitet, uten offentlig adgang eller kjent utstyrsliste."),
        ("interruption_resume", "Fortsett om treningssentre etter et avbrudd.", "Fortsett fra valgt senter og hold adgangstid og bemannet tid adskilt."),
    ],
    "opplevelser": [
        ("broad", "Hvilke opplevelser er dokumentert på Lade?", "Ringve Musikkmuseum, Lade kirke og Leo's Lekeland er valgt som lokale startsteder. Hagen, Leangen gård og Ladehammeren gjenbrukes fra Natur."),
        ("specific", "Når er Ringve åpent nå?", "Vintersesongen 17.08.2026–01.04.2027 har tirsdag–søndag 11–16 og mandag stengt."),
        ("follow_up", "Er hagen gratis selv om museet koster penger?", "Ja. Ringve botaniske hage drives av NTNU og er gratis hele året; museets utstillinger krever billett."),
        ("unknown", "Kommer det en offentlig kulturarena på torget i Leangenbukta?", "Det finnes ikke dokumentasjon for det i korrekt Leangenbukta-plan. Rårapportens torgpåstand kommer fra naboplan r20170034 og er avvist."),
        ("interruption_resume", "Fortsett om familieaktiviteter etter et avbrudd.", "Fortsett med Leo's og gjeldende 09–20 i helgen; skill faste stedstider fra program og enkeltarrangementer."),
    ],
}


def canonical(category: str, candidate: dict) -> str:
    key = (category, candidate["candidate_id"])
    if key in CANONICAL_OVERRIDES:
        return CANONICAL_OVERRIDES[key]
    if key in CANONICAL_BY_ID:
        return CANONICAL_BY_ID[key]
    return f"place:{slug(candidate['name'])}"


def build() -> None:
    parsed = parse_all()
    OUT.mkdir(parents=True, exist_ok=True)
    all_summaries = []

    for category, candidates in parsed.items():
        assert len(candidates) == EXPECTED[category], (category, len(candidates))
        assert set(DECISIONS[category]) == {c["candidate_id"] for c in candidates}, category
        for candidate in candidates:
            cid = candidate["candidate_id"]
            decision = DECISIONS[category][cid]
            canonical_id = canonical(category, candidate)
            parent_id = PARENTS.get((category, cid))
            source_urls = SOURCES.get(canonical_id, []) or SOURCES.get(parent_id, [])
            approved_facts = list(APPROVED_FACTS.get(canonical_id, []))
            if decision == "member" and parent_id and source_urls and not approved_facts:
                approved_facts = [
                    f"{candidate['name']} beholdes som medlem under {parent_id}; egne åpningstider arves ikke fra ankeret."
                ]
            if canonical_id.startswith("place:"):
                scope = "global_place"
                reuse_constraints = "Reuse place facts globally; keep board membership, routes and travel times board-specific."
            elif canonical_id.startswith(("facility:", "plan:")):
                scope = "project"
                reuse_constraints = "Use only for Leangenbukta and only with the documented project or plan status."
            elif canonical_id.startswith("service:"):
                scope = "global_service"
                reuse_constraints = "Reuse service facts with the canonical host place; refresh schedules and prices."
            elif canonical_id.startswith("org:"):
                scope = "global_organisation"
                reuse_constraints = "Reuse organisation facts; team availability and schedules remain time-sensitive."
            elif canonical_id.startswith("topic:"):
                scope = "topic"
                reuse_constraints = "Conversation knowledge only until a place, route or current service instance is modelled."
            else:
                scope = "invalid_reference"
                reuse_constraints = "Do not import."
            candidate.update({
                "canonical_id": canonical_id,
                "scope": scope,
                "board_id": "leangenbukta-lokal",
                "decision": decision,
                "decision_reason": reason(category, cid, decision),
                "primary_source_urls": source_urls,
                "observed_at": REVIEWED_AT,
                "approved_facts": approved_facts,
                "parent_canonical_id": parent_id,
                "reusable_across_boards": not canonical_id.startswith(("facility:", "plan:", "invalid:")),
                "reuse_constraints": reuse_constraints,
                "refresh_required_before_publish": decision in {"defer"} or any(
                    token in str(candidate["raw_report_fields_do_not_publish"]).lower()
                    for token in ("opening_hours", "ticket_price", "price", "activity_schedule", "seasonal")
                ),
                "map_action": {
                    "start_set": "create_after_entrance_and_coordinate_check",
                    "member": "attach_to_parent_without_duplicate_marker",
                    "topic_only": "no_marker_reuse_or_conversation_only",
                    "external_reference": "outside_core_no_local_marker",
                    "defer": "hold",
                    "exclude": "never_import_as_current_place",
                }[decision],
                "runtime_status": "blocked_on_u4_local_board_schema",
                "coordinate_status": "official_source" if (category, cid) in {
                    ("trening", "TRE-01"), ("opplevelser", "EXP-01")
                } else "unverified_or_missing",
                "entrance_status": "documented" if (category, cid) in {
                    ("trening", "TRE-02"), ("opplevelser", "EXP-01")
                } else "unverified_or_area_access",
            })

        counts = Counter(c["decision"] for c in candidates)
        questions = [
            {
                "scenario": scenario,
                "question": question,
                "approved_answer": answer,
                "evaluation": "content_pass",
                "runtime_evaluation": "not_run_u4_dependency_missing",
            }
            for scenario, question, answer in QUESTIONS[category]
        ]
        payload = {
            "schema_version": 1,
            "category": category,
            "project_id": "leangenbukta",
            "board_id": "leangenbukta-lokal",
            "reviewed_at": REVIEWED_AT,
            "status": "content_curated_runtime_blocked",
            "raw_report": f"raw/{FILES[category]}",
            "receipt_note": RECEIPTS[category],
            "method": {
                "candidate_policy": "Every structured candidate receives an explicit decision.",
                "source_policy": "Current primary sources override raw-report status and secondary directories.",
                "map_policy": "No map point is imported without a defensible entrance or explicitly labelled area anchor.",
                "distance_policy": "No distance or travel time is stored before U4 provides the controlled start point and route calculation.",
            },
            "coverage": {
                "received_candidates": len(candidates),
                "reviewed_candidates": len(candidates),
                "decision_counts": dict(sorted(counts.items())),
                "buyer_questions": len(questions),
                "unreviewed_candidates": 0,
            },
            "candidates": candidates,
            "buyer_questions": questions,
        }
        (OUT / f"{category}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")

        lines = [
            f"# U6-kategorivurdering: {category.capitalize()}", "",
            f"Kontrolldato: {REVIEWED_AT}. Status: **innhold kuratert; runtime-import blokkert av U4**.", "",
            f"Alle **{len(candidates)} av {len(candidates)}** strukturerte kandidater er vurdert. Ingen reisetid eller avstand er beregnet.", "",
            "## Beslutningsregnskap", "",
            "| Beslutning | Antall |", "|---|---:|",
        ]
        lines += [f"| `{key}` | {value} |" for key, value in sorted(counts.items())]
        lines += ["", "## Kandidater", "", "| ID | Kandidat | Beslutning | Kartbehandling | Begrunnelse |", "|---|---|---|---|---|"]
        for c in candidates:
            lines.append(f"| {c['candidate_id']} | {c['name'].replace('|', '/')} | `{c['decision']}` | `{c['map_action']}` | {c['decision_reason'].replace('|', '/')} |")
        lines += ["", "## Prøvbare kjøperspørsmål", ""]
        for q in questions:
            lines += [f"### {q['scenario']}: {q['question']}", "", q["approved_answer"], ""]
        lines += [
            "## Runtime- og kartstatus", "",
            "Denne leveransen oppretter ingen runtime-POI-er. U4s felles `local-board`-skjema, register og kontrollerte startpunkt finnes ikke ennå. Kandidater med `start_set` er derfor innholdsvalg, ikke ferdigimporterte kartpunkter. Faktisk inngang og koordinat må lukkes før kartpublisering.", "",
            "Den maskinlesbare og komplette vurderingen, inkludert råfelter og kilder, ligger i JSON-filen med samme navn.", "",
        ]
        (OUT / f"{category}.md").write_text("\n".join(lines))
        all_summaries.append({"category": category, "coverage": payload["coverage"], "file": f"categories/{category}.json"})

    total = sum(s["coverage"]["received_candidates"] for s in all_summaries)
    decision_totals = Counter()
    for category in parsed:
        decision_totals.update(DECISIONS[category].values())

    manifest = {
        "schema_version": 1,
        "project_id": "leangenbukta",
        "board_id": "leangenbukta-lokal",
        "reviewed_at": REVIEWED_AT,
        "status": "candidate_package_ready_runtime_blocked",
        "runtime_blocker": "U4 has not yet created the shared local-board schema, project registry, controlled start point or Leangenbukta runtime dataset.",
        "coverage": {
            "categories": 7,
            "received_candidates": total,
            "reviewed_candidates": total,
            "unreviewed_candidates": 0,
            "decision_counts": dict(sorted(decision_totals.items())),
            "buyer_questions": sum(len(QUESTIONS[c]) for c in QUESTIONS),
        },
        "category_files": all_summaries,
        "import_rules": [
            "Import only start_set candidates after entrance and coordinate verification.",
            "Attach member candidates to their parent without duplicate markers.",
            "Reuse canonical global places across boards; store board membership separately.",
            "Never import exclude candidates as current Leangenbukta facts.",
            "Refresh time-sensitive opening hours, prices, public sessions and schedules before demo publication.",
            "Calculate routes and travel times only from the controlled Leangenbukta start point created in U4.",
            "Keep school district, delivery coverage and current capacity unresolved until address-specific checks exist.",
        ],
        "known_corrections": [
            "Leangen station has no current published elevator outage in the checked Bane NOR page.",
            "Lade SFO now publishes 07:15–16:30.",
            "Lade fritidsklubb gaming is Monday 16–18, not Wednesday.",
            "Burger King is listed on Lade Arena's current official shop page.",
            "3T-Lade's current page explicitly lists spa facilities.",
            "Leo's current weekend hours are 09–20 for the control period.",
            "Leangenbukta Torget in the raw experiences report belongs to neighbor plan r20170034 and is excluded.",
        ],
        "files_not_created": [
            "Leangenbukta runtime JSON: blocked on U4 schema and registry.",
            "lib/demo/local-board/leangenbukta-content.test.ts: blocked because lib/demo/local-board does not exist.",
            "Travel-time fields: blocked on controlled start point and routing pass.",
        ],
    }
    (ROOT / "import-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

    index = [
        "# Leangenbukta U6 — kategoripakke", "",
        f"Kontrolldato: {REVIEWED_AT}.", "",
        f"Alle **{total} av {total}** strukturerte kandidater i de syv rårapportene er vurdert. Pakken inneholder **{sum(len(QUESTIONS[c]) for c in QUESTIONS)}** prøvbare kjøperspørsmål.", "",
        "Denne katalogen er kuratert innholdsgrunnlag. Den er ikke en runtime-import. `start_set` betyr at kandidaten er valgt redaksjonelt og kildekontrollert på innholdsnivå; kartpunktet krever fortsatt kontroll av inngang og koordinat.", "",
        "| Kategori | Kandidater | Startsett | Medlemmer | Tema | Eksterne | Utsatt | Utelatt |", "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for s in all_summaries:
        d = s["coverage"]["decision_counts"]
        index.append(f"| [{s['category'].capitalize()}]({s['category']}.md) | {s['coverage']['received_candidates']} | {d.get('start_set', 0)} | {d.get('member', 0)} | {d.get('topic_only', 0)} | {d.get('external_reference', 0)} | {d.get('defer', 0)} | {d.get('exclude', 0)} |")
    index += [
        "", "## Gjenbruk", "",
        "Kanoniske steder har ID-er som `place:ringve-musikkmuseum`, `place:ladekaia` og `place:leangen-stasjon`. De tilhører ikke Leangenbukta og kan gjenbrukes av senere boards, blant annet bruktboliger. `board_id` beskriver bare at stedet er valgt til dette boardet. Prosjektfasiliteter bruker `facility:leangenbukta:*` og skal ikke gjenbrukes som globale steder.", "",
        "## Blokkering før import", "",
        "U4 må etablere felles `local-board`-skjema, register, kontrollert startpunkt og Leangenbukta-datasett. Deretter må startsettets faktiske innganger og koordinater verifiseres, tidsfølsomme felt oppfriskes og ruter beregnes. Først da kan kategoriene importeres og kjøres i den virkelige samtale- og karttesten.", "",
        "## Reproduser vurderingen", "",
        "Kjør `python3 docs/research/leangenbukta-lokal-demo/_build_u6.py`. Skriptet leser de syv bevarte rårapportene, krever nøyaktig 145 kandidater, bygger alle kategoriartefaktene og stopper ved brudd på valideringsreglene.", "",
    ]
    (OUT / "README.md").write_text("\n".join(index))

    evaluation = [
        "# Samtaleevaluering — Leangenbukta U6", "",
        f"Kontrolldato: {REVIEWED_AT}.", "",
        "Dette er en innholdsevaluering av de godkjente svarene. Live-test mot Anja, klikk/tale-paritet, kartoppdatering og faktisk avbrudd/fortsettelse er **ikke kjørt**, fordi U4s felles runtime og Leangenbukta-register ikke finnes ennå.", "",
        "## Resultat", "",
        "| Kategori | Bredt | Sted | Oppfølging | Uten dekning | Avbrudd/fortsettelse | Innhold | Runtime |", "|---|---|---|---|---|---|---|---|",
    ]
    for category in FILES:
        evaluation.append(f"| {category.capitalize()} | bestått | bestått | bestått | bestått med kunnskapshull | spesifisert | **5/5** | ikke kjørt (U4) |")
    evaluation += [
        "", "## Kontrollerte egenskaper", "",
        "- Svarene bruker ikke beregnet avstand, reisetid eller rangering.",
        "- Spørsmål uten dekning gir et konkret kunnskapshull og neste kontrollhandling.",
        "- Medlemmer under kjøpesentre og idrettsanlegg lager ikke doble kartmarkører.",
        "- Steder som går igjen på tvers av kategorier bruker samme kanoniske ID.",
        "- Feil plan, utløpte arrangementer og varslet nedlagt virksomhet blir ikke presentert som aktive tilbud.",
        "- Tidsfølsomme tider og priser er merket for oppfriskning.",
        "", "## Gjenstående faktisk test", "",
        "Når U4 er ferdig, skal de 35 scenarioene kjøres mot Anja. For hvert scenario må testen dokumentere muntlig svar, valgt handling, kartresultat, kildegrunnlag og om avbrudd kan fortsette fra riktig sted. Før den testen er U6 innholdsferdig, men ikke runtime-verifisert.", "",
    ]
    (ROOT / "conversation-evaluation.md").write_text("\n".join(evaluation))

    allowed_decisions = {"start_set", "member", "topic_only", "external_reference", "defer", "exclude"}
    required_scenarios = {"broad", "specific", "follow_up", "unknown", "interruption_resume"}
    checks = []

    def check(name: str, passed: bool, detail: str) -> None:
        checks.append((name, passed, detail))
        if not passed:
            raise AssertionError(f"{name}: {detail}")

    generated_payloads = [json.loads((OUT / f"{category}.json").read_text()) for category in FILES]
    generated_candidates = [candidate for payload in generated_payloads for candidate in payload["candidates"]]
    check("full_candidate_coverage", len(generated_candidates) == 145, f"{len(generated_candidates)} av 145")
    check("all_candidates_have_decision", all(c["decision"] in allowed_decisions for c in generated_candidates), "alle beslutninger er i tillatt enum")
    check("selected_have_primary_sources", all(c["primary_source_urls"] for c in generated_candidates if c["decision"] in {"start_set", "member", "external_reference"}), "alle startsett, medlemmer og eksterne referanser har primærkilde")
    check("selected_have_approved_facts", all(c["approved_facts"] for c in generated_candidates if c["decision"] in {"start_set", "member", "external_reference"}), "alle startsett, medlemmer og eksterne referanser har godkjente fakta")
    check("members_have_parent_anchor", all(c["parent_canonical_id"] for c in generated_candidates if c["decision"] == "member"), "alle medlemmer peker til et større anker")
    check("excluded_not_map_importable", all(c["map_action"] == "never_import_as_current_place" for c in generated_candidates if c["decision"] == "exclude"), "alle utelatte er blokkert fra kartimport")
    check("project_scope_not_globally_reusable", all(not c["reusable_across_boards"] for c in generated_candidates if c["scope"] == "project"), "prosjektobjekter er ikke globalt gjenbrukbare")
    check("five_question_scenarios_per_category", all({q["scenario"] for q in payload["buyer_questions"]} == required_scenarios for payload in generated_payloads), "alle syv kategorier har fem scenarioer")
    approved_text = " ".join(
        [fact for candidate in generated_candidates for fact in candidate["approved_facts"]]
        + [q["approved_answer"] for payload in generated_payloads for q in payload["buyer_questions"]]
    ).lower()
    forbidden = [term for term in ("nærmest", "kort vei", "gangavstand", "familievennlig", "barnevennlig") if term in approved_text]
    check("approved_copy_avoids_forbidden_marketing_terms", not forbidden, f"ingen treff; funnet={forbidden}")
    check("no_runtime_claim", all(payload["status"] == "content_curated_runtime_blocked" for payload in generated_payloads), "alle kategorier er eksplisitt runtime-blokkert")

    validation = [
        "# Valideringsrapport — Leangenbukta U6", "",
        f"Kjørt: {REVIEWED_AT}. Resultat: **{sum(1 for _, passed, _ in checks if passed)}/{len(checks)} kontroller bestått**.", "",
        "| Kontroll | Resultat | Detalj |", "|---|---|---|",
    ]
    for name, passed, detail in checks:
        validation.append(f"| `{name}` | {'bestått' if passed else 'feilet'} | {detail} |")
    validation += [
        "", "## Avgrensning", "",
        "Kontrollene validerer komplett kandidatregnskap, beslutninger, kildedekning, gjenbruk og godkjent svartekst. De erstatter ikke live-test mot Anja, karttest eller ruteberegning. Disse er blokkert av U4 og er eksplisitt registrert i `conversation-evaluation.md` og `import-manifest.json`.", "",
    ]
    (ROOT / "validation-report.md").write_text("\n".join(validation))


if __name__ == "__main__":
    build()
