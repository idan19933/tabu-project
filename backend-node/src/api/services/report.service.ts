/**
 * Excel report generation using exceljs.
 * Two report types matching the Shikun & Binui client format:
 *   - Management Report (דוח ניהולי): Sections 1-3
 *   - Economic Report (דוח כלכלי): Sections 4-5
 */
import ExcelJS from 'exceljs';
import { safe } from '../../utils/safe';

// ─── Style constants ─────────────────────────────────────────────────────────

const HEADER_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
const SECTION_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
const SUBHEADER_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
const LIGHT_GREEN_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
const LIGHT_RED_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } };
const YELLOW_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };

const HEADER_FONT: Partial<ExcelJS.Font> = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
const SECTION_FONT: Partial<ExcelJS.Font> = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
const SUBHEADER_FONT: Partial<ExcelJS.Font> = { name: 'Arial', bold: true, size: 10 };
const CELL_FONT: Partial<ExcelJS.Font> = { name: 'Arial', size: 10 };
const BOLD_FONT: Partial<ExcelJS.Font> = { name: 'Arial', bold: true, size: 10 };
const GREEN_FONT: Partial<ExcelJS.Font> = { name: 'Arial', size: 10, color: { argb: 'FF006600' }, bold: true };
const RED_FONT: Partial<ExcelJS.Font> = { name: 'Arial', size: 10, color: { argb: 'FFCC0000' }, bold: true };

const CURRENCY_FMT = '#,##0';
const DECIMAL_FMT = '#,##0.00';

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  left: { style: 'thin' }, right: { style: 'thin' },
  top: { style: 'thin' }, bottom: { style: 'thin' },
};
const RTL_ALIGN: Partial<ExcelJS.Alignment> = { horizontal: 'right', vertical: 'middle', wrapText: true };
const CENTER_ALIGN: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function styleRow(ws: ExcelJS.Worksheet, rowNum: number, cols: number, fill?: ExcelJS.FillPattern, font?: Partial<ExcelJS.Font>) {
  for (let c = 1; c <= cols; c++) {
    const cell = ws.getCell(rowNum, c);
    if (fill) cell.fill = fill;
    cell.font = font || CELL_FONT;
    cell.alignment = RTL_ALIGN;
    cell.border = THIN_BORDER;
  }
}

function writeSectionHeader(ws: ExcelJS.Worksheet, rowNum: number, title: string, cols = 4): number {
  ws.mergeCells(rowNum, 1, rowNum, cols);
  ws.getCell(rowNum, 1).value = title;
  styleRow(ws, rowNum, cols, SECTION_FILL, SECTION_FONT);
  return rowNum + 1;
}

function writeKvRow(ws: ExcelJS.Worksheet, rowNum: number, label: string, value: any, fmt?: string, bold = false, highlight?: string): number {
  ws.getCell(rowNum, 1).value = label;
  const cellV = ws.getCell(rowNum, 2);
  cellV.value = value;
  if (fmt) cellV.numFmt = fmt;
  const font = bold ? BOLD_FONT : CELL_FONT;
  ws.getCell(rowNum, 1).font = font;
  cellV.font = font;
  for (let c = 1; c <= 2; c++) {
    ws.getCell(rowNum, c).alignment = RTL_ALIGN;
    ws.getCell(rowNum, c).border = THIN_BORDER;
  }
  if (highlight === 'green') {
    for (let c = 1; c <= 2; c++) ws.getCell(rowNum, c).fill = LIGHT_GREEN_FILL;
  } else if (highlight === 'red') {
    for (let c = 1; c <= 2; c++) ws.getCell(rowNum, c).fill = LIGHT_RED_FILL;
  }
  return rowNum + 1;
}

function getAllResults(sim: any): Record<string, any> {
  const r = sim.simulationResults;
  if (!r) return {};
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(r)) {
    if (key === 'simulationId') continue;
    if (val != null) {
      const num = Number(val);
      result[key] = isNaN(num) ? val : num;
    } else {
      result[key] = ['monthlyCashFlows'].includes(key) ? [] :
        ['calculationDetails', 'costBreakdown', 'revenueBreakdown', 'areaBreakdown'].includes(key) ? {} : 0;
    }
  }
  return result;
}

// ─── Management Report ───────────────────────────────────────────────────────

export async function generateManagementReport(sim: any): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('דוח ניהולי');
  ws.views = [{ rightToLeft: true }];

  ws.getColumn(1).width = 35;
  ws.getColumn(2).width = 25;
  ws.getColumn(3).width = 20;
  ws.getColumn(4).width = 20;

  const vals = getAllResults(sim);
  const pp = sim.planningParameters;
  const mix = sim.apartmentMix || [];

  let row = 1;

  // Title
  ws.mergeCells(row, 1, row, 4);
  const titleCell = ws.getCell(row, 1);
  titleCell.value = 'דוח ניהולי - בדיקת כדאיות כלכלית';
  titleCell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
  titleCell.fill = HEADER_FILL;
  titleCell.alignment = CENTER_ALIGN;
  row += 2;

  // Project Info
  row = writeKvRow(ws, row, 'פרויקט', sim.versionName);
  row = writeKvRow(ws, row, 'תאריך הפקה', new Date().toLocaleDateString('he-IL'));
  row = writeKvRow(ws, row, 'גרסת סימולציה', sim.versionName);
  if (pp?.planningStage) row = writeKvRow(ws, row, 'שלב תכנוני', pp.planningStage);
  row++;

  // KPI Summary
  row = writeSectionHeader(ws, row, 'מדדים עיקריים');
  const profit = vals.expectedProfit ?? vals.profit ?? 0;
  row = writeKvRow(ws, row, 'רווח יזמי (₪)', profit, CURRENCY_FMT, true, profit > 0 ? 'green' : 'red');
  row = writeKvRow(ws, row, 'שיעור רווחיות (%)', vals.profitPercent ?? vals.profitabilityRate ?? 0, DECIMAL_FMT, true);
  row = writeKvRow(ws, row, 'רווחיות סטנדרט 21% (%)', vals.profitPercentStd21 ?? 0, DECIMAL_FMT);
  row = writeKvRow(ws, row, 'IRR (%)', vals.irr ?? 0, DECIMAL_FMT);
  row = writeKvRow(ws, row, 'NPV (₪)', vals.npv ?? 0, CURRENCY_FMT);
  row = writeKvRow(ws, row, 'סה"כ הכנסות (₪)', vals.totalRevenue ?? 0, CURRENCY_FMT);
  row = writeKvRow(ws, row, 'סה"כ עלויות כולל מע"מ (₪)', vals.totalCostsInclVat ?? vals.totalCosts ?? 0, CURRENCY_FMT);
  row++;

  // Section 2
  row = writeSectionHeader(ws, row, 'מצב יוצא (Proposed State)');
  row = writeKvRow(ws, row, 'סה"כ יחידות חדשות', vals.totalNewUnits ?? vals.totalUnits ?? 0);
  row = writeKvRow(ws, row, 'שטחי תמורות (מ"ר)', vals.totalReturnFloorplate ?? 0, DECIMAL_FMT);
  row = writeKvRow(ws, row, 'סה"כ שטח (מ"ר)', vals.totalFloorplate ?? vals.totalResidentialArea ?? 0, DECIMAL_FMT);
  row = writeKvRow(ws, row, 'יחידות יזם', vals.developerUnits ?? 0);
  row = writeKvRow(ws, row, 'שטח יזם (מ"ר)', vals.developerFloorplate ?? 0, DECIMAL_FMT);
  row = writeKvRow(ws, row, 'גודל ממוצע דירת יזם (מ"ר)', vals.avgDeveloperUnitSize ?? 0, DECIMAL_FMT);
  row = writeKvRow(ws, row, 'יחס שילוב', vals.combinationRatio ?? 0, DECIMAL_FMT);
  row++;

  // Section 3
  row = writeSectionHeader(ws, row, 'פרוגרמה (Building Program)');
  row = writeKvRow(ws, row, 'שטחי שירות (מ"ר)', vals.serviceAreas ?? 0, DECIMAL_FMT);
  row = writeKvRow(ws, row, 'סה"כ מעל קרקע (מ"ר)', vals.totalAboveGround ?? 0, DECIMAL_FMT);
  row = writeKvRow(ws, row, 'שטח קומה (מ"ר)', vals.floorArea ?? 0, DECIMAL_FMT);
  row = writeKvRow(ws, row, 'מספר בניינים מקסימלי', vals.maxBuildings ?? 0);
  row = writeKvRow(ws, row, 'חניות', vals.totalParkingSpots ?? 0);
  row = writeKvRow(ws, row, 'שטח חניה (מ"ר)', vals.totalParkingArea ?? 0, DECIMAL_FMT);
  row = writeKvRow(ws, row, 'שטח מרפסות (מ"ר)', vals.totalBalconyArea ?? 0, DECIMAL_FMT);
  row++;

  // Apartment Mix
  if (mix.length > 0) {
    row = writeSectionHeader(ws, row, 'תמהיל דירות');
    const headers = ['סוג דירה', 'כמות', 'אחוז (%)'];
    for (let i = 0; i < headers.length; i++) ws.getCell(row, i + 1).value = headers[i];
    styleRow(ws, row, headers.length, SUBHEADER_FILL, SUBHEADER_FONT);
    row++;
    for (const a of mix) {
      ws.getCell(row, 1).value = a.apartmentType;
      ws.getCell(row, 2).value = safe(a.quantity);
      ws.getCell(row, 3).value = safe(a.percentageOfMix);
      styleRow(ws, row, 3);
      row++;
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ─── Economic Report ─────────────────────────────────────────────────────────

export async function generateEconomicReport(sim: any): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('דוח כלכלי');
  ws.views = [{ rightToLeft: true }];

  ws.getColumn(1).width = 35;
  ws.getColumn(2).width = 25;
  for (let i = 3; i <= 6; i++) ws.getColumn(i).width = 20;

  const vals = getAllResults(sim);
  const costBd = (vals.costBreakdown || {}) as Record<string, any>;
  const revBd = (vals.revenueBreakdown || {}) as Record<string, any>;

  let row = 1;

  // Title
  ws.mergeCells(row, 1, row, 6);
  const titleCell = ws.getCell(row, 1);
  titleCell.value = 'דוח כלכלי מפורט - בדיקת כדאיות';
  titleCell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
  titleCell.fill = HEADER_FILL;
  titleCell.alignment = CENTER_ALIGN;
  row += 2;

  // Construction Costs
  row = writeSectionHeader(ws, row, 'עלויות בנייה', 6);
  const constructionItems: [string, string][] = [
    ['בנייה מגורים', 'construction_residential'],
    ['בנייה שירות', 'construction_service'],
    ['בנייה ציבורי/מסחרי', 'construction_public'],
    ['מרפסות', 'construction_balcony'],
    ['פיתוח', 'construction_development'],
    ['חניה', 'parking_construction'],
  ];
  for (const [label, key] of constructionItems) {
    row = writeKvRow(ws, row, label, safe(costBd[key]), CURRENCY_FMT);
  }
  row = writeKvRow(ws, row, 'סה"כ בנייה', vals.constructionCost ?? 0, CURRENCY_FMT, true);
  row++;

  // Additional Costs
  row = writeSectionHeader(ws, row, 'עלויות נוספות', 6);
  const additionalItems: [string, string][] = [
    ['היטל השבחה', 'betterment_levy'], ['מס רכישה', 'purchase_tax'],
    ['תכנון ויועצים', 'planning_consultants'], ['היתרים ואגרות', 'permits_fees'],
    ['חיבור חשמל', 'electricity_connection'], ['פיקוח בנק', 'bank_supervision'],
    ['ניהול הנדסי', 'engineering_management'], ['פיקוח דיירים', 'tenant_supervision'],
    ['הנהלה וכלליות', 'management_overhead'], ['שיווק ופרסום', 'marketing_advertising'],
    ['עו״ד דיירים', 'tenant_lawyer'], ['דמי ייזום', 'initiation_fee'],
    ['סבסוד שכ״ד', 'rent_subsidy'], ['עלות פינוי', 'evacuation_cost'],
    ['הובלות', 'moving_cost'], ['בלת״מ', 'contingency'],
    ['עו״ד יזם', 'developer_lawyer'], ['הריסה', 'demolition'],
  ];
  for (const [label, key] of additionalItems) {
    const val = safe(costBd[key]);
    if (val > 0) row = writeKvRow(ws, row, label, val, CURRENCY_FMT);
  }
  row++;

  // Financial Costs
  row = writeSectionHeader(ws, row, 'עלויות מימון ומיסים', 6);
  row = writeKvRow(ws, row, 'עלות מימון', vals.financingCost ?? 0, CURRENCY_FMT);
  row = writeKvRow(ws, row, 'סה"כ עלויות ללא מע"מ', vals.totalCostsExclVat ?? 0, CURRENCY_FMT, true);
  row = writeKvRow(ws, row, 'סה"כ עלויות כולל מע"מ', vals.totalCostsInclVat ?? vals.totalCosts ?? 0, CURRENCY_FMT, true, 'red');
  row++;

  // Revenue
  row = writeSectionHeader(ws, row, 'הכנסות', 6);
  row = writeKvRow(ws, row, 'הכנסות מגורים', safe(revBd.residential ?? vals.residentialRevenue), CURRENCY_FMT);
  row = writeKvRow(ws, row, 'הכנסות מסחרי', safe(revBd.commercial ?? vals.commercialRevenue), CURRENCY_FMT);
  if (safe(revBd.parking) > 0) row = writeKvRow(ws, row, 'הכנסות חניה', safe(revBd.parking), CURRENCY_FMT);
  if (safe(revBd.storage) > 0) row = writeKvRow(ws, row, 'הכנסות מחסנים', safe(revBd.storage), CURRENCY_FMT);
  if (safe(revBd.marketing_discount) > 0) row = writeKvRow(ws, row, 'הנחה שיווקית', -safe(revBd.marketing_discount), CURRENCY_FMT);
  row = writeKvRow(ws, row, 'סה"כ הכנסות נטו', vals.netRevenue ?? vals.totalRevenue ?? 0, CURRENCY_FMT, true, 'green');
  row++;

  // Profit
  row = writeSectionHeader(ws, row, 'רווח', 6);
  const profit = vals.expectedProfit ?? vals.profit ?? 0;
  row = writeKvRow(ws, row, 'רווח יזמי (₪)', profit, CURRENCY_FMT, true, profit > 0 ? 'green' : 'red');
  row = writeKvRow(ws, row, 'שיעור רווחיות (%)', vals.profitPercent ?? vals.profitabilityRate ?? 0, DECIMAL_FMT, true);
  row = writeKvRow(ws, row, 'IRR (%)', vals.irr ?? 0, DECIMAL_FMT);
  row = writeKvRow(ws, row, 'NPV (₪)', vals.npv ?? 0, CURRENCY_FMT);
  row++;

  // Cash Flow Table
  const cashFlows = vals.monthlyCashFlows;
  if (Array.isArray(cashFlows) && cashFlows.length > 0) {
    row = writeSectionHeader(ws, row, 'תזרים מזומנים חודשי', 6);
    const cfHeaders = ['חודש', 'תזרים (₪)', 'מצטבר (₪)'];
    for (let i = 0; i < cfHeaders.length; i++) ws.getCell(row, i + 1).value = cfHeaders[i];
    styleRow(ws, row, 3, SUBHEADER_FILL, SUBHEADER_FONT);
    row++;
    let cumulative = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      const cf = safe(cashFlows[i]);
      cumulative += cf;
      ws.getCell(row, 1).value = i + 1;
      ws.getCell(row, 2).value = cf; ws.getCell(row, 2).numFmt = CURRENCY_FMT;
      ws.getCell(row, 3).value = cumulative; ws.getCell(row, 3).numFmt = CURRENCY_FMT;
      styleRow(ws, row, 3);
      row++;
    }
    row++;
  }

  // Sensitivity Matrix
  row = writeSectionHeader(ws, row, 'ניתוח רגישות - רווח יזמי', 6);
  const baseRevenue = safe(vals.netRevenue ?? vals.totalRevenue);
  const baseCosts = safe(vals.totalCostsInclVat ?? vals.totalCosts);
  const pctChanges = [-20, -10, 0, 10, 20];

  const sensHeaders = ['הכנסות \\ עלויות', ...pctChanges.map((p) => `${p >= 0 ? '+' : ''}${p}% עלויות`)];
  for (let i = 0; i < sensHeaders.length; i++) ws.getCell(row, i + 1).value = sensHeaders[i];
  styleRow(ws, row, sensHeaders.length, SUBHEADER_FILL, SUBHEADER_FONT);
  row++;

  for (const revPct of pctChanges) {
    const adjRev = baseRevenue * (1 + revPct / 100);
    ws.getCell(row, 1).value = `${revPct >= 0 ? '+' : ''}${revPct}% הכנסות`;
    for (let ci = 0; ci < pctChanges.length; ci++) {
      const adjCost = baseCosts * (1 + pctChanges[ci] / 100);
      const sensProfit = Math.round(adjRev - adjCost);
      const cell = ws.getCell(row, ci + 2);
      cell.value = sensProfit;
      cell.numFmt = CURRENCY_FMT;
      if (sensProfit < 0) cell.font = RED_FONT;
      else if (sensProfit > 0) cell.font = GREEN_FONT;
      if (revPct === 0 && pctChanges[ci] === 0) cell.fill = YELLOW_FILL;
    }
    styleRow(ws, row, sensHeaders.length);
    row++;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
