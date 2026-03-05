"""Parcel locator: resolve Israeli gush/chelka to WGS84 coordinates.

Tries address-based Nominatim geocoding first (most reliable when address
is available from tabu data), with GovMap TldSearch as a secondary attempt
for cases where no address is provided.
"""
import logging
import math

import httpx

logger = logging.getLogger(__name__)

GOVMAP_TLD_URL = "https://es.govmap.gov.il/TldSearch/api/DetailsByQuery"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


def _itm_to_wgs84(x: float, y: float) -> tuple[float, float]:
    """Convert Israeli Transverse Mercator (ITM) to WGS84 (lat, lon).

    Approximate formula accurate to ~10m in central Israel.
    """
    lat = 31.0 + (y - 550000) / 111000.0
    lng = 34.0 + (x - 100000) / (111000.0 * math.cos(math.radians(32)))
    return lat, lng


async def _nominatim_query(client: httpx.AsyncClient, query: str) -> dict | None:
    """Run a single Nominatim geocoding query."""
    resp = await client.get(
        NOMINATIM_URL,
        params={"q": query, "format": "json", "limit": "1", "countrycodes": "il"},
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
            }
    return None


async def _try_nominatim_address(address: str, city: str | None) -> dict | None:
    """Geocode using the street address from the tabu document."""
    query = address
    if city and city not in address:
        query = f"{address}, {city}"
    if "ישראל" not in query and "Israel" not in query:
        query = f"{query}, Israel"

    async with httpx.AsyncClient(timeout=10) as client:
        result = await _nominatim_query(client, query)
        if result:
            result["method"] = "nominatim_address"
            return result
    return None


async def _try_nominatim_city(city: str) -> dict | None:
    """Fallback: geocode just the city name."""
    query = city if ("Israel" in city or "ישראל" in city) else f"{city}, Israel"
    async with httpx.AsyncClient(timeout=10) as client:
        result = await _nominatim_query(client, query)
        if result:
            result["method"] = "nominatim_city"
            return result
    return None


async def _try_govmap_tld(gush: str, chelka: str) -> dict | None:
    """Try GovMap TldSearch API for parcel coordinates (cadastral layer)."""
    queries = [f"{gush}/{chelka}", f"גוש {gush} חלקה {chelka}"]

    async with httpx.AsyncClient(timeout=5) as client:
        for query in queries:
            try:
                resp = await client.get(
                    GOVMAP_TLD_URL,
                    params={"query": query, "lyrs": "27", "gid": "govmap"},
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
                                    "display_name": item.get(
                                        "ResultLable", f"גוש {gush} חלקה {chelka}"
                                    ),
                                    "source": "govmap",
                                    "method": "govmap_tld",
                                }
            except Exception:
                pass
    return None


async def locate_parcel(
    gush: str,
    chelka: str,
    address: str | None = None,
    city: str | None = None,
) -> dict | None:
    """Locate an Israeli parcel by gush/chelka.

    Priority order:
    1. Nominatim with street address (most accurate when available)
    2. GovMap TldSearch cadastral lookup (no address needed)
    3. Nominatim with city only (rough fallback)

    Returns dict with center, display_name, source, method — or None.
    """
    # 1. Best: use the actual street address from tabu data
    if address:
        try:
            result = await _try_nominatim_address(address, city)
            if result:
                logger.info("Parcel %s/%s located via nominatim_address", gush, chelka)
                return result
        except Exception as e:
            logger.warning("Nominatim address geocoding failed: %s", e)

    # 2. Try GovMap cadastral lookup (works without address)
    try:
        result = await _try_govmap_tld(gush, chelka)
        if result:
            logger.info("Parcel %s/%s located via govmap_tld", gush, chelka)
            return result
    except Exception as e:
        logger.warning("GovMap TLD lookup failed: %s", e)

    # 3. Fallback: geocode city name only
    if city:
        try:
            result = await _try_nominatim_city(city)
            if result:
                logger.info("Parcel %s/%s located via nominatim_city (fallback)", gush, chelka)
                return result
        except Exception as e:
            logger.warning("Nominatim city geocoding failed: %s", e)

    return None
