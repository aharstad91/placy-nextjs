#!/usr/bin/env python3
"""Build the Leangenbukta local-board runtime dataset from audited packages.

The raw Opus reports are deliberately not read here. Runtime copy comes from
`approved_facts`, approved project claims, reviewed buyer answers and the
separate coordinate verification receipt. Route minutes are added only when a
checked Mapbox receipt exists.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[3]
RESEARCH = ROOT / "docs/research/leangenbukta-lokal-demo"
DATA = ROOT / "data/demo/leangenbukta-lokal"
CHECKED_AT = "2026-09-18"

CATEGORY_FILES = (
    "hverdag",
    "oppvekst",
    "servering",
    "natur",
    "transport",
    "trening",
    "opplevelser",
)

CATEGORY_COPY = {
    "leangenbukta-prosjektet": {
        "lead": "Reguleringsplan, byggetrinn og fellesfasiliteter med tydelig skille mellom vedtatt, forventet og åpnet.",
        "body": "Leangenbukta er regulert for minst 450 boliger, offentlig barnehage, uteoppholdsareal og offentlig turveg. Utbygger omtaler prosjektet som rundt 500 boliger. Opplysningene under skiller plangrunnlaget fra dagens byggestatus og forventede tidspunkt.",
        "invitation": "Vil du høre om planen, et byggetrinn eller fellesfasilitetene?",
        "placeInvitation": "Vil du vite mer om prosjektstatus eller et bestemt byggetrinn?",
    },
    "hverdag": {
        "lead": "Kjøpesentre og dokumenterte virksomheter for dagligvare, apotek, post og andre ærender.",
        "body": "City Lade, Sirkus Shopping og Lade Arena er kontrollerte senterankre. LadeTorget er lagt inn som et strukturelt anker for virksomhetene der. Åpningstider er tidsfølsomme og gjelder per senter eller virksomhet.",
        "invitation": "Vil du se et senter eller spørre om et bestemt ærend?",
        "placeInvitation": "Vil du se hvilke dokumenterte virksomheter som ligger i senteret?",
    },
    "oppvekst": {
        "lead": "Skole, SFO, barnehager, lekeområder og fritidstilbud med opptak og skolekrets holdt adskilt.",
        "body": "Lade skole, Lade SFO, to barnehager, kommunale lekeområder og Lade fritidsklubb er dokumentert. Skolekretsen for Haakon VIIs gate 14 er ikke verifisert, og plass i skole eller barnehage kan ikke utledes av plassering.",
        "invitation": "Vil du høre om skole, barnehage, lek eller fritidstilbud?",
        "placeInvitation": "Vil du høre om et annet oppveksttilbud?",
    },
    "servering": {
        "lead": "Serveringssteder ved sjøen, i Solrekka og ved LadeTorget, med sentersteder samlet under sine ankre.",
        "body": "Ladekaia, Egon Lade og Kompis Lade er egne startsteder. Andre serveringssteder ligger som medlemmer under City Lade, Sirkus Shopping, LadeTorget, Lade Arena eller Ringve Musikkmuseum. Sesong og virksomhetens egen åpningstid må kontrolleres før besøk.",
        "invitation": "Vil du høre om sjøservering, søndagsåpent eller takeaway?",
        "placeInvitation": "Vil du se et annet dokumentert serveringssted?",
    },
    "natur": {
        "lead": "Bade- og friområder samt botanisk hage, uten beregnede ruter i selve faktagrunnlaget.",
        "body": "Korsvika, Ringvebukta og Djupvika er dokumenterte kommunale steder. Ringve botaniske hage er gratis og åpen hele året. Kartpunkter uten dokumentert port eller publikumsinngang er merket som omtrentlige.",
        "invitation": "Vil du høre om et badested eller Ringve botaniske hage?",
        "placeInvitation": "Vil du høre om et annet tur- eller badested?",
        "moreNoun": "turmål",
    },
    "transport": {
        "lead": "Stasjon og planlagt sykkelforbindelse fra gjeldende primærkilder; gamle rutetabeller brukes ikke som nåstatus.",
        "body": "Leangen stasjon er kartfestet. Miljøpakkens hovedsykkelveg beskrives som et pågående prosjekt med ferdige og gjenstående delstrekninger. Busslinjer må hentes fra AtB eller Entur for konkret holdeplass og dato.",
        "invitation": "Vil du høre om toget, sykkelforbindelsen eller hva som fortsatt er uavklart?",
        "placeInvitation": "Vil du vite mer om adkomst eller forbindelser fra stasjonen?",
    },
    "trening": {
        "lead": "Kommersielle sentre, idrettspark og klubbanlegg med adgangstid, bemanning og publikumstid holdt adskilt.",
        "body": "3T-Lade, to Impulse-avdelinger, Leangen idrettspark og Trygg/Lade-hallen er kontrollerte startsteder. Kunstisbanen og halltilbud ligger som medlemmer under anleggene. Fresh Fitness er utelatt fordi kjedens egen side varslet at avdelingen ikke skulle være i drift etter 1. februar 2026.",
        "invitation": "Vil du høre om treningssenter, hall eller skøyter?",
        "placeInvitation": "Vil du høre om et annet treningstilbud?",
        "moreNoun": "treningssteder",
    },
    "opplevelser": {
        "lead": "Museum, kulturminne og innendørs familieaktivitet på Lade, med eksterne alternativer som temakunnskap.",
        "body": "Ringve Musikkmuseum, Lade kirke og Leo's Lekeland er lokale startsteder. Hagen er gratis uavhengig av museumsbilletten. Program og enkeltarrangementer er kalenderdata og behandles ikke som permanente stedstider.",
        "invitation": "Vil du høre om museum, kulturminne eller familieaktivitet?",
        "placeInvitation": "Vil du høre om en annen opplevelse?",
    },
}

PLACE_TYPE = {
    "KS-01": "Kjøpesenter", "KS-02": "Kjøpesenter", "KS-03": "Kjøpesenter",
    "NAT-01": "Badeplass og friområde", "NAT-02": "Park og friområde",
    "NAT-03": "Badeplass", "NAT-08": "Botanisk hage",
    "EXP-01": "Museum", "EXP-04": "Kirke og kulturminne", "EXP-07": "Innendørs lekeland",
    "OPP-01": "Skole", "OPP-03": "Barnehage", "OPP-05": "Barnehage",
    "OPP-10": "Leke- og aktivitetsområde", "OPP-11": "Park og lekeområde",
    "OPP-15": "Fritidsklubb", "SRV-01": "Serveringssted", "SRV-03": "Restaurant",
    "SRV-05": "Restaurant", "TRN-13": "Togstasjon", "TRE-01": "Treningssenter",
    "TRE-02": "Treningssenter", "TRE-03": "Treningssenter",
    "ANL-01": "Idrettspark", "ANL-05": "Idrettshall",
    "DERIVED-KS-04": "Nærsenter",
}

OFFICIAL_COORDINATES = {
    "EXP-01": {"lat": 63.44748, "lng": 10.45351},
    "TRE-01": {"lat": 63.44337, "lng": 10.45078},
}

RESULT_INDEX = {"NAT-01": 1}
USE_PARENT_COORDINATES = {"OPP-02", "OPP-16", "TRE-05", "ANL-03"}

DEVELOPMENT = {
    "project:leangenbukta": {
        "objectType": "project", "buildStatus": "unresolved", "availability": "unknown",
        "access": {"scope": "unresolved", "buildingIds": []},
        "mapAnchor": {"approximateArea": "Leangenbukta ved Haakon VIIs gate 14"},
    },
    "building:leangenbukta:knutepunktet-e": {
        "objectType": "building", "buildStatus": "unresolved", "availability": "expected",
        "timing": {"text": "siste kvartal 2026", "qualifier": "expected", "claimId": "lb-a-027"},
        "access": {"scope": "unresolved", "buildingIds": []},
        "mapAnchor": {"approximateArea": "Knutepunktet i Leangenbukta"},
    },
    "building:leangenbukta:parktunet-1-d": {
        "objectType": "building", "buildStatus": "planned", "availability": "expected",
        "buildStatusClaimId": "lb-b-056",
        "timing": {"text": "01.08.–01.12.2028 ved varslet byggestart 01.02.2027", "qualifier": "expected", "claimId": "lb-b-057"},
        "access": {"scope": "unresolved", "buildingIds": []},
        "mapAnchor": {"approximateArea": "Parktunet 1 i Leangenbukta"},
    },
    "building:leangenbukta:saltakshus-c": {
        "objectType": "building", "buildStatus": "under-construction", "availability": "expected",
        "buildStatusClaimId": "lb-b-041",
        "timing": {"text": "2027/2028", "qualifier": "expected", "claimId": "lb-b-042"},
        "access": {"scope": "unresolved", "buildingIds": []},
        "mapAnchor": {"approximateArea": "Saltakshus C i Leangenbukta"},
    },
    "building:leangenbukta:saltakshus-h": {
        "objectType": "building", "buildStatus": "existing", "availability": "open",
        "buildStatusClaimId": "lb-a-033", "availabilityClaimId": "lb-a-033",
        "access": {"scope": "unresolved", "buildingIds": []},
        "mapAnchor": {"approximateArea": "Saltakshus H i Leangenbukta"},
    },
    "plan:r20160019:o-bbh": {
        "objectType": "facility", "buildStatus": "adopted-plan", "availability": "not-open",
        "buildStatusClaimId": "lb-cor-007",
        "access": {"scope": "unresolved", "buildingIds": []},
        "mapAnchor": {"approximateArea": "Regulert felt o_BBH i planområdet"},
    },
    "plan:r20160019:o-gt": {
        "objectType": "outdoor-area", "buildStatus": "adopted-plan", "availability": "unknown",
        "buildStatusClaimId": "lb-cor-006",
        "access": {"scope": "public", "buildingIds": [], "claimId": "lb-f-053"},
        "mapAnchor": {"approximateArea": "Planområdets østkant"},
    },
    "facility:leangenbukta:lounge": {
        "objectType": "facility", "buildStatus": "planned", "availability": "unknown",
        "access": {"scope": "all-residents", "buildingIds": [], "claimId": "lb-d-078"},
        "mapAnchor": {"approximateArea": "Knutepunktet i Leangenbukta"},
    },
}


def read_json(path: Path):
    return json.loads(path.read_text())


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def stable(value: str) -> str:
    value = value.lower().replace("æ", "ae").replace("ø", "o").replace("å", "a")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value[:80]


def runtime_id(canonical_id: str) -> str:
    return stable(canonical_id.split(":", 1)[-1])


def source_id(url: str) -> str:
    host = urlparse(url).netloc.removeprefix("www.").split(".")[0]
    digest = hashlib.sha1(url.encode()).hexdigest()[:8]
    return stable(f"{host}-{digest}")


def source_meta(url: str, title: str | None = None) -> dict:
    parsed = urlparse(url)
    host = parsed.netloc.removeprefix("www.")
    publishers = {
        "trondheim.kommune.no": "Trondheim kommune", "citylade.no": "City Lade",
        "sirkusshopping.no": "Sirkus Shopping", "ladearena.no": "Lade Arena",
        "ladetorget.no": "LadeTorget", "banenor.no": "Bane NOR", "miljopakken.no": "Miljøpakken",
        "ringve.no": "Ringve Musikkmuseum", "ntnu.no": "NTNU Vitenskapsmuseet",
        "leangenbukta.no": "Leangenbukta", "finn.no": "FINN eiendom",
        "kotengjenssen.no": "Koteng Jenssen", "pir2.no": "PIR II",
        "leoslekeland.no": "Leo's Lekeland", "3t.no": "3T", "impulse.no": "Impulse",
        "trygglade.no": "SK Trygg/Lade", "kompisnorge.no": "Kompis",
        "digg.no": "DIGG", "ladekaia.no": "Ladekaia", "barnehagefakta.no": "Utdanningsdirektoratet",
        "leangenkulturbarnehage.no": "Leangen kulturbarnehage", "rockheim.no": "Rockheim",
        "luckybowl.no": "Lucky Bowl", "trondheimkino.no": "Trondheim Kino",
        "vitensenteret.com": "Vitensenteret", "vitensenteret.no": "Vitensenteret",
    }
    publisher = publishers.get(host, host)
    path = parsed.path.strip("/") or host
    page = title or path.replace("-", " ").replace("_", " ")
    return {
        "id": source_id(url), "label": publisher, "page": page[:160], "url": url,
        "publisher": publisher, "checkedAt": CHECKED_AT,
    }


category_packages = {name: read_json(RESEARCH / f"categories/{name}.json") for name in CATEGORY_FILES}
project_package = read_json(RESEARCH / "audited/2026-09-18-project-facts-package.json")
coordinate_receipt = read_json(RESEARCH / "place-coordinate-verification.json")
coordinate_by_candidate = {item["candidate_id"]: item for item in coordinate_receipt["candidates"]}
travel_receipt_path = RESEARCH / "travel-times.json"
travel_by_place = {}
if travel_receipt_path.exists():
    travel_receipt = read_json(travel_receipt_path)
    travel_by_place = {item["place_id"]: item["minutes"] for item in travel_receipt["places"]}

selected = []
all_candidates = []
for category, package in category_packages.items():
    for candidate in package["candidates"]:
        row = {**candidate, "category": category}
        all_candidates.append(row)
        if candidate["decision"] in {"start_set", "member"}:
            selected.append(row)

derived_ladetorget = {
    "candidate_id": "DERIVED-KS-04", "canonical_id": "place:ladetorget", "decision": "derived_anchor",
    "name": "LadeTorget", "category": "hverdag", "parent_canonical_id": None,
    "primary_source_urls": ["https://www.ladetorget.no/butikker"],
    "approved_facts": ["LadeTorget er et nærsenter i Østmarkveien 2 med dokumenterte virksomheter i senterets egen oversikt."],
    "refresh_required_before_publish": True,
}
selected.append(derived_ladetorget)

# One source registry for every runtime fact. Project titles have priority.
title_by_url = {}
for claim in project_package["claims"]:
    for url, title in zip(claim.get("source_urls", []), claim.get("source_titles", [])):
        title_by_url.setdefault(url, title)
runtime_urls = {url for candidate in selected for url in candidate.get("primary_source_urls", [])}
runtime_urls.update(
    url
    for claim in project_package["claims"]
    if claim.get("approved_copy") and claim["status"] in {"approved", "approved_time_sensitive"}
    for url in claim.get("source_urls", [])
)
for candidate in all_candidates:
    if candidate["decision"] in {"topic_only", "external_reference"} and candidate.get("approved_facts"):
        runtime_urls.update(candidate.get("primary_source_urls", []))
sources = [source_meta(url, title_by_url.get(url)) for url in sorted(runtime_urls)]
source_by_url = {source["url"]: source["id"] for source in sources}

# Resolve IDs first, including the structural anchor absent from the candidate table.
id_by_canonical = {candidate["canonical_id"]: runtime_id(candidate["canonical_id"]) for candidate in selected}
parent_coordinates: dict[str, dict] = {}


def coordinate_for(candidate: dict) -> dict:
    cid = candidate["candidate_id"]
    if cid in USE_PARENT_COORDINATES:
        parent = candidate.get("parent_canonical_id")
        if parent and parent in parent_coordinates:
            return parent_coordinates[parent]
    if cid in OFFICIAL_COORDINATES:
        return OFFICIAL_COORDINATES[cid]
    receipt = coordinate_by_candidate[cid]
    results = receipt["results"]
    if not results:
        raise RuntimeError(f"Ingen koordinatkontroll for {cid}")
    result = results[RESULT_INDEX.get(cid, 0)]
    location = result["location"]
    return {"lat": location["latitude"], "lng": location["longitude"]}


def address_for(candidate: dict) -> str | None:
    receipt = coordinate_by_candidate[candidate["candidate_id"]]
    results = receipt["results"]
    if not results:
        return None
    return results[RESULT_INDEX.get(candidate["candidate_id"], 0)].get("formattedAddress")


# Parents before children, then stable source order.
selected.sort(key=lambda item: (item["decision"] == "member", CATEGORY_FILES.index(item["category"]), item["candidate_id"]))
places = []
for candidate in selected:
    cid = candidate["candidate_id"]
    place_id = id_by_canonical[candidate["canonical_id"]]
    coordinates = coordinate_for(candidate)
    parent_coordinates[candidate["canonical_id"]] = coordinates
    parent_canonical = candidate.get("parent_canonical_id")
    parent_id = id_by_canonical.get(parent_canonical) if candidate["decision"] == "member" and parent_canonical else None
    urls = candidate.get("primary_source_urls", [])
    src_ids = [source_by_url[url] for url in urls]
    facts = []
    approved = candidate.get("approved_facts", [])
    summary = " ".join(approved)
    if cid == "DERIVED-KS-04":
        summary = candidate["approved_facts"][0]
    for index, text in enumerate(approved, 1):
        if src_ids:
            facts.append({"id": stable(f"fact-{cid}-{index}"), "text": text, "sourceId": src_ids[min(index - 1, len(src_ids) - 1)], "checkedAt": CHECKED_AT, "verification": "confirmed"})
    caveats = []
    official = cid in OFFICIAL_COORDINATES
    documented_entry = coordinate_by_candidate[cid].get("entrance_status") == "documented"
    if not official:
        caveats.append("Kartpunktet viser stedet eller adressen; selve publikumsinngangen er ikke bekreftet.")
    if candidate.get("refresh_required_before_publish"):
        caveats.append("Åpningstid, program eller virksomhetsstatus er tidsfølsomt og bør kontrolleres før besøk.")
    if cid == "TRN-13":
        caveats.append("Kartpunktet viser stasjonsområdet. Trinnfri rute og trappeadkomst følger ikke samme vei.")
    if cid == "OPP-01":
        caveats.append("Skolekrets for Haakon VIIs gate 14 er ikke verifisert.")
    if cid in {"OPP-03", "OPP-05"}:
        caveats.append("Plassering gir ikke rett til barnehageplass.")
    if cid == "SRV-01":
        caveats.append("Ladekaia er sesongstyrt; kontroller åpningstid før besøk.")
    place = {
        "id": place_id, "name": candidate["name"], "categoryId": candidate["category"],
        "coordinates": coordinates, "status": "existing", "summary": summary,
        "locationPrecision": "sourced" if official else "approximate",
        "facts": facts, "sourceIds": src_ids, "checkedAt": CHECKED_AT, "caveats": caveats,
    }
    address = address_for(candidate)
    if address:
        place["address"] = address
    if parent_id:
        place["parentPlaceId"] = parent_id
        place["poiCategoryId"] = "butikk" if candidate["category"] in {"hverdag", "servering"} else stable(PLACE_TYPE.get(cid, candidate["category"]))
    if cid in PLACE_TYPE:
        place["placeType"] = PLACE_TYPE[cid]
    if not official:
        place["locationNote"] = caveats[0]
    if place_id in travel_by_place and not parent_id:
        place["travelTime"] = travel_by_place[place_id]
    places.append(place)

# Every parent becomes an explicit anchor after all children are known.
child_count = defaultdict(int)
for place in places:
    if place.get("parentPlaceId"):
        child_count[place["parentPlaceId"]] += 1
for place in places:
    if child_count[place["id"]]:
        place["anchorSummary"] = f"{child_count[place['id']]} dokumenterte tilbud er samlet under dette ankeret."
        if place["id"] not in {"city-lade", "sirkus-shopping", "lade-arena"}:
            place["anchorKeepsOwnName"] = True

# Approved project claims, grouped by audited entity. Nothing unresolved or rejected enters runtime.
entity_by_id = {entity["canonical_id"]: entity for entity in project_package["entities"]}
approved_by_entity = defaultdict(list)
for claim in project_package["claims"]:
    if claim.get("approved_copy") and claim["status"] in {"approved", "approved_time_sensitive"}:
        approved_by_entity[claim["canonical_id"]].append(claim)

topics = []
for canonical_id in sorted(approved_by_entity):
    claims = approved_by_entity[canonical_id]
    entity = entity_by_id.get(canonical_id, {"name": canonical_id})
    # The plan has 41 claims; split to respect the schema's 40-claim ceiling.
    chunks = [claims[index:index + 35] for index in range(0, len(claims), 35)]
    for chunk_index, chunk in enumerate(chunks, 1):
        suffix = f"-{chunk_index}" if len(chunks) > 1 else ""
        topic_id = stable(f"project-{runtime_id(canonical_id)}{suffix}")
        title = entity["name"] + (f" – del {chunk_index}" if len(chunks) > 1 else "")
        text = " ".join(claim["approved_copy"].rstrip(".") + "." for claim in chunk)
        src_ids = sorted({source_by_url[url] for claim in chunk for url in claim.get("source_urls", [])})
        time_sensitive = any(claim["status"] == "approved_time_sensitive" for claim in chunk)
        topic = {
            "id": topic_id, "title": title, "categoryIds": ["leangenbukta-prosjektet"],
            "status": "adopted-plan" if canonical_id.startswith("plan:r20160019") else ("existing" if canonical_id == "project:leangenbukta" else "unresolved"),
            "text": text, "keywords": sorted({word for word in stable(title).split("-") if len(word) > 2})[:40],
            "sourceIds": src_ids, "relatedPlaceIds": [], "checkedAt": CHECKED_AT,
            "caveats": (["Opplysningene er tidsfølsomme og må kontrolleres på nytt ved senere publisering."] if time_sensitive else []),
        }
        if chunk_index == 1 and canonical_id in DEVELOPMENT:
            template = json.loads(json.dumps(DEVELOPMENT[canonical_id]))
            dev_claims = []
            for claim in chunk:
                urls = claim.get("source_urls", [])
                if not urls:
                    continue
                dev_claims.append({
                    "id": stable(claim["claim_id"]), "text": claim["approved_copy"],
                    "sourceId": source_by_url[urls[0]], "checkedAt": CHECKED_AT,
                    "verification": "confirmed",
                })
            template["claims"] = dev_claims
            template.setdefault("moveInLinks", [])
            template.setdefault("conflicts", [])
            topic["development"] = template
        topics.append(topic)

# Knowledge gaps remain searchable, but are never presented as confirmed facts.
topics.append({
    "id": "project-knowledge-gaps", "title": "Dette er fortsatt uavklart",
    "categoryIds": ["leangenbukta-prosjektet"], "status": "unresolved",
    "text": " ".join(item["question"] for item in project_package["unresolved_questions"]),
    "keywords": ["uavklart", "ferdigstilt", "fellesfasiliteter", "adgang", "barnehage", "byggestart"],
    "sourceIds": [], "relatedPlaceIds": [], "checkedAt": CHECKED_AT,
    "caveats": ["Dette er spørsmål revisjonen ikke fant tilstrekkelig dokumentasjon til å besvare."],
})

# Reusable and external category knowledge with approved facts but no map marker.
seen_topic_canonicals = set()
for candidate in all_candidates:
    if candidate["decision"] not in {"topic_only", "external_reference"} or not candidate.get("approved_facts"):
        continue
    canonical = candidate["canonical_id"]
    key = (canonical, candidate["category"])
    if key in seen_topic_canonicals:
        continue
    seen_topic_canonicals.add(key)
    urls = candidate.get("primary_source_urls", [])
    topics.append({
        "id": stable(f"category-{candidate['category']}-{runtime_id(canonical)}"),
        "title": candidate["name"], "categoryIds": [candidate["category"]],
        "status": "planned" if canonical.startswith("topic:pirbrua") else "existing",
        "text": " ".join(candidate["approved_facts"]),
        "keywords": sorted({word for word in stable(candidate["name"]).split("-") if len(word) > 2})[:40],
        "sourceIds": [source_by_url[url] for url in urls], "relatedPlaceIds": [],
        "checkedAt": CHECKED_AT,
        "caveats": (["Dette tilbudet ligger utenfor Lade/Leangen og vises som referanse, ikke som kartpunkt."] if candidate["decision"] == "external_reference" else []),
    })

# Project FAQs use only approved facts and explicit audit gaps.
def src(*urls: str) -> list[str]:
    return [source_by_url[url] for url in urls]

plan_page = "https://www.trondheim.kommune.no/haakon-viis-gate-14-r20160019/"
plan_rules = "https://www.trondheim.kommune.no/globalassets/10-bilder-og-filer/10-byutvikling/byplankontoret/1c_vedtatt-plan/2019/haakon-viis-gate-14.-r20160019/reguleringsbestemmelser.pdf"
project_page = "https://leangenbukta.no/om-prosjektet/"
knutepunktet_page = "https://www.finn.no/realestate/project/ad.html?finnkode=393294324"
parktunet_page = "https://www.finn.no/realestate/project/ad.html?finnkode=459052231"

faqs = [
    {"id": "project-status", "categoryId": "leangenbukta-prosjektet", "question": "Hvor stort er Leangenbukta, og hvor mye er ferdig?", "answer": "Reguleringsplanen krever minst 450 boliger, mens utbygger omtaler prosjektet som rundt 500 boliger. FINN-materialet oppga rundt 260 overleverte boliger sommeren 2026. Det er ikke et prosentmål for ferdigstillelse, og status må oppfriskes senere.", "origin": "local", "sourceIds": src(plan_rules, project_page, parktunet_page), "caveats": ["Antall overleverte boliger er tidsfølsomt og kontrollert 18.09.2026."]},
    {"id": "project-plan", "categoryId": "leangenbukta-prosjektet", "question": "Hva er vedtatt i reguleringsplanen?", "answer": "Plan r20160019 ble vedtatt av Trondheim bystyre 31.01.2019. Den regulerer boligfelt B1–B5, offentlig barnehage, felles uteoppholdsareal, offentlig turveg og friområde, og åpner for inntil 3 000 m² kontor eller tjenesteyting i deler av første og andre etasje langs Lade allé.", "origin": "local", "sourceIds": src(plan_page, plan_rules), "caveats": []},
    {"id": "project-knutepunktet", "categoryId": "leangenbukta-prosjektet", "question": "Når er Knutepunktet ventet klart?", "answer": "Utbyggers salgsoppgave oppgir 28 selveierleiligheter og forventet innflytting i siste kvartal 2026, med en mer presis opplysning om oktober–november. Dette er forventet innflytting, ikke dokumentasjon på at alle fellesfasiliteter er åpnet.", "origin": "local", "sourceIds": src(knutepunktet_page), "caveats": ["Ferdigstillelse og åpning av hver fasilitet er ikke bekreftet."]},
    {"id": "project-parktunet", "categoryId": "leangenbukta-prosjektet", "question": "Når er Parktunet 1 ventet ferdig?", "answer": "FINN-annonsen brukte varslet byggestart 1. februar 2027 som forutsetning og oppga antatt ferdigstillelse mellom 1. august og 1. desember 2028. Det er et betinget estimat, ikke en bekreftet ferdigdato.", "origin": "local", "sourceIds": src(parktunet_page), "caveats": ["Tidspunktet er uttrykkelig avhengig av varslet byggestart."]},
    {"id": "project-kindergarten", "categoryId": "leangenbukta-prosjektet", "question": "Er barnehagen i prosjektet vedtatt bygget?", "answer": "Planen avsetter felt o_BBH til offentlig barnehage med inntil 1 700 m² BRA. Revisjonen fant ikke tilstrekkelig dokumentasjon på byggebeslutning, byggestart eller åpningsdato, så barnehagen behandles som regulert og uavklart.", "origin": "local", "sourceIds": src(plan_rules), "caveats": ["Regulert areal er ikke det samme som vedtatt bygging."]},
    {"id": "project-facilities", "categoryId": "leangenbukta-prosjektet", "question": "Er lounge, treningsrom og andre fellesfasiliteter åpne?", "answer": "Salgsoppgavene beskriver lounge og planlagte fellesfasiliteter, og lounge er omtalt for alle beboere. Det er ikke dokumentert at hver fasilitet er ferdigstilt eller åpnet. De presenteres derfor som planlagte eller uavklarte beboerfasiliteter, ikke som offentlige tilbud.", "origin": "local", "sourceIds": src(knutepunktet_page), "caveats": ["Adgang og åpning må bekreftes per fasilitet."]},
]

# The four factual buyer scenarios become FAQ. Interruption/resume stays only in
# conversations.json: it tests dialogue behaviour and is not area knowledge.
for category, package in category_packages.items():
    category_source_ids = sorted({source_by_url[url] for candidate in package["candidates"] if candidate["decision"] in {"start_set", "member", "topic_only", "external_reference"} for url in candidate.get("primary_source_urls", []) if url in source_by_url})[:20]
    for index, question in enumerate(package["buyer_questions"], 1):
        if question["scenario"] == "interruption_resume":
            continue
        faqs.append({
            "id": stable(f"{category}-{question['scenario']}-{index}"), "categoryId": category,
            "question": question["question"], "answer": question["approved_answer"],
            "origin": "local", "sourceIds": category_source_ids,
            "caveats": (["Svaret beskriver et dokumentert kunnskapshull."] if question["scenario"] == "unknown" else []),
        })

conversations = []
for category, package in category_packages.items():
    conversations.append({
        "id": stable(f"review-{category}"), "recordedAt": CHECKED_AT,
        "topic": f"Kontrollerte kjøperspørsmål – {category}",
        "notes": "Fem innholdsscenarier fra den reviderte kategoripakken. De er testgrunnlag og lastes ikke inn som fakta.",
        "transcript": [],
        "questions": [
            {"id": stable(f"{category}-{item['scenario']}"), "text": item["question"], "expectation": item["approved_answer"]}
            for item in package["buyer_questions"]
        ],
    })

top_level_by_category = defaultdict(list)
source_ids_by_category = defaultdict(set)
for place in places:
    if not place.get("parentPlaceId") and place["id"] != "ladetorget":
        top_level_by_category[place["categoryId"]].append(place["id"])
    source_ids_by_category[place["categoryId"]].update(place["sourceIds"])

presentation = []
for category in CATEGORY_FILES:
    broad = category_packages[category]["buyer_questions"][0]
    source_ids = sorted(source_ids_by_category[category])
    if not source_ids:
        continue
    presentation.append({
        "id": stable(f"intro-{category}"), "categoryId": category,
        "text": broad["approved_answer"], "placeIds": top_level_by_category[category][:6],
        "sourceIds": source_ids[:20], "checkedAt": CHECKED_AT,
    })
presentation.insert(0, {
    "id": "intro-leangenbukta-prosjektet", "categoryId": "leangenbukta-prosjektet",
    "text": "Leangenbukta er et boligprosjekt under utvikling. Reguleringsplanen, faktisk byggestatus, forventede tidspunkt og adgang til fellesfasiliteter er holdt som separate opplysninger.",
    "placeIds": [], "sourceIds": src(plan_page, project_page), "checkedAt": CHECKED_AT,
})

board = read_json(DATA / "board.json")
board["address"] = "Haakon VIIs gate 14, 7041 Trondheim"
board["intro"] = "Utforsk Leangenbukta som boligprosjekt og det kildekontrollerte utvalget på Lade og Leangen. Kartpunkter, prosjektstatus og åpningstider viser kontrolldato og forbehold der noe kan endre seg."
board["greeting"] = "Hei, jeg heter Anja og er din digitale guide i Leangenbukta. Jeg kan fortelle om boligprosjektet eller om dokumenterte tilbud på Lade og Leangen. Hva vil du utforske først?"
board["voice"]["scope"] = "Leangenbukta som boligprosjekt er rammen, sammen med Lade og Leangen. Skill vedtatt plan, faktisk byggestatus, forventet tidspunkt, innflytting og adgang. Bruk bare datasettets bekreftede fakta, og si tydelig når noe er uavklart eller tidsfølsomt."
board["voice"]["afterGreeting"] = "La brukeren velge boligprosjektet eller tilbudene som finnes i dag. Ved prosjektet, tilby plan, byggetrinn eller fellesfasiliteter."
board["voice"]["backendSections"] = [
    "PROSJEKTSTATUS: Vedtatt plan, byggestatus, forventet tidspunkt, innflytting og adgang er forskjellige opplysninger. En passert forventning gjør ikke et tilbud åpnet. En beboerfasilitet er ikke offentlig.",
    "KARTPRESISJON: Et omtrent markert sted viser adressen eller anlegget, ikke en dokumentert publikumsinngang. Ikke beskriv en rute som kontrollert eller trygg uten eget grunnlag.",
    "PLASS OG OPPTAK: Plassering gir ikke rett til skole- eller barnehageplass. Skolekretsen for Haakon VIIs gate 14 er ikke verifisert.",
]
board["voice"]["roleSentences"] = [
    "Si kontrolldato eller forbehold når åpningstid, program, byggefremdrift eller adgang kan ha endret seg.",
    "Ikke ranger steder og ikke kall et sted nærmest uten en kontrollert sammenlikning.",
]
board["presentation"] = presentation
for category in board["categories"]:
    category.update(CATEGORY_COPY[category["id"]])

write_json(DATA / "board.json", board)
write_json(DATA / "sources.json", sources)
# Researchbyggeren eier bare det reviderte laget. Det brede kartregisteret
# bygges separat av `scripts/demo/import-local-register.ts`, så regenerering av
# research kan verken slette registeret eller oppgradere registerdata til fakta.
write_json(DATA / "places-audited.json", places)
write_json(DATA / "topics.json", topics)
write_json(DATA / "faq.json", faqs)
write_json(DATA / "conversations.json", conversations)

decision_counts = defaultdict(int)
for candidate in all_candidates:
    decision_counts[candidate["decision"]] += 1
report = {
    "schema_version": 1, "built_at": CHECKED_AT,
    "inputs": {
        "reviewed_candidates": len(all_candidates),
        "project_claims": len(project_package["claims"]),
        "coordinate_checks": len(coordinate_receipt["candidates"]),
        "travel_time_receipt": travel_receipt_path.exists(),
    },
    "candidate_decisions": dict(sorted(decision_counts.items())),
    "runtime": {
        "sources": len(sources), "audited_places": len(places), "register_layer_written": False,
        "curated_start_places": sum(1 for item in selected if item["decision"] == "start_set"),
        "structural_anchors": 1, "members": sum(1 for item in selected if item["decision"] == "member"),
        "topics": len(topics), "faqs": len(faqs), "conversation_questions": sum(len(item["questions"]) for item in conversations),
        "approved_project_claims_in_topics": sum(len(items) for items in approved_by_entity.values()),
    },
    "guards": {
        "raw_report_fields_imported": False,
        "unresolved_or_rejected_project_claims_imported": False,
        "conversations_used_as_runtime_knowledge": False,
        "derived_anchor": "LadeTorget is added only to host three reviewed members whose parent canonical ID was otherwise absent.",
    },
}
write_json(RESEARCH / "runtime-import-report.json", report)
print(json.dumps(report["runtime"], ensure_ascii=False, indent=2))
