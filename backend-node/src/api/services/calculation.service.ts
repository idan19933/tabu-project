/**
 * Financial calculation engine for real estate feasibility simulations.
 *
 * Implements all formulas from the Shikun & Binui pilot Excel spec:
 *   Section 2: מצב יוצא (proposed state)
 *   Section 3: פרוגרמה (program)
 *   Section 4: עלויות (costs)
 *   Section 5: הכנסות + רווח (revenue + profit)
 */
import { irr as calcIrr, npv as calcNpv } from 'financial';
import { safe } from '../../utils/safe';
import type { SimParams, ProposedState, BuildingProgram } from '../../types/simulation';
import type { CostBreakdown, RevenueBreakdown, FinancialResults } from '../../types/calculation';

// ─── Validation ──────────────────────────────────────────────────────────────

const REQUIRED_PLANNING_FIELDS: Record<string, string> = {
  returnsPercent: '% החזר (תמורות)',
  avgAptSizeSqm: 'שטח דירה ממוצע (מ"ר)',
  numberOfFloors: 'מספר קומות',
  coverageAboveGround: '% כיסוי מעל קרקע',
  grossAreaPerParking: 'שטח ברוטו לחנייה (מ"ר)',
  parkingStandardRatio: 'יחס חנייה לדירה',
};

const REQUIRED_COST_FIELDS: Record<string, string> = {
  costPerSqmResidential: 'עלות בנייה למגורים (₪/מ"ר)',
  constructionDurationMonths: 'משך בנייה (חודשים)',
};

const REQUIRED_REVENUE_FIELDS: Record<string, string> = {
  pricePerSqmResidential: 'מחיר מכירה למגורים (₪/מ"ר)',
};

export function validateSimulationReady(sim: any): any {
  const missingPlanning: string[] = [];
  const missingCost: string[] = [];
  const missingRevenue: string[] = [];
  const warnings: string[] = [];
  let missingMix = false;

  const pp = sim.planningParameters;
  const cp = sim.costParameters;
  const rp = sim.revenueParameters;
  const ep = sim.economicParameters;
  const mix = sim.apartmentMix;

  // Planning
  if (!pp) {
    missingPlanning.push(...Object.values(REQUIRED_PLANNING_FIELDS));
  } else {
    for (const [field, label] of Object.entries(REQUIRED_PLANNING_FIELDS)) {
      if (safe((pp as any)[field]) === 0) missingPlanning.push(label);
    }
  }

  // Cost — new tables OR legacy
  if (cp) {
    for (const [field, label] of Object.entries(REQUIRED_COST_FIELDS)) {
      if (safe((cp as any)[field]) === 0) missingCost.push(label);
    }
  } else if (ep) {
    if (safe(ep.costConstructionDev) === 0) missingCost.push(REQUIRED_COST_FIELDS.costPerSqmResidential);
    if (safe(ep.timelineMonths) === 0) missingCost.push(REQUIRED_COST_FIELDS.constructionDurationMonths);
  } else {
    missingCost.push(...Object.values(REQUIRED_COST_FIELDS));
  }

  // Revenue — new tables OR legacy
  if (rp) {
    for (const [field, label] of Object.entries(REQUIRED_REVENUE_FIELDS)) {
      if (safe((rp as any)[field]) === 0) missingRevenue.push(label);
    }
  } else if (ep) {
    const prices = (ep.salesPricesByUse as any) || {};
    if (safe(prices.residential) === 0) missingRevenue.push(REQUIRED_REVENUE_FIELDS.pricePerSqmResidential);
  } else {
    missingRevenue.push(...Object.values(REQUIRED_REVENUE_FIELDS));
  }

  // Apartment mix
  if (!mix || mix.length === 0) {
    missingMix = true;
  } else {
    const totalQty = mix.reduce((sum: number, a: any) => sum + safe(a.quantity), 0);
    if (totalQty === 0) missingMix = true;
  }

  // Warnings
  if (pp && safe(pp.avgAptSizeSqm) < 30 && safe(pp.avgAptSizeSqm) > 0) {
    warnings.push('שטח דירה ממוצע מתחת ל-30 מ"ר — בדוק שוב');
  }
  if (cp && safe(cp.financingInterestRate) > 20) {
    warnings.push('ריבית מימון מעל 20% — בדוק שוב');
  }

  const ready = missingPlanning.length === 0 && missingCost.length === 0 && missingRevenue.length === 0 && !missingMix;

  return {
    ready,
    missing_planning: missingPlanning,
    missing_cost: missingCost,
    missing_revenue: missingRevenue,
    missing_mix: missingMix,
    warnings,
    missing_economic: [...missingCost, ...missingRevenue],
  };
}

// ─── Core helpers ────────────────────────────────────────────────────────────

function calculateProfit(totalRevenue: number, totalCosts: number): number {
  return totalRevenue - totalCosts;
}

function calculateProfitabilityRate(profit: number, totalCosts: number): number {
  if (totalCosts === 0) return 0;
  return (profit / totalCosts) * 100;
}

function calculateNpv(cashFlows: number[], discountRate: number): number {
  if (!cashFlows.length || discountRate === 0) return 0;
  return calcNpv(discountRate, cashFlows);
}

function calculateIrr(cashFlows: number[]): number {
  if (cashFlows.length < 2) return 0;
  try {
    const result = calcIrr(cashFlows);
    if (result == null || isNaN(result)) return 0;
    return result * 100; // annualized percentage
  } catch {
    return 0;
  }
}

// ─── Extract params from Prisma simulation ───────────────────────────────────

export function extractParams(sim: any): SimParams {
  const pp = sim.planningParameters;
  const cp = sim.costParameters;
  const rp = sim.revenueParameters;
  const ep = sim.economicParameters;
  const mix = sim.apartmentMix || [];

  const p: SimParams = {
    returnsPct: 0, avgAptSize: 0, numFloors: 0, coverageAbove: 0, coverageUnder: 0,
    grossPerParking: 35, parkingRatio: 1.5, multiplierFar: 0, returnAreaPerApt: 0,
    serviceAreaPct: 0.15, serviceAreaSqm: 0, publicArea: 0, parkingFloorArea: 0,
    balconyPerUnit: 12, blueLineArea: 0,
    costSqmRes: 0, costSqmService: 0, costSqmCommercial: 0, costSqmBalcony: 0,
    costSqmDevelopment: 0, constructionDuration: 36, financingRate: 0.055,
    vatRate: 0.17, cpiPct: 0,
    priceSqmRes: 0, priceSqmComm: 0, pricePerUnitByType: {}, salesPace: 0,
    marketingDiscountPct: 0,
    constructionTotalOverride: 0, parkingConstructionOverride: 0,
    bettermentLevy: 0, purchaseTax: 0, planningConsultants: 0, permitsFees: 0,
    electricityConnection: 0, bankSupervision: 0, engineeringManagement: 0,
    tenantSupervision: 0, managementOverhead: 0, marketingAdvertising: 0,
    tenantLawyer: 0, initiationFee: 0, rentSubsidy: 0, evacuationCost: 0,
    movingCost: 0, contingency: 0, developerLawyer: 0, demolition: 0,
    planningConsultantsPct: 0, permitsFeesPct: 0, bankSupervisionPct: 0,
    engineeringManagementPct: 0, tenantSupervisionPct: 0, managementOverheadPct: 0,
    marketingAdvertisingPct: 0, tenantLawyerPct: 0, developerLawyerPct: 0,
    contingencyPct: 0, initiationFeePct: 0,
    mix: mix.map((m: any) => ({
      apartmentType: m.apartmentType,
      quantity: safe(m.quantity),
      percentageOfMix: safe(m.percentageOfMix),
    })),
    hasNewCost: false, hasNewRevenue: false, hasLegacyEp: false,
    legacyCostPlanningPct: 0, legacyLeviesPct: 0,
  };

  // Planning
  if (pp) {
    p.returnsPct = safe(pp.returnsPercent) / 100;
    p.avgAptSize = safe(pp.avgAptSizeSqm);
    p.numFloors = safe(pp.numberOfFloors);
    p.coverageAbove = safe(pp.coverageAboveGround) / 100;
    p.coverageUnder = safe(pp.coverageUnderground, 0) / 100;
    p.grossPerParking = safe(pp.grossAreaPerParking) || 35;
    p.parkingRatio = safe(pp.parkingStandardRatio) || 1.5;
    p.multiplierFar = safe(pp.multiplierFar);
    p.returnAreaPerApt = safe(pp.returnAreaPerApt);
    p.serviceAreaPct = safe(pp.serviceAreaPercent, 15) / 100;
    p.serviceAreaSqm = safe(pp.serviceAreaSqm);
    p.publicArea = safe(pp.publicAreaSqm);
    p.parkingFloorArea = safe(pp.parkingFloorArea);
    p.balconyPerUnit = safe(pp.balconyAreaPerUnit, 12);
    p.blueLineArea = safe(pp.blueLineArea);
  }

  // Cost
  if (cp) {
    p.hasNewCost = true;
    p.costSqmRes = safe(cp.costPerSqmResidential);
    p.costSqmService = safe(cp.costPerSqmService, p.costSqmRes * 0.5);
    p.costSqmCommercial = safe(cp.costPerSqmCommercial, p.costSqmRes * 0.7);
    p.costSqmBalcony = safe(cp.costPerSqmBalcony, p.costSqmRes * 0.3);
    p.costSqmDevelopment = safe(cp.costPerSqmDevelopment);
    p.constructionDuration = Math.round(safe(cp.constructionDurationMonths, 36));
    p.financingRate = safe(cp.financingInterestRate, 5.5) / 100;
    p.vatRate = safe(cp.vatRate, 17) / 100;
    p.cpiPct = safe(cp.cpiLinkagePct) / 100;
    p.constructionTotalOverride = safe(cp.constructionTotal);
    p.parkingConstructionOverride = safe(cp.parkingConstruction);
    p.bettermentLevy = safe(cp.bettermentLevy);
    p.purchaseTax = safe(cp.purchaseTax);
    p.planningConsultants = safe(cp.planningConsultants);
    p.permitsFees = safe(cp.permitsFees);
    p.electricityConnection = safe(cp.electricityConnection);
    p.bankSupervision = safe(cp.bankSupervision);
    p.engineeringManagement = safe(cp.engineeringManagement);
    p.tenantSupervision = safe(cp.tenantSupervision);
    p.managementOverhead = safe(cp.managementOverhead);
    p.marketingAdvertising = safe(cp.marketingAdvertising);
    p.tenantLawyer = safe(cp.tenantLawyer);
    p.initiationFee = safe(cp.initiationFee);
    p.rentSubsidy = safe(cp.rentSubsidy);
    p.evacuationCost = safe(cp.evacuationCost);
    p.movingCost = safe(cp.movingCost);
    p.contingency = safe(cp.contingency);
    p.developerLawyer = safe(cp.developerLawyer);
    p.demolition = safe(cp.demolition);
    p.planningConsultantsPct = safe(cp.planningConsultantsPct);
    p.permitsFeesPct = safe(cp.permitsFeesPct);
    p.bankSupervisionPct = safe(cp.bankSupervisionPct);
    p.engineeringManagementPct = safe(cp.engineeringManagementPct);
    p.tenantSupervisionPct = safe(cp.tenantSupervisionPct);
    p.managementOverheadPct = safe(cp.managementOverheadPct);
    p.marketingAdvertisingPct = safe(cp.marketingAdvertisingPct);
    p.tenantLawyerPct = safe(cp.tenantLawyerPct);
    p.developerLawyerPct = safe(cp.developerLawyerPct);
    p.contingencyPct = safe(cp.contingencyPct);
    p.initiationFeePct = safe(cp.initiationFeePct);
  } else if (ep) {
    p.hasLegacyEp = true;
    p.costSqmRes = safe(ep.costConstructionDev);
    p.costSqmService = p.costSqmRes * 0.5;
    p.costSqmCommercial = p.costSqmRes * 0.7;
    p.costSqmBalcony = p.costSqmRes * 0.3;
    p.constructionDuration = Math.round(safe(ep.timelineMonths, 36));
    p.financingRate = safe(ep.interestRate, 5.5) / 100;
    p.legacyCostPlanningPct = safe(ep.costPlanningMgmt);
    p.legacyLeviesPct = safe(ep.leviesFeesTaxes);
  }

  // Revenue
  if (rp) {
    p.hasNewRevenue = true;
    p.priceSqmRes = safe(rp.pricePerSqmResidential);
    p.priceSqmComm = safe(rp.pricePerSqmCommercial);
    p.pricePerUnitByType = (rp.pricePerUnitByType as Record<string, number>) || {};
    p.salesPace = safe(rp.salesPacePerMonth);
    p.marketingDiscountPct = safe(rp.marketingDiscountPct);
  } else if (ep) {
    p.hasLegacyEp = true;
    const prices = (ep.salesPricesByUse as any) || {};
    p.priceSqmRes = safe(prices.residential);
    p.priceSqmComm = safe(prices.commercial);
    p.salesPace = safe(ep.salesPacePerMonth);
    p.marketingDiscountPct = safe(ep.marketingDiscountPct);
  }

  return p;
}

// ─── Section 2: מצב יוצא (Proposed State) ────────────────────────────────────

export function calcProposedState(params: SimParams): ProposedState {
  const totalUnits = params.mix.reduce((sum, a) => sum + a.quantity, 0);
  const totalResidentialArea = totalUnits * params.avgAptSize;

  const returnUnits = params.returnsPct > 0 ? Math.ceil(totalUnits * params.returnsPct) : 0;
  const totalReturnFloorplate =
    params.returnAreaPerApt > 0
      ? returnUnits * params.returnAreaPerApt
      : returnUnits * params.avgAptSize;

  const developerUnits = totalUnits - returnUnits;
  const developerFloorplate = totalResidentialArea - totalReturnFloorplate;
  const avgDeveloperUnitSize = developerUnits > 0 ? developerFloorplate / developerUnits : 0;
  const combinationRatio = totalReturnFloorplate > 0 ? developerFloorplate / totalReturnFloorplate : 0;

  return {
    totalUnits,
    totalResidentialArea,
    returnUnits,
    totalReturnFloorplate,
    developerUnits,
    developerFloorplate,
    avgDeveloperUnitSize,
    combinationRatio,
  };
}

// ─── Section 3: פרוגרמה (Program) ────────────────────────────────────────────

export function calcBuildingProgram(params: SimParams, proposed: ProposedState): BuildingProgram {
  const serviceAreas =
    params.serviceAreaSqm > 0
      ? params.serviceAreaSqm
      : proposed.totalResidentialArea * params.serviceAreaPct;

  const totalAboveGround = proposed.totalResidentialArea + serviceAreas + params.publicArea;

  let floorArea: number;
  if (params.blueLineArea > 0 && params.coverageAbove > 0) {
    floorArea = params.blueLineArea * params.coverageAbove;
  } else if (totalAboveGround > 0 && params.numFloors > 0) {
    floorArea = totalAboveGround / params.numFloors;
  } else {
    floorArea = 0;
  }

  let maxBuildings: number;
  if (floorArea > 0 && totalAboveGround > 0 && params.numFloors > 0) {
    maxBuildings = Math.max(1, Math.ceil(totalAboveGround / (floorArea * params.numFloors)));
  } else {
    maxBuildings = 1;
  }

  const aboveGroundPerBuilding = maxBuildings > 0 ? totalAboveGround / maxBuildings : totalAboveGround;

  let developmentLand: number;
  if (params.blueLineArea > 0 && params.coverageUnder > 0) {
    developmentLand = params.blueLineArea * params.coverageUnder;
  } else if (params.parkingFloorArea > 0) {
    developmentLand = params.parkingFloorArea;
  } else {
    developmentLand = floorArea > 0 ? floorArea * 1.2 : 0;
  }

  const residentialPerBuilding = maxBuildings > 0 ? proposed.totalResidentialArea / maxBuildings : proposed.totalResidentialArea;
  const returnUnitsPerBuilding = maxBuildings > 0 ? proposed.returnUnits / maxBuildings : proposed.returnUnits;
  const developerUnitsPerBuilding = maxBuildings > 0 ? proposed.developerUnits / maxBuildings : proposed.developerUnits;
  const developerFloorplatePerBuilding = maxBuildings > 0 ? proposed.developerFloorplate / maxBuildings : proposed.developerFloorplate;

  const totalParkingSpots = Math.ceil(proposed.totalUnits * params.parkingRatio);
  const totalParkingArea = totalParkingSpots * params.grossPerParking;
  const parkingFloors = developmentLand > 0 ? totalParkingArea / developmentLand : 0;

  const totalBalconyArea = proposed.totalUnits * params.balconyPerUnit;

  return {
    serviceAreas,
    totalAboveGround,
    floorArea,
    maxBuildings,
    aboveGroundPerBuilding,
    developmentLand,
    residentialPerBuilding,
    returnUnitsPerBuilding,
    developerUnitsPerBuilding,
    developerFloorplatePerBuilding,
    totalParkingSpots,
    totalParkingArea,
    parkingFloors,
    totalBalconyArea,
  };
}

// ─── Section 4: עלויות (Costs) ──────────────────────────────────────────────

function resolveCost(absolute: number, pct: number, base: number): number {
  if (absolute > 0) return absolute;
  if (pct > 0) return base * (pct / 100);
  return 0;
}

export function calcCosts(params: SimParams, proposed: ProposedState, program: BuildingProgram): CostBreakdown {
  const constructionResidential = proposed.developerFloorplate * params.costSqmRes;
  const constructionService = program.serviceAreas * params.costSqmService;
  const constructionPublic = params.publicArea * params.costSqmCommercial;
  const constructionBalcony = program.totalBalconyArea * params.costSqmBalcony;
  const constructionDevelopment = program.developmentLand * params.costSqmDevelopment;

  const parkingConstruction =
    params.parkingConstructionOverride > 0
      ? params.parkingConstructionOverride
      : program.totalParkingArea * params.costSqmRes * 0.4;

  const constructionCost =
    params.constructionTotalOverride > 0
      ? params.constructionTotalOverride
      : constructionResidential + constructionService + constructionPublic +
        constructionBalcony + constructionDevelopment + parkingConstruction;

  // Resolve percentage-based costs
  const resolvedPlanningConsultants = resolveCost(params.planningConsultants, params.planningConsultantsPct, constructionCost);
  const resolvedPermitsFees = resolveCost(params.permitsFees, params.permitsFeesPct, constructionCost);
  const resolvedBankSupervision = resolveCost(params.bankSupervision, params.bankSupervisionPct, constructionCost);
  const resolvedEngineeringMgmt = resolveCost(params.engineeringManagement, params.engineeringManagementPct, constructionCost);
  const resolvedTenantSupervision = resolveCost(params.tenantSupervision, params.tenantSupervisionPct, constructionCost);
  const resolvedManagementOverhead = resolveCost(params.managementOverhead, params.managementOverheadPct, constructionCost);
  const resolvedMarketingAdv = resolveCost(params.marketingAdvertising, params.marketingAdvertisingPct, constructionCost);
  const resolvedTenantLawyer = resolveCost(params.tenantLawyer, params.tenantLawyerPct, constructionCost);
  const resolvedDeveloperLawyer = resolveCost(params.developerLawyer, params.developerLawyerPct, constructionCost);
  const resolvedContingency = resolveCost(params.contingency, params.contingencyPct, constructionCost);
  const resolvedInitiationFee = resolveCost(params.initiationFee, params.initiationFeePct, constructionCost);

  // Legacy cost model fallback
  let planningCost: number;
  let leviesCost: number;
  if (!params.hasNewCost && params.hasLegacyEp) {
    planningCost = constructionCost * (params.legacyCostPlanningPct / 100);
    leviesCost = constructionCost * (params.legacyLeviesPct / 100);
  } else {
    planningCost = resolvedPlanningConsultants + resolvedPermitsFees + resolvedEngineeringMgmt;
    leviesCost = params.bettermentLevy + params.purchaseTax;
  }

  const additionalCosts =
    params.bettermentLevy + params.purchaseTax + resolvedPlanningConsultants +
    resolvedPermitsFees + params.electricityConnection + resolvedBankSupervision +
    resolvedEngineeringMgmt + resolvedTenantSupervision + resolvedManagementOverhead +
    resolvedMarketingAdv + resolvedTenantLawyer + resolvedInitiationFee +
    params.rentSubsidy + params.evacuationCost + params.movingCost +
    resolvedContingency + resolvedDeveloperLawyer + params.demolition;

  let totalCostsExclVat = constructionCost + additionalCosts;

  // CPI linkage
  if (params.cpiPct > 0) {
    totalCostsExclVat += totalCostsExclVat * params.cpiPct * (params.constructionDuration / 12);
  }

  // Financing
  const avgOutstanding = totalCostsExclVat * 0.5;
  const financingCost = avgOutstanding * params.financingRate * (params.constructionDuration / 12);
  totalCostsExclVat += financingCost;

  // VAT
  const totalCostsInclVat = totalCostsExclVat * (1 + params.vatRate);
  const totalCosts = totalCostsInclVat;

  return {
    constructionResidential,
    constructionService,
    constructionPublic,
    constructionBalcony,
    constructionDevelopment,
    parkingConstruction,
    constructionCost,
    bettermentLevy: params.bettermentLevy,
    purchaseTax: params.purchaseTax,
    planningConsultants: resolvedPlanningConsultants,
    permitsFees: resolvedPermitsFees,
    electricityConnection: params.electricityConnection,
    bankSupervision: resolvedBankSupervision,
    engineeringManagement: resolvedEngineeringMgmt,
    tenantSupervision: resolvedTenantSupervision,
    managementOverhead: resolvedManagementOverhead,
    marketingAdvertising: resolvedMarketingAdv,
    tenantLawyer: resolvedTenantLawyer,
    initiationFee: resolvedInitiationFee,
    rentSubsidy: params.rentSubsidy,
    evacuationCost: params.evacuationCost,
    movingCost: params.movingCost,
    contingency: resolvedContingency,
    developerLawyer: resolvedDeveloperLawyer,
    demolition: params.demolition,
    additionalCosts,
    financingCost,
    totalCostsExclVat,
    totalCostsInclVat,
    totalCosts,
    planningCost,
    leviesCost,
  };
}

// ─── Section 5: הכנסות + רווח (Revenue + Profit) ────────────────────────────

export function calcRevenue(
  params: SimParams,
  proposed: ProposedState,
  program: BuildingProgram,
  costs: CostBreakdown
): RevenueBreakdown {
  let residentialRevenue: number;

  if (Object.keys(params.pricePerUnitByType).length > 0 && params.mix.length > 0) {
    residentialRevenue = 0;
    for (const am of params.mix) {
      const qty = am.quantity;
      const developerQty = Math.max(0, qty - Math.ceil(qty * params.returnsPct));
      const typePrice = params.pricePerUnitByType[am.apartmentType] || 0;
      if (typePrice > 0) {
        residentialRevenue += developerQty * typePrice;
      } else {
        residentialRevenue += developerQty * params.avgAptSize * params.priceSqmRes;
      }
    }
  } else {
    residentialRevenue = proposed.developerFloorplate * params.priceSqmRes;
  }

  const commercialRevenue = params.priceSqmComm > 0 ? params.publicArea * params.priceSqmComm : 0;
  const parkingRevenue = 0;
  const storageRevenue = 0;

  const totalRevenue = residentialRevenue + commercialRevenue + parkingRevenue + storageRevenue;

  let marketingDiscount = 0;
  let netRevenue = totalRevenue;
  if (params.marketingDiscountPct > 0) {
    marketingDiscount = totalRevenue * (params.marketingDiscountPct / 100);
    netRevenue = totalRevenue - marketingDiscount;
  }

  const expectedProfit = netRevenue - costs.totalCosts;
  const profitPercent = costs.totalCosts > 0 ? (expectedProfit / costs.totalCosts) * 100 : 0;
  const profitPercentStandard21 = netRevenue > 0 ? (expectedProfit / netRevenue) * 100 : 0;

  return {
    residentialRevenue,
    commercialRevenue,
    parkingRevenue,
    storageRevenue,
    totalRevenue,
    marketingDiscount,
    netRevenue,
    expectedProfit,
    profitPercent,
    profitPercentStandard21,
  };
}

// ─── Cash Flow / IRR / NPV ──────────────────────────────────────────────────

export function calcCashflowIrrNpv(
  params: SimParams,
  proposed: ProposedState,
  costs: CostBreakdown,
  revenue: RevenueBreakdown
): FinancialResults {
  const timeline = params.constructionDuration;
  const monthlyRate = params.financingRate / 12;

  let salesPace: number;
  if (params.salesPace > 0) {
    salesPace = params.salesPace;
  } else {
    const salesMonths = Math.max(1, Math.floor(timeline * 0.6));
    salesPace = salesMonths > 0 ? proposed.developerUnits / salesMonths : proposed.developerUnits;
  }

  const constructionMonths = Math.max(1, Math.floor(timeline * 0.8));
  const monthlyCost = constructionMonths > 0 ? -costs.totalCosts / constructionMonths : 0;

  const salesStart = Math.max(1, Math.floor(timeline * 0.4));
  const pricePerUnit = revenue.netRevenue / Math.max(proposed.developerUnits, 1);
  const monthlyRevenue =
    proposed.developerUnits > 0 ? Math.min(salesPace, proposed.developerUnits) * pricePerUnit : 0;

  const cashFlows: number[] = [];
  let remainingRevenue = revenue.netRevenue;
  for (let month = 0; month < timeline; month++) {
    let cf = 0;
    if (month < constructionMonths) cf += monthlyCost;
    if (month >= salesStart && remainingRevenue > 0) {
      const rev = Math.min(monthlyRevenue, remainingRevenue);
      cf += rev;
      remainingRevenue -= rev;
    }
    cashFlows.push(Math.round(cf * 100) / 100);
  }

  const irrVal = calculateIrr(cashFlows);
  const npvVal = calculateNpv(cashFlows, monthlyRate);

  return { cashFlows, irr: irrVal, npv: npvVal };
}

// ─── Main calculation engine ─────────────────────────────────────────────────

export function runCalculations(sim: any): any {
  const params = extractParams(sim);
  const proposed = calcProposedState(params);
  const program = calcBuildingProgram(params, proposed);
  const costs = calcCosts(params, proposed, program);

  const rp = sim.revenueParameters;

  // Calculate revenue
  const rev = calcRevenue(params, proposed, program, costs);

  // Patch parking and storage revenue (needs direct rp access)
  if (rp && safe(rp.pricePerSqmParking) > 0) {
    rev.parkingRevenue = program.totalParkingSpots * safe(rp.pricePerSqmParking);
  }
  if (rp && safe(rp.pricePerSqmStorage) > 0) {
    rev.storageRevenue = proposed.developerUnits * 5 * safe(rp.pricePerSqmStorage);
  }

  // Recalculate totals after patching
  rev.totalRevenue = rev.residentialRevenue + rev.commercialRevenue + rev.parkingRevenue + rev.storageRevenue;
  if (params.marketingDiscountPct > 0) {
    rev.marketingDiscount = rev.totalRevenue * (params.marketingDiscountPct / 100);
    rev.netRevenue = rev.totalRevenue - rev.marketingDiscount;
  } else {
    rev.netRevenue = rev.totalRevenue;
  }
  rev.expectedProfit = rev.netRevenue - costs.totalCosts;
  rev.profitPercent = costs.totalCosts > 0 ? (rev.expectedProfit / costs.totalCosts) * 100 : 0;
  rev.profitPercentStandard21 = rev.netRevenue > 0 ? (rev.expectedProfit / rev.netRevenue) * 100 : 0;

  const financial = calcCashflowIrrNpv(params, proposed, costs, rev);

  const r = (n: number) => Math.round(n * 100) / 100;

  const costBreakdown = {
    construction_residential: r(costs.constructionResidential),
    construction_service: r(costs.constructionService),
    construction_public: r(costs.constructionPublic),
    construction_balcony: r(costs.constructionBalcony),
    construction_development: r(costs.constructionDevelopment),
    parking_construction: r(costs.parkingConstruction),
    betterment_levy: r(costs.bettermentLevy),
    purchase_tax: r(costs.purchaseTax),
    planning_consultants: r(costs.planningConsultants),
    permits_fees: r(costs.permitsFees),
    electricity_connection: r(costs.electricityConnection),
    bank_supervision: r(costs.bankSupervision),
    engineering_management: r(costs.engineeringManagement),
    tenant_supervision: r(costs.tenantSupervision),
    management_overhead: r(costs.managementOverhead),
    marketing_advertising: r(costs.marketingAdvertising),
    tenant_lawyer: r(costs.tenantLawyer),
    initiation_fee: r(costs.initiationFee),
    rent_subsidy: r(costs.rentSubsidy),
    evacuation_cost: r(costs.evacuationCost),
    moving_cost: r(costs.movingCost),
    contingency: r(costs.contingency),
    developer_lawyer: r(costs.developerLawyer),
    demolition: r(costs.demolition),
    financing_cost: r(costs.financingCost),
  };

  const revenueBreakdown = {
    residential: r(rev.residentialRevenue),
    commercial: r(rev.commercialRevenue),
    parking: r(rev.parkingRevenue),
    storage: r(rev.storageRevenue),
    marketing_discount: r(rev.marketingDiscount),
  };

  const areaBreakdown = {
    total_residential_area: r(proposed.totalResidentialArea),
    return_floorplate: r(proposed.totalReturnFloorplate),
    developer_floorplate: r(proposed.developerFloorplate),
    service_areas: r(program.serviceAreas),
    public_area: r(params.publicArea),
    total_above_ground: r(program.totalAboveGround),
    total_parking_area: r(program.totalParkingArea),
    total_balcony_area: r(program.totalBalconyArea),
    development_land: r(program.developmentLand),
  };

  const calculationDetails = {
    assumptions: {
      returns_percent: params.returnsPct * 100,
      avg_apt_size_sqm: params.avgAptSize,
      num_floors: params.numFloors,
      coverage_above_ground_pct: params.coverageAbove * 100,
      parking_ratio: params.parkingRatio,
      service_area_pct: params.serviceAreaPct * 100,
      balcony_per_unit: params.balconyPerUnit,
      financing_rate_pct: params.financingRate * 100,
      vat_rate_pct: params.vatRate * 100,
      construction_duration_months: params.constructionDuration,
      cost_per_sqm_residential: params.costSqmRes,
      price_per_sqm_residential: params.priceSqmRes,
    },
    cost_breakdown: costBreakdown,
    revenue_breakdown: revenueBreakdown,
    area_breakdown: areaBreakdown,
  };

  return {
    profit: r(rev.expectedProfit),
    profitabilityRate: r(rev.profitPercent),
    irr: r(financial.irr),
    npv: r(financial.npv),
    totalRevenue: r(rev.totalRevenue),
    netRevenue: r(rev.netRevenue),
    totalCosts: r(costs.totalCosts),
    constructionCost: r(costs.constructionCost),
    planningCost: r(costs.planningCost),
    leviesCost: r(costs.leviesCost),
    totalUnits: proposed.totalUnits,
    totalResidentialArea: r(proposed.totalResidentialArea),
    residentialRevenue: r(rev.residentialRevenue),
    commercialRevenue: r(rev.commercialRevenue),
    monthlyCashFlows: financial.cashFlows,
    calculationDetails,
    totalReturnFloorplate: r(proposed.totalReturnFloorplate),
    totalNewUnits: proposed.totalUnits,
    totalFloorplate: r(proposed.totalResidentialArea),
    developerUnits: proposed.developerUnits,
    developerFloorplate: r(proposed.developerFloorplate),
    avgDeveloperUnitSize: r(proposed.avgDeveloperUnitSize),
    combinationRatio: r(proposed.combinationRatio),
    serviceAreas: r(program.serviceAreas),
    totalAboveGround: r(program.totalAboveGround),
    floorArea: r(program.floorArea),
    maxBuildings: program.maxBuildings,
    aboveGroundPerBuilding: r(program.aboveGroundPerBuilding),
    developmentLand: r(program.developmentLand),
    residentialPerBuilding: r(program.residentialPerBuilding),
    returnUnitsPerBuilding: r(program.returnUnitsPerBuilding),
    developerUnitsPerBuilding: r(program.developerUnitsPerBuilding),
    developerFloorplatePerBldg: r(program.developerFloorplatePerBuilding),
    totalParkingSpots: program.totalParkingSpots,
    totalParkingArea: r(program.totalParkingArea),
    parkingFloors: r(program.parkingFloors),
    totalBalconyArea: r(program.totalBalconyArea),
    financingCost: r(costs.financingCost),
    totalCostsExclVat: r(costs.totalCostsExclVat),
    totalCostsInclVat: r(costs.totalCostsInclVat),
    expectedProfit: r(rev.expectedProfit),
    profitPercent: r(rev.profitPercent),
    profitPercentStd21: r(rev.profitPercentStandard21),
    costBreakdown,
    revenueBreakdown,
    areaBreakdown,
  };
}
