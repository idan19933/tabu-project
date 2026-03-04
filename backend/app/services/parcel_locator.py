"""Parcel locator: resolve Israeli gush/chelka to WGS84 coordinates.

Tries GovMap cadastral APIs first (which understand parcel IDs natively),
falls back to Nominatim address-based geocoding.
"""
import logging
import math

import httpx

logger = logging.getLogger(__name__)

GOVMAP_TLD_URL = "https://es.govmap.gov.il/TldSearch/api/DetailsByQuery"
GOVMAP_LOCATE_URL = "https://ags.govmap.gov.il/Api/Controllers/GovmapApi/Locate"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

_TIMEOUT = 10


def _itm_to_wgs84(x: float, y: float) -> tuple[float, float]:
    """Convert Israeli Transverse Mercator (ITM) to WGS84 (lat, lon).

    Approximate formula accurate to ~10m in central Israel.
    Good enough for map centering purposes.
    """
    lat = 31.0 + (y - 550000) / 111000.0
    lng = 34.0 + (x - 100000) / (111000.0 * math.cos(math.radians(32)))
    return lat, lng


async def _try_govmap_tld(gush: str, chelka: str) -> dict | None:
    """Method 1: GovMap TldSearch with numeric query (gush/chelka)."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(
            GOVMAP_TLD_URL,
            params={"query": f"{gush}/{chelka}", "lyrs": "27", "gid": "govmap"},
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, dict) and data.get("data"):
                items = data["data"]
                if isinstance(items, list) and len(items) > 0:
                    item = items[0]
                    x = item.get("X") or item.get("x")
                    y = item.get("Y") or item.get("y")
                    if x and y:
                        lat, lon = _itm_to_wgs84(float(x), float(y))
                        return {
                            "center": [lat, lon],
                            "display_name": item.get("ResultLable", f"גוש {gush} חלקה {chelka}"),
                            "source": "govmap",
                            "method": "govmap_tld",
                        }
    return None


async def _try_govmap_tld_hebrew(gush: str, chelka: str) -> dict | None:
    """Method 2: GovMap TldSearch with Hebrew query."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(
            GOVMAP_TLD_URL,
            params={
                "query": f"גוש {gush} חלקה {chelka}",
                "lyrs": "27",
                "gid": "govmap",
            },
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, dict) and data.get("data"):
                items = data["data"]
                if isinstance(items, list) and len(items) > 0:
                    item = items[0]
                    x = item.get("X") or item.get("x")
                    y = item.get("Y") or item.get("y")
                    if x and y:
                        lat, lon = _itm_to_wgs84(float(x), float(y))
                        return {
                            "center": [lat, lon],
                            "display_name": item.get("ResultLable", f"גוש {gush} חלקה {chelka}"),
                            "source": "govmap",
                            "method": "govmap_tld_hebrew",
                        }
    return None


async def _try_govmap_locate(gush: str, chelka: str) -> dict | None:
    """Method 3: GovMap Locate API (Type=5 for parcel lookup)."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            GOVMAP_LOCATE_URL,
            json={
                "Type": 5,
                "Ession": "",
                "Gush": gush,
                "Parcel": chelka,
            },
            headers={
                "Content-Type": "application/json",
                "Origin": "https://www.govmap.gov.il",
                "Referer": "https://www.govmap.gov.il/",
            },
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, dict) and data.get("data"):
                result = data["data"]
                x = result.get("X") or result.get("x")
                y = result.get("Y") or result.get("y")
                if x and y:
                    lat, lon = _itm_to_wgs84(float(x), float(y))
                    return {
                        "center": [lat, lon],
                        "display_name": f"גוש {gush} חלקה {chelka}",
                        "source": "govmap",
                        "method": "govmap_locate",
                    }
    return None


async def _try_nominatim(
    address: str | None, city: str | None, gush: str, chelka: str
) -> dict | None:
    """Method 4: Nominatim address-based geocoding (fallback)."""
    queries = []

    if address:
        q = address
        if city and city not in address:
            q = f"{address}, {city}"
        if "ישראל" not in q and "Israel" not in q:
            q = f"{q}, Israel"
        queries.append(q)

    if city:
        city_q = city if "Israel" in city or "ישראל" in city else f"{city}, Israel"
        if city_q not in queries:
            queries.append(city_q)

    # Last resort: Hebrew gush/chelka terms
    fallback = f"גוש {gush} חלקה {chelka}"
    if city:
        fallback = f"{fallback}, {city}"
    fallback = f"{fallback}, Israel"
    queries.append(fallback)

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        for query in queries:
            try:
                resp = await client.get(
                    NOMINATIM_URL,
                    params={
                        "q": query,
                        "format": "json",
                        "limit": "1",
                        "countrycodes": "il",
                    },
                    headers={"User-Agent": "TabuApp/2.0 (feasibility-analysis)"},
                )
                if resp.status_code == 200:
                    results = resp.json()
                    if results and len(results) > 0:
                        item = results[0]
                        return {
                            "center": [float(item["lat"]), float(item["lon"])],
                            "display_name": item.get("display_name", ""),
                            "source": "nominatim",
                            "method": "nominatim",
                        }
            except Exception as e:
                logger.warning("Nominatim query '%s' failed: %s", query, e)

    return None


async def locate_parcel(
    gush: str,
    chelka: str,
    address: str | None = None,
    city: str | None = None,
) -> dict | None:
    """Locate an Israeli parcel by gush/chelka.

    Tries methods in order:
    1. GovMap TldSearch (numeric query)
    2. GovMap TldSearch (Hebrew query)
    3. GovMap Locate API
    4. Nominatim address-based fallback

    Returns dict with center, display_name, source, method — or None.
    """
    methods = [
        ("govmap_tld", lambda: _try_govmap_tld(gush, chelka)),
        ("govmap_tld_hebrew", lambda: _try_govmap_tld_hebrew(gush, chelka)),
        ("govmap_locate", lambda: _try_govmap_locate(gush, chelka)),
        ("nominatim", lambda: _try_nominatim(address, city, gush, chelka)),
    ]

    for name, method in methods:
        try:
            result = await method()
            if result:
                logger.info("Parcel %s/%s located via %s", gush, chelka, name)
                return result
        except Exception as e:
            logger.warning("Parcel locator method '%s' failed: %s", name, e)

    return None
