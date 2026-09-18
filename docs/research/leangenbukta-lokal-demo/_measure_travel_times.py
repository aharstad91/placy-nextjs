#!/usr/bin/env python3
"""Measure travel minutes from Leangenbukta to every visible map anchor.

The receipt contains no token. Mapbox Matrix accepts at most 25 coordinates,
so each request contains one origin and at most 24 destinations.
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[3]
RESEARCH = ROOT / "docs/research/leangenbukta-lokal-demo"
DATA = ROOT / "data/demo/leangenbukta-lokal"
CHECKED_AT = "2026-09-18"
PROFILE_KEYS = {"walking": "walk", "cycling": "bike", "driving": "car"}


def read_json(path: Path):
    return json.loads(path.read_text())


def env_value(key: str) -> str | None:
    if os.environ.get(key):
        return os.environ[key]
    env_path = ROOT / ".env.local"
    if not env_path.exists():
        return None
    for raw in env_path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name.removeprefix("export ").strip() == key:
            return value.strip().strip("'\"")
    return None


def chunks(items: list[dict], size: int):
    for index in range(0, len(items), size):
        yield items[index:index + size]


def matrix(token: str, profile: str, origin: dict, destinations: list[dict]) -> list[float | None]:
    coordinates = [origin, *[item["coordinates"] for item in destinations]]
    coordinate_path = ";".join(f"{point['lng']},{point['lat']}" for point in coordinates)
    destination_indexes = ";".join(str(index) for index in range(1, len(coordinates)))
    query = urlencode({
        "access_token": token,
        "sources": "0",
        "destinations": destination_indexes,
        "annotations": "duration",
    })
    url = f"https://api.mapbox.com/directions-matrix/v1/mapbox/{profile}/{coordinate_path}?{query}"
    with urlopen(url, timeout=20) as response:  # noqa: S310 -- fixed Mapbox host
        payload = json.load(response)
    if payload.get("code") != "Ok":
        raise RuntimeError(f"Mapbox returned {payload.get('code', 'unknown')}")
    durations = payload.get("durations", [[]])[0]
    if len(durations) != len(destinations):
        raise RuntimeError(f"Mapbox returned {len(durations)} durations for {len(destinations)} destinations")
    return durations


def main() -> None:
    token = env_value("NEXT_PUBLIC_MAPBOX_TOKEN")
    if not token:
        raise RuntimeError("NEXT_PUBLIC_MAPBOX_TOKEN is not configured")

    board = read_json(DATA / "board.json")
    audited_places = read_json(DATA / "places-audited.json")
    places = [place for place in audited_places if not place.get("parentPlaceId")]
    measured = {
        place["id"]: {
            "place_id": place["id"],
            "name": place["name"],
            "coordinates": place["coordinates"],
            "minutes": {},
            "duration_seconds": {},
        }
        for place in places
    }

    for profile, key in PROFILE_KEYS.items():
        for batch in chunks(places, 24):
            durations = matrix(token, profile, board["center"], batch)
            for place, seconds in zip(batch, durations, strict=True):
                if seconds is None:
                    continue
                measured[place["id"]]["duration_seconds"][key] = round(seconds, 1)
                measured[place["id"]]["minutes"][key] = math.ceil(seconds / 60)

    incomplete = [item["place_id"] for item in measured.values() if set(item["minutes"]) != set(PROFILE_KEYS.values())]
    if incomplete:
        raise RuntimeError(f"Missing travel modes for: {', '.join(incomplete)}")

    receipt = {
        "schema_version": 1,
        "purpose": "Measured route minutes for visible Leangenbukta local-board anchors.",
        "checked_at": CHECKED_AT,
        "provider": "Mapbox Matrix API",
        "origin": {"name": board["name"], "coordinates": board["center"]},
        "rounding": "Duration seconds rounded up to whole minutes.",
        "places": list(measured.values()),
    }
    (RESEARCH / "travel-times.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"places": len(places), "profiles": list(PROFILE_KEYS), "requests": len(list(chunks(places, 24))) * len(PROFILE_KEYS)}))


if __name__ == "__main__":
    main()
