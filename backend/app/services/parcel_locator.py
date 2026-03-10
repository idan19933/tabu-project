"""Parcel locator: resolve Israeli gush/chelka to WGS84 coordinates.

Primary method: GovMap Open WFS (free, public, returns exact parcel polygons).
Fallback: Nominatim address-based geocoding.
"""
import asyncio
import logging

import httpx

logger = logging.getLogger(__name__)

GOVMAP_WFS_URL = "https://open.govmap.gov.il/geoserver/opendata/wfs"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


async def _govmap_wfs_single(gush: str, chelka: str) -> dict | None:
    """Single GovMap WFS request. Returns parsed result or None."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            GOVMAP_WFS_URL,
            params={
                "service": "WFS",
                "version": "1.1.0",
                "request": "GetFeature",
                "typeName": "opendata:PARCEL_ALL",
                "outputFormat": "application/json",
                "CQL_FILTER": f"GUSH_NUM={gush} AND PARCEL={chelka}",
                "srsName": "EPSG:4326",
                "maxFeatures": "1",
            },
        )
        if resp.status_code != 200:
            return None

        data = resp.json()
        features = data.get("features", [])
        if not features:
            return None

        feature = features[0]
        geom = feature.get("geometry", {})
        props = feature.get("properties", {})

        coords = geom.get("coordinates", [])
        if not coords:
            return None

        # MultiPolygon → first polygon → exterior ring
        ring = coords[0][0] if geom.get("type") == "MultiPolygon" else coords[0]

        # WFS with srsName=EPSG:4326 returns [lon, lat] order
        lons = [p[0] for p in ring]
        lats = [p[1] for p in ring]
        center_lat = sum(lats) / len(lats)
        center_lon = sum(lons) / len(lons)

        locality = props.get("LOCALITY_N", "")
        display = f"גוש {gush} חלקה {chelka}"
        if locality:
            display = f"{display}, {locality}"

        return {
            "center": [center_lat, center_lon],
            "display_name": display,
            "source": "govmap_wfs",
            "method": "govmap_wfs",
        }


async def _try_govmap_wfs(gush: str, chelka: str, max_retries: int = 3) -> dict | None:
    """Query GovMap WFS with retry + backoff. GovMap is intermittent."""
    for attempt in range(max_retries):
        try:
            result = await _govmap_wfs_single(gush, chelka)
            if result:
                logger.info("GovMap WFS success on attempt %d for %s/%s", attempt + 1, gush, chelka)
                return result
        except Exception as e:
            wait = (attempt + 1) * 1.5
            logger.warning(
                "GovMap WFS attempt %d/%d failed for %s/%s: %s. Retrying in %.1fs...",
                attempt + 1, max_retries, gush, chelka, e, wait,
            )
            if attempt < max_retries - 1:
                await asyncio.sleep(wait)

    logger.error("GovMap WFS failed all %d attempts for %s/%s", max_retries, gush, chelka)
    return None


async def _try_nominatim(address: str, city: str | None) -> dict | None:
    """Geocode using Nominatim (OpenStreetMap)."""
    query = address
    if city and city not in address:
        query = f"{address}, {city}"
    if "ישראל" not in query and "Israel" not in query:
        query = f"{query}, Israel"

    async with httpx.AsyncClient(timeout=10) as client:
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
                    "method": "nominatim_address",
                }
    return None


async def locate_parcel(
    gush: str,
    chelka: str,
    address: str | None = None,
    city: str | None = None,
) -> dict | None:
    """Locate an Israeli parcel by gush/chelka.

    Priority:
    1. GovMap Open WFS — exact parcel polygon centroid (3 retries)
    2. Nominatim address geocoding — fallback when WFS unavailable
    3. Nominatim city geocoding — last resort
    """
    # 1. GovMap WFS with retry
    try:
        result = await _try_govmap_wfs(gush, chelka)
        if result:
            return result
    except Exception as e:
        logger.warning("GovMap WFS lookup failed: %s", e)

    # 2. Nominatim with address
    if address:
        try:
            result = await _try_nominatim(address, city)
            if result:
                logger.info("Parcel %s/%s located via nominatim_address", gush, chelka)
                return result
        except Exception as e:
            logger.warning("Nominatim address geocoding failed: %s", e)

    # 3. Nominatim with city only (low confidence)
    if city:
        try:
            q = city if ("Israel" in city or "ישראל" in city) else f"{city}, Israel"
            result = await _try_nominatim(q, None)
            if result:
                result["method"] = "nominatim_city"
                logger.info("Parcel %s/%s located via nominatim_city (low confidence)", gush, chelka)
                return result
        except Exception as e:
            logger.warning("Nominatim city geocoding failed: %s", e)

    return None
