"""Generate a test feasibility document PDF for TabuApp simulation testing.
Uses reportlab which produces properly-formed PDFs that pdf-parse can read."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

output_path = "test_feasibility_document.pdf"
c = canvas.Canvas(output_path, pagesize=A4)
w, h = A4

y = h - 30 * mm

def heading(text, size=16):
    global y
    y -= 8 * mm
    c.setFont("Helvetica-Bold", size)
    c.drawString(20 * mm, y, text)
    y -= 2 * mm

def line(label, value):
    global y
    y -= 5.5 * mm
    c.setFont("Helvetica", 10)
    c.drawString(25 * mm, y, f"{label}: {value}")

def gap():
    global y
    y -= 4 * mm

def check_page():
    global y
    if y < 30 * mm:
        c.showPage()
        y = h - 20 * mm

# Title
c.setFont("Helvetica-Bold", 18)
c.drawCentredString(w / 2, y, "Feasibility Study - Urban Renewal Project")
y -= 7 * mm
c.setFont("Helvetica", 12)
c.drawCentredString(w / 2, y, "Dizengoff 251, Tel Aviv - Pinui Binui")
y -= 6 * mm
c.drawCentredString(w / 2, y, "Date: March 2026")

# ── Section 1: Planning ──
heading("1. Planning Parameters")
line("Returns Percent (achuz hechzer tmurot)", "40%")
line("FAR Multiplier (machpil zekhuyot bniya)", "3.5")
line("Average Apartment Size (shetach dira memutza)", "85 sqm")
line("Number of Floors (mispar komot)", "10")
line("Coverage Above Ground (achuz kisui meal karka)", "55%")
line("Coverage Underground (achuz kisui tatkarkai)", "75%")
line("Gross Area Per Parking Space (shetach bruto lachanaya)", "30 sqm")
line("Parking Standard Ratio (yachas chanaya ledira)", "1.5")
line("Service Area Percent (achuz shetach sherut)", "15%")
line("Balcony Area Per Unit (shetach mirpeset ledira)", "12 sqm")
line("Blue Line Area / Lot Size (shetach kav kachol)", "1500 sqm")
line("Public Area (shetach tziburi)", "200 sqm")

gap()
check_page()

# ── Section 2: Costs ──
heading("2. Cost Parameters")
line("Construction Cost Residential (alut bniya lemegurim)", "12500 ILS per sqm")
line("Construction Cost Service (alut bniya sherut)", "8000 ILS per sqm")
line("Construction Cost Commercial (alut bniya miskhari)", "10000 ILS per sqm")
line("Construction Cost Balconies (alut bniya mirpasot)", "6000 ILS per sqm")
line("Development Cost (alut pituach)", "2500 ILS per sqm")
line("Construction Duration (meshech bniya)", "36 months")
line("Betterment Levy (hetel hashbacha)", "3200000 ILS")
line("Purchase Tax (mas rechisha)", "2.5%")
line("Financing Interest Rate (ribit mimun)", "5.5%")
line("VAT Rate (shiur maam)", "17%")

gap()
check_page()

# ── Section 3: Revenue ──
heading("3. Revenue Parameters")
line("Sale Price Residential (mechir mechira lemegurim)", "55000 ILS per sqm")
line("Sale Price Commercial (mechir mechira miskhari)", "35000 ILS per sqm")

gap()
check_page()

# ── Section 4: Apartment Mix ──
heading("4. Apartment Mix (Tamhil Dirot)")
line("2 rooms (2 chadarim)", "8 units, 10% of mix")
line("3 rooms (3 chadarim)", "24 units, 30% of mix")
line("4 rooms (4 chadarim)", "32 units, 40% of mix")
line("5 rooms (5 chadarim)", "12 units, 15% of mix")
line("Penthouse (penthouse / gag)", "4 units, 5% of mix")
line("Total apartments", "80 units, 100%")

gap()
check_page()

# ── Section 5: Project Summary ──
heading("5. Project Summary")
line("Project Type", "Pinui-Binui (Demolition and Reconstruction)")
line("Existing Units to Demolish", "18 units")
line("New Units Proposed", "80 units")
line("Total Built Area Above Ground", "approximately 8250 sqm")
line("Underground Parking Levels", "2 levels")
line("Commercial Space", "350 sqm ground floor")
line("Planning Stage", "Taba approved")
line("Expected Project Duration", "48 months total")

gap()
check_page()

# ── Section 6: Existing State ──
heading("6. Existing State (Matzav Kayam)")
line("Number of Existing Units (mispar dirot kaymot)", "18")
line("Average Existing Unit Size", "65 sqm")
line("Building Age", "Built 1960s, 4 floors")
line("Current Zoning", "Residential with ground floor commercial")
line("Block (Gush)", "6961")
line("Parcel (Chelka)", "95")
line("Lot Area (Shetach Chelka)", "1500 sqm")

c.save()
print(f"PDF created: {output_path}")
