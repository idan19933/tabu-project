"""Seed the database with Hebrew test data."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.config import settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import *  # noqa: E402, F401, F403
from app.models.apartment_mix import ApartmentMix  # noqa: E402
from app.models.economic_parameter import EconomicParameter  # noqa: E402
from app.models.planning_parameter import PlanningParameter  # noqa: E402
from app.models.project import Project  # noqa: E402
from app.models.simulation import Simulation, SimulationStatus  # noqa: E402
from app.models.simulation_result import SimulationResult  # noqa: E402


def main():
    db = SessionLocal()

    print("Cleaning existing data...")
    db.query(ApartmentMix).delete()
    db.query(SimulationResult).delete()
    db.query(EconomicParameter).delete()
    db.query(PlanningParameter).delete()
    db.query(Simulation).delete()
    db.query(Project).delete()
    db.commit()

    # --- Project ---
    project = Project(name="פרויקט התחדשות רחוב הרצל 15-25")
    db.add(project)
    db.flush()
    print(f"Created project: {project.name} ({project.id})")

    # --- Simulation 1: Base plan ---
    sim1 = Simulation(
        project_id=project.id,
        version_name="תוכנית בסיס",
        status=SimulationStatus.COMPLETED,
    )
    db.add(sim1)
    db.flush()

    db.add(PlanningParameter(
        simulation_id=sim1.id,
        returns_percent=20.0,
        multiplier_far=3.5,
        avg_apt_size_sqm=100.0,
        service_area_sqm=1200.0,
        number_of_floors=14,
        coverage_above_ground=45.0,
        coverage_underground=80.0,
        gross_area_per_parking=30.0,
        building_lines_notes="קו בניין קדמי 5 מ', אחורי 3 מ', צדדי 4 מ'",
        public_tasks_notes='הפקעה של 15% לצורכי ציבור, מבני ציבור 200 מ"ר',
        parking_standard_ratio=1.5,
        typ_floor_area_min=450.0,
        typ_floor_area_max=550.0,
        apts_per_floor_min=4,
        apts_per_floor_max=6,
    ))

    for apt in [
        {"apartment_type": "3 חדרים", "quantity": 28, "percentage_of_mix": 35.0},
        {"apartment_type": "4 חדרים", "quantity": 32, "percentage_of_mix": 40.0},
        {"apartment_type": "5 חדרים", "quantity": 12, "percentage_of_mix": 15.0},
        {"apartment_type": "פנטהאוז", "quantity": 8, "percentage_of_mix": 10.0},
    ]:
        db.add(ApartmentMix(simulation_id=sim1.id, **apt))

    db.add(EconomicParameter(
        simulation_id=sim1.id,
        sales_prices_by_use={
            "residential": 38000,
            "commercial": 28000,
            "office": 25000,
            "parking": 250000,
            "storage": 120000,
        },
        cost_construction_dev=12500.0,
        cost_planning_mgmt=8.5,
        levies_fees_taxes=6.0,
        timeline_months=48,
        interest_rate=5.5,
        sales_pace_per_month=3.0,
        marketing_discount_pct=2.5,
    ))

    db.add(SimulationResult(
        simulation_id=sim1.id,
        profit=18500000.0,
        profitability_rate=15.2,
        irr=18.5,
        npv=12300000.0,
    ))

    print(f"Created simulation 1: {sim1.version_name}")

    # --- Simulation 2: 18-floor alternative ---
    sim2 = Simulation(
        project_id=project.id,
        version_name="חלופה - 18 קומות",
        status=SimulationStatus.COMPLETED,
    )
    db.add(sim2)
    db.flush()

    db.add(PlanningParameter(
        simulation_id=sim2.id,
        returns_percent=25.0,
        multiplier_far=4.2,
        avg_apt_size_sqm=95.0,
        service_area_sqm=1500.0,
        number_of_floors=18,
        coverage_above_ground=40.0,
        coverage_underground=85.0,
        gross_area_per_parking=30.0,
        building_lines_notes="קו בניין קדמי 6 מ', אחורי 4 מ', צדדי 5 מ' (דרישות מגדל)",
        public_tasks_notes='הפקעה של 18% לצורכי ציבור, מבני ציבור 350 מ"ר, גן ציבורי',
        parking_standard_ratio=1.7,
        typ_floor_area_min=400.0,
        typ_floor_area_max=500.0,
        apts_per_floor_min=4,
        apts_per_floor_max=5,
    ))

    for apt in [
        {"apartment_type": "3 חדרים", "quantity": 36, "percentage_of_mix": 33.0},
        {"apartment_type": "4 חדרים", "quantity": 40, "percentage_of_mix": 37.0},
        {"apartment_type": "5 חדרים", "quantity": 20, "percentage_of_mix": 18.5},
        {"apartment_type": "פנטהאוז", "quantity": 12, "percentage_of_mix": 11.5},
    ]:
        db.add(ApartmentMix(simulation_id=sim2.id, **apt))

    db.add(EconomicParameter(
        simulation_id=sim2.id,
        sales_prices_by_use={
            "residential": 40000,
            "commercial": 30000,
            "office": 27000,
            "parking": 270000,
            "storage": 130000,
        },
        cost_construction_dev=13200.0,
        cost_planning_mgmt=9.0,
        levies_fees_taxes=7.0,
        timeline_months=54,
        interest_rate=5.5,
        sales_pace_per_month=3.5,
        marketing_discount_pct=2.0,
    ))

    db.add(SimulationResult(
        simulation_id=sim2.id,
        profit=26800000.0,
        profitability_rate=18.7,
        irr=21.3,
        npv=19500000.0,
    ))

    print(f"Created simulation 2: {sim2.version_name}")

    db.commit()
    db.close()
    print("Seed complete!")


if __name__ == "__main__":
    main()
