"""Geo endpoint: convert gush/chelka to coordinates.

Uses GovMap Open WFS for exact parcel polygon centroids,
with caching in project.geo_data to avoid repeated API calls.
Falls back to Nominatim address-based geocoding.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.project import Project
from app.services.parcel_locator import locate_parcel

router = APIRouter()
logger = logging.getLogger(__name__)


def _find_project_by_parcel(db: Session, gush: str, chelka: str) -> Project | None:
    """Find a project whose tabu_data matches this gush/chelka."""
    projects = db.query(Project).filter(Project.tabu_data.isnot(None)).all()
    for p in projects:
        td = p.tabu_data or {}
        if str(td.get("block", "")) == gush and str(td.get("parcel", "")) == chelka:
            return p
    return None


@router.get("/parcel/{gush}/{chelka}")
async def get_parcel_geo(
    gush: str,
    chelka: str,
    address: str | None = Query(None, description="Address from tabu document"),
    city: str | None = Query(None, description="City from tabu document"),
    db: Session = Depends(get_db),
):
    """Get geographic coordinates for an Israeli parcel.

    Checks project cache first, then tries GovMap WFS (with retry),
    falls back to Nominatim geocoding.

    Returns center [lat, lon] in WGS84.
    """
    project = _find_project_by_parcel(db, gush, chelka)

    # Check cache first
    if project and project.geo_data:
        cached = project.geo_data.get("parcel_location")
        if (
            cached
            and cached.get("gush") == gush
            and cached.get("chelka") == chelka
            and cached.get("center")
        ):
            logger.info("Parcel %s/%s served from cache", gush, chelka)
            return {
                "center": cached["center"],
                "display_name": cached.get("display_name", ""),
                "source": cached.get("source", "cache"),
                "method": "cache",
                "gush": gush,
                "chelka": chelka,
            }

    # If project has address in tabu_data but caller didn't pass it, use it
    if not address and project and project.tabu_data:
        address = project.tabu_data.get("address")
    if not city and project and project.tabu_data:
        city = project.tabu_data.get("city")

    result = await locate_parcel(gush, chelka, address=address, city=city)

    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Could not geocode parcel {gush}/{chelka}",
        )

    result["gush"] = gush
    result["chelka"] = chelka

    # Cache successful GovMap results to the project
    if project and result.get("source") == "govmap_wfs":
        try:
            geo_data = project.geo_data or {}
            geo_data["parcel_location"] = {
                "center": result["center"],
                "display_name": result.get("display_name", ""),
                "source": "govmap_wfs",
                "gush": gush,
                "chelka": chelka,
                "cached_at": datetime.now(timezone.utc).isoformat(),
            }
            project.geo_data = geo_data
            db.commit()
            logger.info("Cached GovMap location for project %s", project.id)
        except Exception as e:
            logger.warning("Failed to cache geo data: %s", e)
            db.rollback()

    return result
