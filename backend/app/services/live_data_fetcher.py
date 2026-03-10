"""Live data fetcher — pulls real data from Israeli government APIs.

Fetches verified data to anchor Claude's web search analysis:
- CBS (Central Bureau of Statistics): Construction cost index
- Nominatim/OSM: Geocoding (address → lat/lon)
- nadlan.gov.il: Recent real estate transactions (best-effort, may fail)

Each function returns a dict or None on failure — never crashes the pipeline.
"""
import asyncio
import logging
from datetime import datetime

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CBS_PRICE_INDEX_URL = "https://api.cbs.gov.il/index/data/price"
CBS_SERIES_CONSTRUCTION_COST = "200010"

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

NADLAN_API_URL = "https://www.nadlan.gov.il/Nadlan.REST/Main/GetAssestAndDeals"

REQUEST_TIMEOUT = 10  # seconds


# ---------------------------------------------------------------------------
# CBS Construction Cost Index
# ---------------------------------------------------------------------------

async def fetch_cbs_construction_cost_index() -> dict | None:
    """Fetch the latest construction cost index from CBS (series 200010).

    Returns:
        {
            "index_value": 101.3,
            "index_date": "2026-01",
            "yoy_change_pct": 2.5,
            "source": "CBS Series 200010"
        }
    or None on failure.
    """
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.get(
                CBS_PRICE_INDEX_URL,
                params={
                    "id": CBS_SERIES_CONSTRUCTION_COST,
                    "format": "json",
                    "download": "false",
                    "last": "12",
                },
            )
            if resp.status_code != 200:
                logger.warning(f"CBS API returned status {resp.status_code}")
                return None

            data = resp.json()

            # CBS response structure: {"month": [...], "value": [...], ...}
            # or nested under a data key — adapt to actual format
            months = data.get("month") or data.get("Month") or []
            values = data.get("value") or data.get("Value") or []

            # Try alternate structures
            if not months and isinstance(data, dict):
                # Some CBS endpoints wrap in a list or nested object
                for key in ("data", "Data", "series", "Series"):
                    nested = data.get(key)
                    if isinstance(nested, list) and len(nested) > 0:
                        first = nested[0] if isinstance(nested[0], dict) else {}
                        months = first.get("month") or first.get("Month") or []
                        values = first.get("value") or first.get("Value") or []
                        if months:
                            break

            if not values or not months:
                # Fallback: try flat list format
                if isinstance(data, list) and len(data) > 0:
                    last_entry = data[-1]
                    return {
                        "index_value": last_entry.get("value") or last_entry.get("Value"),
                        "index_date": last_entry.get("month") or last_entry.get("date") or "",
                        "yoy_change_pct": None,
                        "source": "CBS Series 200010",
                    }
                logger.warning("CBS API: could not parse month/value arrays from response")
                return None

            # Latest values
            latest_value = values[-1] if values else None
            latest_month = months[-1] if months else ""

            # Calculate YoY change if we have 12+ months of data
            yoy_change = None
            if len(values) >= 12 and values[-12] and latest_value:
                try:
                    yoy_change = round(
                        ((float(latest_value) - float(values[-12])) / float(values[-12])) * 100, 1
                    )
                except (TypeError, ZeroDivisionError, ValueError):
                    pass

            result = {
                "index_value": float(latest_value) if latest_value is not None else None,
                "index_date": str(latest_month),
                "yoy_change_pct": yoy_change,
                "source": "CBS Series 200010",
            }
            logger.info(f"CBS data fetched: index={result['index_value']}, date={result['index_date']}, yoy={yoy_change}%")
            return result

    except httpx.TimeoutException:
        logger.warning("CBS API timed out")
        return None
    except Exception as e:
        logger.warning(f"CBS API fetch failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Geocoding (Nominatim)
# ---------------------------------------------------------------------------

async def fetch_geocode(address: str | None, city: str | None) -> dict | None:
    """Geocode an address via Nominatim (OpenStreetMap).

    Returns:
        { "lat": 32.08, "lon": 34.78, "display_name": "..." }
    or None on failure.
    """
    if not address and not city:
        return None

    query = address or ""
    if city and city not in (query or ""):
        query = f"{query}, {city}" if query else city
    if "Israel" not in (query or "") and "ישראל" not in (query or ""):
        query = f"{query}, Israel"

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
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
                    result = {
                        "lat": float(item["lat"]),
                        "lon": float(item["lon"]),
                        "display_name": item.get("display_name", ""),
                    }
                    logger.info(f"Geocode: lat={result['lat']}, lon={result['lon']}")
                    return result
            logger.warning(f"Nominatim returned no results for: {query}")
            return None
    except httpx.TimeoutException:
        logger.warning("Nominatim geocoding timed out")
        return None
    except Exception as e:
        logger.warning(f"Nominatim geocoding failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Nadlan (Real Estate Transactions) — best effort
# ---------------------------------------------------------------------------

async def fetch_nadlan_recent_deals(city: str | None, street: str | None) -> list | None:
    """Try to fetch recent transactions from nadlan.gov.il.

    This endpoint is SPA-protected (reCAPTCHA) and will likely fail.
    Returns a list of deals or None.
    """
    if not city:
        return None

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            payload = {
                "ObjectID": "",
                "CurrentLavel": 1,
                "PageNo": 1,
                "OrderByFiled": "DEALDATETIME",
                "OrderByDirection": "DESC",
                "FillterFreeText": f"{street or ''} {city}".strip(),
            }
            resp = await client.post(
                NADLAN_API_URL,
                json=payload,
                headers={
                    "User-Agent": "TabuApp/2.0",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )

            if resp.status_code != 200:
                logger.info(f"Nadlan API returned status {resp.status_code} — expected (SPA protected)")
                return None

            data = resp.json()

            # If we get an HTML response or empty, it's the SPA fallback
            if isinstance(data, str) or not data:
                return None

            # Try to parse deals from response
            deals_raw = data.get("AllResults") or data.get("Results") or []
            if not deals_raw:
                return None

            deals = []
            for d in deals_raw[:10]:  # max 10 recent deals
                deals.append({
                    "price": d.get("DEALAMOUNT") or d.get("DealAmount"),
                    "area": d.get("DEALNATURE") or d.get("Area"),
                    "date": d.get("DEALDATETIME") or d.get("DealDate"),
                    "address": d.get("FULLADRESS") or d.get("FullAddress") or "",
                })

            if deals:
                logger.info(f"Nadlan: fetched {len(deals)} recent deals for {city}")
            return deals if deals else None

    except httpx.TimeoutException:
        logger.info("Nadlan API timed out — expected (SPA protected)")
        return None
    except Exception as e:
        logger.info(f"Nadlan API failed: {e} — expected (SPA protected)")
        return None


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

async def _fetch_all_async(
    address: str | None,
    city: str | None,
    gush: str | None,
    chelka: str | None,
    street: str | None = None,
) -> dict:
    """Fetch all live data concurrently. Internal async implementation."""

    cbs_task = asyncio.create_task(fetch_cbs_construction_cost_index())
    geocode_task = asyncio.create_task(fetch_geocode(address or street, city))
    nadlan_task = asyncio.create_task(fetch_nadlan_recent_deals(city, street or address))

    cbs_result, geocode_result, nadlan_result = await asyncio.gather(
        cbs_task, geocode_task, nadlan_task,
        return_exceptions=True,
    )

    # Handle exceptions from gather
    if isinstance(cbs_result, Exception):
        logger.warning(f"CBS fetch exception: {cbs_result}")
        cbs_result = None
    if isinstance(geocode_result, Exception):
        logger.warning(f"Geocode fetch exception: {geocode_result}")
        geocode_result = None
    if isinstance(nadlan_result, Exception):
        logger.warning(f"Nadlan fetch exception: {nadlan_result}")
        nadlan_result = None

    fetch_status = {
        "cbs": "success" if cbs_result else "failed",
        "geocode": "success" if geocode_result else "failed",
        "nadlan": "success" if nadlan_result else "failed",
    }

    logger.info(f"Live data fetch status: {fetch_status}")

    return {
        "cbs_index": cbs_result,
        "geocode": geocode_result,
        "nadlan_deals": nadlan_result,
        "fetch_status": fetch_status,
    }


def fetch_all_live_data(
    address: str | None = None,
    city: str | None = None,
    gush: str | None = None,
    chelka: str | None = None,
    street: str | None = None,
) -> dict:
    """Synchronous wrapper — calls all fetchers concurrently.

    Safe to call from sync code (creates event loop if needed).
    Returns combined dict with cbs_index, geocode, nadlan_deals, fetch_status.
    """
    try:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            # We're inside an existing event loop (e.g. FastAPI background task)
            # Use asyncio.run in a new thread to avoid nested loop issues
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(
                    asyncio.run,
                    _fetch_all_async(address, city, gush, chelka, street),
                )
                return future.result(timeout=35)
        else:
            return asyncio.run(
                _fetch_all_async(address, city, gush, chelka, street)
            )
    except Exception as e:
        logger.error(f"Live data fetch orchestrator failed: {e}")
        return {
            "cbs_index": None,
            "geocode": None,
            "nadlan_deals": None,
            "fetch_status": {
                "cbs": "failed",
                "geocode": "failed",
                "nadlan": "failed",
            },
        }
