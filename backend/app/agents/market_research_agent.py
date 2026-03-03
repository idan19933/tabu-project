"""Market Research Agent v2 — Multi-step pipeline for location-specific feasibility defaults.

Replaces the single-shot Claude call with a 5-step sequential pipeline:
  Step 1: Identify location (gush/chelka → address → neighborhood)
  Step 2: Look up zoning/taba (applicable plans, building rights)
  Step 3: Search construction costs (Lishkat Shmaim, market rates)
  Step 4: Search sales prices (specific neighborhood, new construction)
  Step 5: Calculate feasible parameters (pure math + validation)

Each step does targeted web searches and extracts verified data.
NEVER overwrites tabu-sourced data.
"""
import json
import logging
import math
import re

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_json(response) -> dict:
    """Extract JSON from a Claude response that may contain tool_use blocks."""
    text = ""
    for block in response.content:
        if block.type == "text":
            text += block.text

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r'\{[\s\S]*\}', cleaned)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return {"_parse_error": True, "_raw_text": cleaned[:500]}


def _default_floors(location: dict) -> int:
    """Default floor count based on city/area."""
    city = location.get("city", "")
    sub = location.get("sub_area", "")
    if "תל אביב" in city:
        if sub == "south":
            return 8
        if sub in ("central", "north"):
            return 10
        return 8
    if any(c in city for c in ["רמת גן", "גבעתיים"]):
        return 9
    if any(c in city for c in ["בת ים", "חולון"]):
        return 10
    if "חיפה" in city:
        return 8
    return 8


def _default_coverage(location: dict) -> float:
    """Default coverage based on city."""
    city = location.get("city", "")
    if "תל אביב" in city:
        return 0.55
    return 0.60


def _scale_electricity(new_units: int) -> int:
    """Scale electricity connection cost by project size."""
    return max(120000, new_units * 6000)


def _scale_initiation(existing_units: int) -> int:
    """Scale initiation fee by number of existing tenants."""
    return max(200000, existing_units * 25000)


def _format_setbacks(zoning: dict) -> str:
    parts = []
    if zoning.get("setback_front"):
        parts.append(f"Front: {zoning['setback_front']}m")
    if zoning.get("setback_side"):
        parts.append(f"Side: {zoning['setback_side']}m")
    if zoning.get("setback_rear"):
        parts.append(f"Rear: {zoning['setback_rear']}m")
    return ", ".join(parts) if parts else ""


def _generate_mix(existing_units: int, developer_units: int,
                  return_addition: float, tabu_data: dict) -> list:
    """Generate apartment mix from real sub-parcel data."""
    sub_parcels = tabu_data.get("sub_parcels", [])

    mix = []

    # Group return apts by size
    if sub_parcels:
        small = [sp for sp in sub_parcels if sp.get("area_sqm", 0) < 43]
        medium = [sp for sp in sub_parcels if 43 <= sp.get("area_sqm", 0) < 50]
        large = [sp for sp in sub_parcels if sp.get("area_sqm", 0) >= 50]

        if small:
            avg = sum(sp.get("area_sqm", 0) for sp in small) / len(small) + return_addition
            mix.append({"apartment_type": "2 חד׳ (תמורה)", "quantity": len(small),
                         "percentage_of_mix": 0})
        if medium:
            avg = sum(sp.get("area_sqm", 0) for sp in medium) / len(medium) + return_addition
            mix.append({"apartment_type": "3 חד׳ (תמורה)", "quantity": len(medium),
                         "percentage_of_mix": 0})
        if large:
            avg = sum(sp.get("area_sqm", 0) for sp in large) / len(large) + return_addition
            mix.append({"apartment_type": "3 חד׳ גדול (תמורה)", "quantity": len(large),
                         "percentage_of_mix": 0})
    else:
        # No sub-parcel data, create generic return mix
        mix.append({"apartment_type": "דירות תמורה", "quantity": existing_units,
                     "percentage_of_mix": 0})

    # Developer units
    remaining = developer_units
    dev_types = [
        ("3 חד׳ (יזם)", 0.25),
        ("4 חד׳ (יזם)", 0.40),
        ("5 חד׳ (יזם)", 0.25),
        ("פנטהאוז (יזם)", 0.10),
    ]

    for type_name, pct in dev_types:
        qty = max(1, round(developer_units * pct))
        if qty > remaining:
            qty = remaining
        if qty > 0:
            mix.append({"apartment_type": type_name, "quantity": qty,
                         "percentage_of_mix": 0})
            remaining -= qty

    # Leftover to 4-room
    if remaining > 0:
        for item in mix:
            if "4 חד׳ (יזם)" in item["apartment_type"]:
                item["quantity"] += remaining
                break

    # Calculate percentages
    total_units = sum(m["quantity"] for m in mix)
    for m in mix:
        m["percentage_of_mix"] = round((m["quantity"] / total_units) * 100) if total_units > 0 else 0

    return mix


def _clean_city(raw_city: str) -> str:
    """Clean city name from tabu registry format."""
    city = raw_city.replace("לשכת רישום מקרקעין:", "").strip()
    city = city.replace("לשכת רישום:", "").strip()
    if "תל אביב" in city or "תל-אביב" in city:
        return "תל אביב"
    return city


# ---------------------------------------------------------------------------
# Step 1: Identify Location
# ---------------------------------------------------------------------------

def _step1_identify_location(client: anthropic.Anthropic, locked: dict) -> dict:
    """Convert gush/chelka to physical address and neighborhood via web search."""
    gush = locked["gush"]
    chelka = locked["chelka"]
    city = locked["city"]

    prompt = f"""Find the exact location for this Israeli property:
- Gush (block): {gush}
- Chelka (parcel): {chelka}
- Registry city: {city}

Do these searches IN ORDER:
1. Search: "גוש {gush} חלקה {chelka} כתובת"
2. Search: "גוש {gush} {city} שכונה רחוב"

For Tel Aviv, as a BACKUP if search fails, use these gush ranges:
6900-6970 = south (Florentin/Neve Tzedek/Shapira/Lev HaIr South)
6970-7050 = central (Lev HaIr/Kerem HaTeimanim)
7050-7150 = north (Old North/New North)
7150+ = far north

But ALWAYS prefer actual search results over gush ranges.

Return ONLY this JSON (no markdown, no backticks):
{{
  "street": "...",
  "house_number": "...",
  "neighborhood": "...",
  "sub_area": "south|central|north",
  "city": "...",
  "confidence": "high|medium|low",
  "sources": ["..."]
}}"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        system="You are a precise Israeli real estate location researcher. Search for real data. If unsure, set confidence to low. Return only valid JSON.",
        tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 3}],
        messages=[{"role": "user", "content": prompt}],
    )

    result = _extract_json(response)
    if result.get("_parse_error"):
        logger.warning(f"Step 1 parse error, using defaults for gush {gush}")
        # Fallback based on gush range
        gush_num = int(gush) if str(gush).isdigit() else 0
        if 6900 <= gush_num < 6970:
            sub = "south"
            nbhood = "דרום תל אביב"
        elif 6970 <= gush_num < 7050:
            sub = "central"
            nbhood = "מרכז תל אביב"
        elif 7050 <= gush_num < 7200:
            sub = "north"
            nbhood = "צפון תל אביב"
        else:
            sub = "central"
            nbhood = city
        result = {
            "street": "",
            "house_number": "",
            "neighborhood": nbhood,
            "sub_area": sub,
            "city": city,
            "confidence": "low",
            "sources": ["gush range fallback"],
        }

    return result


# ---------------------------------------------------------------------------
# Step 2: Look Up Zoning
# ---------------------------------------------------------------------------

def _step2_lookup_zoning(client: anthropic.Anthropic, locked: dict, location: dict) -> dict:
    """Search for applicable planning schemes for this property."""
    gush = locked["gush"]
    chelka = locked["chelka"]
    city = location.get("city", "")
    neighborhood = location.get("neighborhood", "")

    prompt = f"""Research the zoning and building rights for this Israeli property:
- Gush: {gush}, Chelka: {chelka}
- City: {city}, Neighborhood: {neighborhood}
- Existing: {locked['existing_units']} units, {locked['floors_existing']} floors, lot area {locked['blue_line_area']} sqm

Do these searches:
1. Search: "גוש {gush} חלקה {chelka} תוכנית בניין עיר"
2. Search: "{city} {neighborhood} פינוי בינוי זכויות בנייה"
3. Search: "{city} תוכנית מתאר כוללנית תמ״א 38"

Find:
- Is this a conservation building (shimur ragil vs machmir)?
- What masterplans apply (TA/2650B, TA/5000, TA/5500, etc.)?
- What FAR/building rights are allowed?
- Maximum floors allowed in this area?

Return ONLY JSON:
{{
  "conservation_status": "shimur_ragil|shimur_machmir|none",
  "applicable_plans": ["..."],
  "plan_details": "...",
  "max_far_allowed": <number or null>,
  "max_floors_allowed": <number or null>,
  "coverage_allowed": <number or null>,
  "pinui_binui_eligible": true,
  "special_notes": "...",
  "sources": ["..."]
}}"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        system="You are an Israeli urban planning expert. Search for real planning data. Return verified JSON only. Use null for unverified values.",
        tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 3}],
        messages=[{"role": "user", "content": prompt}],
    )

    result = _extract_json(response)
    if result.get("_parse_error"):
        logger.warning("Step 2 parse error, using defaults")
        result = {
            "conservation_status": "none",
            "applicable_plans": [],
            "max_far_allowed": None,
            "max_floors_allowed": None,
            "coverage_allowed": None,
            "pinui_binui_eligible": True,
            "special_notes": "",
            "sources": [],
        }

    return result


# ---------------------------------------------------------------------------
# Step 3: Search Construction Costs
# ---------------------------------------------------------------------------

def _step3_search_costs(client: anthropic.Anthropic, locked: dict, location: dict) -> dict:
    """Search for real construction costs from Lishkat Shmaim and industry sources."""
    city = location.get("city", "")
    sub_area = location.get("sub_area", "")

    prompt = f"""Find current construction costs for urban renewal (pinui-binui) in {city} ({sub_area} area).

Do these searches:
1. Search: "עלות בנייה למטר {city} 2025 2026 לשכת שמאים"
2. Search: "עלויות ביצוע פינוי בינוי {city} 2025"

I need REAL market rates (NIS per sqm) for:
- Residential construction (high-rise 8+ floors in {city})
- Service areas (lobbies, stairs, corridors)
- Balconies
- Site development
- Parking (underground per sqm)
- Demolition cost (for a {locked['existing_units']}-unit, {locked['floors_existing']}-floor building, {locked['blue_line_area']} sqm lot)

Also find:
- Betterment levy (hetel hashbacha) typical for pinui-binui in {city}
- Current bank financing interest rate for construction in Israel

IMPORTANT ANCHOR RANGES (use these as sanity checks):
- Tel Aviv high-rise: ~12,000-14,000 NIS/sqm residential
- Tel Aviv mid-rise: ~10,000-12,000 NIS/sqm
- Haifa: ~8,000-10,000 NIS/sqm
- Periphery: ~5,000-7,000 NIS/sqm
- Service area cost is typically 50-65% of residential
- Balcony cost is typically 30-40% of residential
- Underground parking: ~5,000-8,000 NIS/sqm

Return ONLY JSON:
{{
  "residential_per_sqm": <number>,
  "service_per_sqm": <number>,
  "commercial_per_sqm": <number>,
  "balcony_per_sqm": <number>,
  "development_per_sqm": <number>,
  "parking_per_sqm": <number>,
  "demolition_lump": <number>,
  "betterment_levy": <number>,
  "financing_rate": <number like 5.5>,
  "cost_data_source": "...",
  "cost_data_date": "...",
  "confidence": "high|medium|low"
}}"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        system="You are an Israeli construction cost analyst. Return real market data with sources. Do NOT invent numbers. If unsure, use the anchor ranges provided and set confidence to medium.",
        tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 3}],
        messages=[{"role": "user", "content": prompt}],
    )

    result = _extract_json(response)
    if result.get("_parse_error"):
        logger.warning("Step 3 parse error, using anchor defaults for construction costs")
        # Defaults based on city
        if "תל אביב" in city:
            result = {"residential_per_sqm": 12500, "service_per_sqm": 7500,
                      "commercial_per_sqm": 10000, "balcony_per_sqm": 4500,
                      "development_per_sqm": 2500, "parking_per_sqm": 6500,
                      "demolition_lump": 400000, "betterment_levy": 1000000,
                      "financing_rate": 5.5, "confidence": "low",
                      "cost_data_source": "anchor defaults (parse error)"}
        else:
            result = {"residential_per_sqm": 9000, "service_per_sqm": 5500,
                      "commercial_per_sqm": 7500, "balcony_per_sqm": 3500,
                      "development_per_sqm": 2000, "parking_per_sqm": 5500,
                      "demolition_lump": 300000, "betterment_levy": 600000,
                      "financing_rate": 5.5, "confidence": "low",
                      "cost_data_source": "anchor defaults (parse error)"}

    return result


# ---------------------------------------------------------------------------
# Step 4: Search Sales Prices
# ---------------------------------------------------------------------------

def _step4_search_prices(client: anthropic.Anthropic, locked: dict, location: dict) -> dict:
    """Search for real sales prices in the specific neighborhood."""
    city = location.get("city", "")
    neighborhood = location.get("neighborhood", "")

    prompt = f"""Find current NEW CONSTRUCTION apartment sales prices in {neighborhood}, {city}, Israel.

Do these searches:
1. Search: "מחיר דירה חדשה {neighborhood} {city} 2025 2026 מחיר למטר"
2. Search: "פרויקט פינוי בינוי {neighborhood} {city} מחיר"
3. Search: "מדלן {neighborhood} {city} מחיר למטר"

I need prices per sqm for NEW construction (not second-hand) in {neighborhood}:
- Residential price per sqm
- Commercial/retail price per sqm (ground floor)
- Parking spot price
- Storage unit price per sqm

CRITICAL VALIDATION RULES:
- In most Israeli areas: RESIDENTIAL price per sqm > COMMERCIAL price per sqm
- Commercial is typically 60-80% of residential price
- Tel Aviv south/central new construction: 45,000-60,000 NIS/sqm
- Tel Aviv north: 60,000-80,000+ NIS/sqm
- Bat Yam/Holon: 28,000-38,000 NIS/sqm
- Haifa: 20,000-35,000 NIS/sqm
- Parking spot in TA: 150,000-250,000 NIS

Return ONLY JSON:
{{
  "residential_per_sqm": <number>,
  "commercial_per_sqm": <number>,
  "parking_per_spot": <number>,
  "storage_per_sqm": <number>,
  "comparable_projects": ["project name - price range"],
  "price_data_source": "...",
  "price_data_date": "...",
  "confidence": "high|medium|low"
}}"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        system="You are an Israeli real estate pricing analyst. Return real market prices with sources. Residential is almost always more expensive per sqm than commercial. If unsure, use the anchor ranges and set confidence to medium.",
        tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 3}],
        messages=[{"role": "user", "content": prompt}],
    )

    result = _extract_json(response)
    if result.get("_parse_error"):
        logger.warning("Step 4 parse error, using anchor defaults for prices")
        if "תל אביב" in city:
            result = {"residential_per_sqm": 52000, "commercial_per_sqm": 36000,
                      "parking_per_spot": 200000, "storage_per_sqm": 23000,
                      "comparable_projects": [], "confidence": "low",
                      "price_data_source": "anchor defaults (parse error)"}
        else:
            result = {"residential_per_sqm": 30000, "commercial_per_sqm": 21000,
                      "parking_per_spot": 120000, "storage_per_sqm": 13000,
                      "comparable_projects": [], "confidence": "low",
                      "price_data_source": "anchor defaults (parse error)"}

    # HARD VALIDATION: residential must be >= commercial
    res_price = result.get("residential_per_sqm", 0)
    com_price = result.get("commercial_per_sqm", 0)
    if com_price > res_price and res_price > 0:
        result["commercial_per_sqm"] = int(res_price * 0.7)
        result["_price_fix_applied"] = "commercial was higher than residential, corrected to 70%"

    return result


# ---------------------------------------------------------------------------
# Step 5: Calculate Feasible Parameters (pure math, NO search)
# ---------------------------------------------------------------------------

def _step5_generate_parameters(client: anthropic.Anthropic, locked: dict,
                                location: dict, zoning: dict,
                                costs: dict, prices: dict,
                                tabu_data: dict, project_id: str) -> dict:
    """Takes all verified data and CALCULATES the parameters. Pure math + logic."""

    blue_line = locked["blue_line_area"]
    existing_units = locked["existing_units"]
    existing_area = locked["existing_area"]
    existing_floors = locked["floors_existing"]

    # --- Planning calculations ---
    max_floors = zoning.get("max_floors_allowed") or _default_floors(location)
    coverage_raw = zoning.get("coverage_allowed") or (_default_coverage(location) * 100)
    coverage = coverage_raw / 100 if coverage_raw > 1 else coverage_raw

    footprint = blue_line * coverage
    total_above_ground = footprint * max_floors

    service_pct = 18
    usable_floorplate = total_above_ground / (1 + service_pct / 100)

    avg_apt = 80 if location.get("sub_area") in ("south", "central") else 90
    max_units_by_area = int(usable_floorplate / avg_apt) if avg_apt > 0 else 0

    # Multiplier = new_units / existing_units, clamped 2.0-4.5
    if existing_units > 0:
        raw_multiplier = max_units_by_area / existing_units
        multiplier = min(max(raw_multiplier, 2.0), 4.5)
        multiplier = round(multiplier * 2) / 2  # round to nearest 0.5
    else:
        multiplier = 2.5

    new_units = int(existing_units * multiplier)
    total_floorplate = new_units * avg_apt

    # Return percentage
    return_addition = 12
    return_fp = existing_area + (existing_units * return_addition)
    returns_pct = round((return_fp / total_floorplate) * 100) if total_floorplate > 0 else 30
    returns_pct = min(max(returns_pct, 20), 45)

    developer_units = max(0, new_units - existing_units)
    developer_fp = max(0, total_floorplate - return_fp)

    # Parking
    parking_ratio = 1.0
    if "תל אביב" in location.get("city", ""):
        parking_ratio = 0.8
    parking_gross = 35

    # --- Cost values ---
    res_cost = costs.get("residential_per_sqm", 12500)
    service_cost = costs.get("service_per_sqm", int(res_cost * 0.6))
    com_cost = costs.get("commercial_per_sqm", int(res_cost * 0.8))
    balcony_cost = costs.get("balcony_per_sqm", int(res_cost * 0.35))
    dev_cost = costs.get("development_per_sqm", 2500)
    demolition = costs.get("demolition_lump", 350000)
    betterment = costs.get("betterment_levy", 800000)
    interest = costs.get("financing_rate", 5.5)

    # Betterment cap: ~100K-150K per existing unit
    max_betterment = existing_units * 150000
    if betterment > max_betterment and existing_units > 0:
        betterment = max_betterment

    duration = 24 if new_units <= 20 else 30 if new_units <= 40 else 36

    # --- Revenue values ---
    res_price = prices.get("residential_per_sqm", 50000)
    com_price = prices.get("commercial_per_sqm", int(res_price * 0.7))
    parking_price = prices.get("parking_per_spot", 180000)
    storage_price = prices.get("storage_per_sqm", int(res_price * 0.45))

    # --- Profitability pre-check ---
    estimated_construction = total_floorplate * res_cost
    estimated_additional = estimated_construction * 0.35  # rough overhead
    estimated_costs = (estimated_construction + estimated_additional) * 1.17
    estimated_revenue = developer_fp * res_price
    estimated_profit_pct = ((estimated_revenue - estimated_costs) / estimated_costs * 100) if estimated_costs > 0 else 0

    adjustment_notes = []
    if estimated_profit_pct < 15 and max_floors < 12:
        max_floors += 1
        new_multiplier = min(multiplier + 0.5, 4.5)
        new_units = int(existing_units * new_multiplier)
        developer_units = max(0, new_units - existing_units)
        total_floorplate = new_units * avg_apt
        developer_fp = max(0, total_floorplate - return_fp)
        adjustment_notes.append(f"Added 1 floor to improve profitability (was {estimated_profit_pct:.0f}%)")
        multiplier = new_multiplier

    # --- Generate research summary text ---
    try:
        summary_response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=400,
            messages=[{"role": "user", "content": f"""Write a brief Hebrew research summary (3-4 sentences) for this property:
Location: {location.get('neighborhood', '')}, {location.get('city', '')}
Plans: {zoning.get('applicable_plans', [])}
Conservation: {zoning.get('conservation_status', 'none')}
Market: residential {res_price:,} NIS/sqm, construction {res_cost:,} NIS/sqm
Project: {existing_units} existing units -> {new_units} new units on {blue_line} sqm lot
Write in Hebrew. Be specific about THIS property."""}],
        )
        summary_text = "".join(b.text for b in summary_response.content if b.type == "text")
    except Exception as e:
        logger.warning(f"Summary generation failed: {e}")
        summary_text = ""

    # --- Apartment mix ---
    mix = _generate_mix(existing_units, developer_units, return_addition, tabu_data)

    # --- Build output matching DB schema ---
    return {
        "research_summary": {
            "neighborhood": location.get("neighborhood", ""),
            "area_description": f"{location.get('sub_area', '')} {location.get('city', '')}",
            "zoning": ", ".join(zoning.get("applicable_plans") or []),
            "conservation_status": zoning.get("conservation_status", "none"),
            "applicable_plans": zoning.get("applicable_plans", []),
            "market_trend": f"Residential: {res_price:,} NIS/sqm | Construction: {res_cost:,} NIS/sqm",
            "comparable_projects": ", ".join(prices.get("comparable_projects") or []),
            "summary_text": summary_text,
            "confidence": {
                "costs": costs.get("confidence", "medium"),
                "prices": prices.get("confidence", "medium"),
            },
            "validation_fixes": adjustment_notes,
        },
        "planning_parameters": {
            "planning_stage": "pre_planning",
            "returns_percent": returns_pct,
            "return_area_per_apt": return_addition,
            "avg_apt_size_sqm": avg_apt,
            "number_of_floors": max_floors,
            "coverage_above_ground": int(coverage * 100),
            "coverage_underground": 75,
            "multiplier_far": multiplier,
            "blue_line_area": blue_line,  # LOCKED from tabu
            "parking_standard_ratio": parking_ratio,
            "gross_area_per_parking": parking_gross,
            "service_area_percent": service_pct,
            "service_area_sqm": 0,
            "public_area_sqm": 0,
            "parking_floor_area": int(blue_line * 0.75),
            "balcony_area_per_unit": 12,
            "typ_floor_area_min": int(footprint * 0.8),
            "typ_floor_area_max": int(footprint),
            "apts_per_floor_min": 3,
            "apts_per_floor_max": min(5, max(3, int(footprint / 70))),
            "building_lines_notes": _format_setbacks(zoning),
            "public_tasks_notes": zoning.get("special_notes", ""),
        },
        "apartment_mix": mix,
        "cost_parameters": {
            # Per-sqm rates (absolute)
            "cost_per_sqm_residential": res_cost,
            "cost_per_sqm_service": service_cost,
            "cost_per_sqm_commercial": com_cost,
            "cost_per_sqm_balcony": balcony_cost,
            "cost_per_sqm_development": dev_cost,
            # Absolute NIS costs
            "betterment_levy": betterment,
            "purchase_tax": 0,  # exempt for pinui-binui typically
            "electricity_connection": _scale_electricity(new_units),
            "demolition": demolition,
            "parking_construction": 0,  # let calc engine compute from sqm
            "rent_subsidy": existing_units * 4000 * duration,  # monthly rent × duration
            "evacuation_cost": existing_units * 15000,
            "moving_cost": existing_units * 8000,
            # Percentage-based costs (% of construction cost)
            "planning_consultants_pct": 6,
            "permits_fees_pct": 2,
            "bank_supervision_pct": 1.5,
            "engineering_management_pct": 3,
            "tenant_supervision_pct": 1.5,
            "management_overhead_pct": 4,
            "marketing_advertising_pct": 2,
            "tenant_lawyer_pct": 1,
            "developer_lawyer_pct": 1,
            "contingency_pct": 5,
            "initiation_fee_pct": 3,
            # Financial
            "construction_duration_months": duration,
            "financing_interest_rate": interest,
            "vat_rate": 17,
            "cpi_linkage_pct": 2,
            # Traceability
            "data_sources": {
                "location": location.get("sources", []),
                "costs": costs.get("cost_data_source", ""),
                "prices": prices.get("price_data_source", ""),
                "zoning": zoning.get("sources", []),
            },
        },
        "revenue_parameters": {
            "price_per_sqm_residential": res_price,
            "price_per_sqm_commercial": com_price,
            "price_per_sqm_parking": parking_price,
            "price_per_sqm_storage": storage_price,
            "sales_pace_per_month": max(2, developer_units // 8),
            "marketing_discount_pct": 3,
            "price_per_unit_by_type": {},
        },
        "data_sources": {
            "location": location.get("sources", []),
            "construction_costs": costs.get("cost_data_source", ""),
            "sales_prices": prices.get("price_data_source", ""),
            "planning": zoning.get("sources", []),
            "comparable_projects": ", ".join(prices.get("comparable_projects") or []),
        },
        "_locked_from_tabu": {
            "blue_line_area": blue_line,
            "existing_units": existing_units,
            "existing_area": existing_area,
        },
    }


# ---------------------------------------------------------------------------
# Validation Layer
# ---------------------------------------------------------------------------

def _validate_and_fix(parameters: dict, locked: dict) -> dict:
    """Validate research output against tabu data and known ranges."""
    fixes = []
    planning = parameters.get("planning_parameters", {})
    costs = parameters.get("cost_parameters", {})
    revenue = parameters.get("revenue_parameters", {})

    # 1. Blue line must match tabu
    if planning.get("blue_line_area") != locked["blue_line_area"]:
        fixes.append(f"Fixed blue_line: {planning.get('blue_line_area')} -> {locked['blue_line_area']}")
        planning["blue_line_area"] = locked["blue_line_area"]

    # 2. Check that proposed units physically fit on the lot
    blue_line = locked["blue_line_area"]
    floors = planning.get("number_of_floors", 8)
    coverage = planning.get("coverage_above_ground", 55) / 100
    max_floorplate = blue_line * coverage * floors
    avg_apt = planning.get("avg_apt_size_sqm", 80)
    max_units = int(max_floorplate / (avg_apt * 1.18)) if avg_apt > 0 else 0
    multiplier = planning.get("multiplier_far", 2.5)
    proposed_units = int(locked["existing_units"] * multiplier) if locked["existing_units"] > 0 else 0

    if proposed_units > max_units and max_units > 0 and locked["existing_units"] > 0:
        new_multiplier = round((max_units / locked["existing_units"]) * 2) / 2
        new_multiplier = max(2.0, new_multiplier)
        fixes.append(f"Fixed multiplier: {multiplier} -> {new_multiplier} (lot fits {max_units} units, not {proposed_units})")
        planning["multiplier_far"] = new_multiplier

    # 3. Residential price >= commercial price
    res_price = revenue.get("price_per_sqm_residential", 0)
    com_price = revenue.get("price_per_sqm_commercial", 0)
    if com_price > res_price and res_price > 0:
        revenue["price_per_sqm_commercial"] = int(res_price * 0.7)
        fixes.append(f"Fixed commercial price: {com_price:,} -> {revenue['price_per_sqm_commercial']:,} (was > residential)")

    # 4. Construction cost sanity check
    res_cost = costs.get("cost_per_sqm_residential", 0)
    if res_cost > 18000:
        costs["cost_per_sqm_residential"] = 13000
        fixes.append(f"Fixed construction cost: {res_cost:,} -> 13,000 (unrealistically high)")
    elif 0 < res_cost < 5000:
        costs["cost_per_sqm_residential"] = 8000
        fixes.append(f"Fixed construction cost: {res_cost:,} -> 8,000 (unrealistically low)")

    # 5. Betterment levy cap (~150K per existing unit)
    betterment = costs.get("betterment_levy", 0)
    if locked["existing_units"] > 0:
        max_betterment = locked["existing_units"] * 150000
        if betterment > max_betterment:
            costs["betterment_levy"] = max_betterment
            fixes.append(f"Fixed betterment: {betterment:,} -> {max_betterment:,} (capped at 150K/unit)")

    # 6. Returns percent clamped 20-45%
    returns = planning.get("returns_percent", 30)
    if returns < 20 or returns > 45:
        clamped = max(20, min(45, returns))
        planning["returns_percent"] = clamped
        fixes.append(f"Clamped returns_percent: {returns} -> {clamped}")

    # Store fixes
    if fixes:
        summary = parameters.get("research_summary", {})
        existing_fixes = summary.get("validation_fixes", [])
        summary["validation_fixes"] = existing_fixes + fixes
        parameters["research_summary"] = summary

    return parameters


# ---------------------------------------------------------------------------
# Main Entry Point
# ---------------------------------------------------------------------------

def run_market_research(tabu_data: dict, project_id: str) -> dict:
    """Multi-step market research pipeline.

    Each step does targeted searches and validates results before proceeding.
    NEVER overwrites tabu-sourced data.
    """
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("No ANTHROPIC_API_KEY configured")

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    # === LOCKED VALUES from Tabu (NEVER overwrite these) ===
    # Build sub_parcels from owners if not provided directly
    sub_parcels = tabu_data.get("sub_parcels", [])
    if not sub_parcels:
        # Derive from owners — group by sub_parcel number
        owners = tabu_data.get("owners", [])
        sp_map: dict[str, dict] = {}
        for o in owners:
            sp_id = o.get("sub_parcel")
            if sp_id and sp_id not in sp_map:
                sp_map[sp_id] = {
                    "sub_parcel": sp_id,
                    "area_sqm": o.get("area_sqm", 0),
                    "floor": o.get("floor", ""),
                }
        sub_parcels = list(sp_map.values())
        logger.info(f"Derived {len(sub_parcels)} sub_parcels from owners list")

    existing_area = sum(sp.get("area_sqm", 0) for sp in sub_parcels if sp.get("area_sqm"))
    if not existing_area:
        existing_area = tabu_data.get("total_residential_area_sqm",
                                      tabu_data.get("area_sqm", 0))

    # Count existing units
    existing_units = tabu_data.get("total_sub_parcels", 0) or len(sub_parcels)

    # Blue line area — try multiple keys
    blue_line = (tabu_data.get("shared_area_sqm")
                 or tabu_data.get("lot_area")
                 or tabu_data.get("area_sqm")
                 or 0)

    # Floors — try direct value, or infer from owner floor data
    floors_existing = tabu_data.get("floors", 0)
    if not floors_existing and sub_parcels:
        unique_floors = set(sp.get("floor", "") for sp in sub_parcels if sp.get("floor"))
        floors_existing = len(unique_floors) if unique_floors else 0

    # City — try registry, city, or infer from gush
    raw_city = tabu_data.get("registry") or tabu_data.get("city") or ""
    city = _clean_city(raw_city) if raw_city else ""
    if not city:
        # Infer from gush range (Tel Aviv gush ranges)
        gush_num = int(tabu_data.get("block", 0)) if str(tabu_data.get("block", "")).isdigit() else 0
        if 6000 <= gush_num <= 8000:
            city = "תל אביב"
        elif 8000 < gush_num <= 8500:
            city = "רמת גן"
        elif 8500 < gush_num <= 9000:
            city = "גבעתיים"

    locked = {
        "blue_line_area": blue_line,
        "existing_units": existing_units,
        "existing_area": existing_area,
        "floors_existing": floors_existing,
        "buildings": tabu_data.get("buildings", 1),
        "gush": tabu_data.get("block", ""),
        "chelka": tabu_data.get("parcel", ""),
        "city": city,
    }

    # Also pass derived sub_parcels into tabu_data for mix generation
    if not tabu_data.get("sub_parcels") and sub_parcels:
        tabu_data = {**tabu_data, "sub_parcels": sub_parcels}

    logger.info(f"Running multi-step market research for project {project_id}, "
                f"gush={locked['gush']}, chelka={locked['chelka']}")

    # === Step 1: Identify Location ===
    logger.info("Step 1/5: Identifying location...")
    location = _step1_identify_location(client, locked)
    logger.info(f"  -> {location.get('neighborhood', '?')}, {location.get('city', '?')} "
                f"(confidence: {location.get('confidence', '?')})")

    # === Step 2: Look Up Zoning ===
    logger.info("Step 2/5: Looking up zoning...")
    zoning = _step2_lookup_zoning(client, locked, location)
    logger.info(f"  -> Plans: {zoning.get('applicable_plans', [])}, "
                f"Conservation: {zoning.get('conservation_status', 'none')}")

    # === Step 3: Search Construction Costs ===
    logger.info("Step 3/5: Searching construction costs...")
    costs_data = _step3_search_costs(client, locked, location)
    logger.info(f"  -> Residential: {costs_data.get('residential_per_sqm', 0):,} NIS/sqm "
                f"(confidence: {costs_data.get('confidence', '?')})")

    # === Step 4: Search Sales Prices ===
    logger.info("Step 4/5: Searching sales prices...")
    prices_data = _step4_search_prices(client, locked, location)
    logger.info(f"  -> Residential: {prices_data.get('residential_per_sqm', 0):,} NIS/sqm, "
                f"Commercial: {prices_data.get('commercial_per_sqm', 0):,} NIS/sqm "
                f"(confidence: {prices_data.get('confidence', '?')})")

    # === Step 5: Calculate Parameters ===
    logger.info("Step 5/5: Generating parameters...")
    parameters = _step5_generate_parameters(
        client, locked, location, zoning, costs_data, prices_data, tabu_data, project_id
    )

    # === Validation ===
    logger.info("Running validation...")
    parameters = _validate_and_fix(parameters, locked)

    # Validate required keys
    required_keys = ["planning_parameters", "cost_parameters", "revenue_parameters", "apartment_mix"]
    for key in required_keys:
        if key not in parameters:
            raise ValueError(f"Research pipeline missing required key: {key}")

    # Add metadata
    parameters["_metadata"] = {
        "project_id": project_id,
        "gush": locked["gush"],
        "chelka": locked["chelka"],
        "generated_by": "market_research_agent_v2",
        "model": "claude-sonnet-4-20250514",
        "pipeline_version": "2.0",
        "steps_completed": ["location", "zoning", "costs", "prices", "parameters", "validation"],
        "confidence": {
            "location": location.get("confidence", "unknown"),
            "costs": costs_data.get("confidence", "unknown"),
            "prices": prices_data.get("confidence", "unknown"),
        },
    }

    validation_fixes = parameters.get("research_summary", {}).get("validation_fixes", [])
    if validation_fixes:
        logger.info(f"Validation fixes applied: {len(validation_fixes)}")
        for fix in validation_fixes:
            logger.info(f"  - {fix}")

    logger.info(f"Market research v2 complete for project {project_id}")
    return parameters
