"""Generate a test planning + economic document for Dizengoff 251 (Block 6961, Parcel 95)."""
from fpdf import FPDF
import os

class TestDoc(FPDF):
    pass

pdf = TestDoc()
pdf.add_page()
pdf.set_auto_page_break(auto=True, margin=15)

# Use a basic built-in font (Hebrew won't render perfectly but AI will parse the numbers)
pdf.set_font("Helvetica", "B", 16)
pdf.cell(0, 10, "Feasibility Study - Dizengoff 251, Tel Aviv", ln=True, align="C")
pdf.set_font("Helvetica", "", 10)
pdf.cell(0, 8, "Block 6961, Parcel 95 | Urban Renewal (Pinui-Binui) Project", ln=True, align="C")
pdf.cell(0, 8, "Date: January 2026", ln=True, align="C")
pdf.ln(8)

# ---- PLANNING PARAMETERS ----
pdf.set_font("Helvetica", "B", 14)
pdf.cell(0, 10, "1. Planning Parameters (Taba)", ln=True)
pdf.set_font("Helvetica", "", 10)

planning = [
    ("Plot area (blue line)", "1,500 sqm"),
    ("Building rights multiplier (FAR)", "3.5"),
    ("Number of floors", "10"),
    ("Coverage above ground", "70%"),
    ("Coverage underground", "75%"),
    ("Returns to tenants", "33%"),
    ("Average apartment size", "80 sqm"),
    ("Service area percentage", "20%"),
    ("Gross area per parking spot", "50 sqm"),
    ("Parking standard ratio", "1.0 per unit"),
    ("Parking floor area", "1,125 sqm"),
    ("Balcony area per unit", "12 sqm"),
    ("Return area per apartment", "12 sqm"),
    ("Typical floor area range", "500 - 600 sqm"),
    ("Apartments per floor", "4 - 6"),
]

for label, value in planning:
    pdf.cell(100, 7, f"  {label}:", ln=False)
    pdf.cell(0, 7, value, ln=True)

pdf.ln(5)

# Building lines
pdf.set_font("Helvetica", "B", 11)
pdf.cell(0, 8, "Building Lines Notes:", ln=True)
pdf.set_font("Helvetica", "", 9)
pdf.multi_cell(0, 5, "5m setback from Dizengoff Street, 3m from rear boundary. Adjacent buildings require 6m separation distance. Heritage facade preservation required on eastern elevation per municipal guidelines.")
pdf.ln(3)

# Public tasks
pdf.set_font("Helvetica", "B", 11)
pdf.cell(0, 8, "Public Tasks / Obligations:", ln=True)
pdf.set_font("Helvetica", "", 9)
pdf.multi_cell(0, 5, "Developer must contribute 200 sqm public garden. Sidewalk widening of 2m along Dizengoff Street frontage. Underground utility relocation required before construction.")
pdf.ln(5)

# ---- COST PARAMETERS ----
pdf.set_font("Helvetica", "B", 14)
pdf.cell(0, 10, "2. Cost Estimation", ln=True)
pdf.set_font("Helvetica", "", 10)

costs = [
    ("Construction duration", "36 months"),
    ("Cost per sqm - residential", "7,500 ILS/sqm"),
    ("Cost per sqm - service areas", "5,000 ILS/sqm"),
    ("Cost per sqm - commercial", "8,000 ILS/sqm"),
    ("Cost per sqm - balconies", "3,500 ILS/sqm"),
    ("Cost per sqm - development", "1,200 ILS/sqm"),
    ("Betterment levy (hetel hashbacha)", "2,800,000 ILS"),
    ("Planning consultants", "1,500,000 ILS"),
    ("Permits and fees", "800,000 ILS"),
    ("Electricity connection", "350,000 ILS"),
    ("Bank supervision", "600,000 ILS"),
    ("Engineering management", "1,200,000 ILS"),
    ("Tenant supervision", "400,000 ILS"),
    ("Management overhead", "900,000 ILS"),
    ("Marketing & advertising", "1,100,000 ILS"),
    ("Tenant lawyer", "500,000 ILS"),
    ("Developer lawyer", "450,000 ILS"),
    ("Initiation fee", "300,000 ILS"),
    ("Rent subsidy (for tenants)", "3,600,000 ILS"),
    ("Evacuation cost", "250,000 ILS"),
    ("Moving costs", "125,000 ILS"),
    ("Demolition", "1,500,000 ILS"),
    ("Contingency reserve", "2,000,000 ILS"),
    ("Parking construction", "4,500,000 ILS"),
    ("Total construction estimate", "65,000,000 ILS"),
    ("Financing interest rate", "5.5%"),
    ("VAT rate", "17%"),
]

for label, value in costs:
    pdf.cell(100, 7, f"  {label}:", ln=False)
    pdf.cell(0, 7, value, ln=True)

pdf.ln(5)

# ---- REVENUE PARAMETERS ----
pdf.set_font("Helvetica", "B", 14)
pdf.cell(0, 10, "3. Revenue Estimation", ln=True)
pdf.set_font("Helvetica", "", 10)

revenues = [
    ("Price per sqm - residential", "42,000 ILS/sqm"),
    ("Price per sqm - commercial", "35,000 ILS/sqm"),
    ("Sales pace", "2 units per month"),
    ("Marketing discount", "3%"),
]

for label, value in revenues:
    pdf.cell(100, 7, f"  {label}:", ln=False)
    pdf.cell(0, 7, value, ln=True)

pdf.ln(3)
pdf.set_font("Helvetica", "B", 11)
pdf.cell(0, 8, "Price per unit by type:", ln=True)
pdf.set_font("Helvetica", "", 10)

unit_prices = [
    ("3 Rooms (75 sqm)", "3,150,000 ILS"),
    ("4 Rooms (95 sqm)", "3,990,000 ILS"),
    ("5 Rooms (120 sqm)", "5,040,000 ILS"),
    ("Penthouse (140 sqm)", "6,300,000 ILS"),
]

for label, value in unit_prices:
    pdf.cell(100, 7, f"  {label}:", ln=False)
    pdf.cell(0, 7, value, ln=True)

pdf.ln(5)

# ---- APARTMENT MIX ----
pdf.set_font("Helvetica", "B", 14)
pdf.cell(0, 10, "4. Apartment Mix (Developer Units)", ln=True)
pdf.set_font("Helvetica", "", 10)

mix = [
    ("60 sqm", "2 units", "20%"),
    ("70 sqm", "2 units", "20%"),
    ("80 sqm", "2 units", "20%"),
    ("90 sqm", "2 units", "20%"),
    ("100 sqm", "2 units", "20%"),
]

pdf.cell(60, 7, "  Type", ln=False)
pdf.cell(40, 7, "Quantity", ln=False)
pdf.cell(0, 7, "% of Mix", ln=True)
pdf.cell(180, 0.5, "", ln=True, border="B")
for apt_type, qty, pct in mix:
    pdf.cell(60, 7, f"  {apt_type}", ln=False)
    pdf.cell(40, 7, qty, ln=False)
    pdf.cell(0, 7, pct, ln=True)

pdf.ln(5)

# ---- MARKET ANALYSIS ----
pdf.set_font("Helvetica", "B", 14)
pdf.cell(0, 10, "5. Market Analysis Summary", ln=True)
pdf.set_font("Helvetica", "", 9)
pdf.multi_cell(0, 5, (
    "The Dizengoff 251 project is located in one of Tel Aviv's prime residential neighborhoods. "
    "Current market prices range from 38,000 to 48,000 ILS per sqm for new construction in the area. "
    "The property at Block 6961, Parcel 95 comprises 593 sqm of existing built area across 3 floors "
    "with 18 current owners in 12 sub-parcels. The proposed urban renewal will replace the existing "
    "3-story building with a modern 10-story residential tower. The building is noted for heritage "
    "preservation requirements (per municipal plan TA/2650) which adds approximately 5% to facade costs. "
    "Two liens are recorded: a municipal land designation note and heritage preservation note. "
    "Two mortgages from Bank Mizrahi Tefahot on sub-parcel 3 need to be addressed during evacuation. "
    "Expected project timeline: 6 months planning, 36 months construction, 12 months sales."
))

# Save
outpath = os.path.join(os.path.dirname(__file__), "test_planning_economic_doc.pdf")
pdf.output(outpath)
print(f"Created: {outpath}")
