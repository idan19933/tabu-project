"""Geo endpoint: convert gush/chelka to coordinates.

Uses GovMap cadastral APIs (which natively understand Israeli parcel IDs)
with Nominatim address-based geocoding as fallback.
"""
import logging

from fastapi import APIRouter, HTTPException, Query

from app.services.parcel_locator import locate_parcel

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/parcel/{gush}/{chelka}")
async def get_parcel_geo(
    gush: str,
    chelka: str,
    address: str | None = Query(None, description="Address from tabu document"),
    city: str | None = Query(None, description="City from tabu document"),
):
    """Get geographic coordinates for an Israeli parcel.

    Tries GovMap cadastral APIs first, falls back to Nominatim geocoding.
    Pass address and/or city from tabu data for better Nominatim fallback results.

    Returns center [lat, lon] in WGS84.
    """
    result = await locate_parcel(gush, chelka, address=address, city=city)

    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Could not geocode parcel {gush}/{chelka}",
        )

    result["gush"] = gush
    result["chelka"] = chelka

    return result
