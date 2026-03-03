import { SimulationStatus } from '../../../prisma/generated/prisma/client';
import * as simulationDA from '../data-access/simulation.data-access';
import * as paramDA from '../data-access/parameter.data-access';
import { HttpError } from '../../lib/HttpError';
import { prisma } from '../../config/prisma';

// Snake_case → camelCase field mapping for planning parameters
function mapPlanningToCamel(data: any) {
  if (!data) return undefined;
  const map: Record<string, string> = {
    returns_percent: 'returnsPercent',
    multiplier_far: 'multiplierFar',
    avg_apt_size_sqm: 'avgAptSizeSqm',
    service_area_sqm: 'serviceAreaSqm',
    number_of_floors: 'numberOfFloors',
    coverage_above_ground: 'coverageAboveGround',
    coverage_underground: 'coverageUnderground',
    gross_area_per_parking: 'grossAreaPerParking',
    building_lines_notes: 'buildingLinesNotes',
    public_tasks_notes: 'publicTasksNotes',
    parking_standard_ratio: 'parkingStandardRatio',
    typ_floor_area_min: 'typFloorAreaMin',
    typ_floor_area_max: 'typFloorAreaMax',
    apts_per_floor_min: 'aptsPerFloorMin',
    apts_per_floor_max: 'aptsPerFloorMax',
    return_area_per_apt: 'returnAreaPerApt',
    service_area_percent: 'serviceAreaPercent',
    public_area_sqm: 'publicAreaSqm',
    parking_floor_area: 'parkingFloorArea',
    balcony_area_per_unit: 'balconyAreaPerUnit',
    blue_line_area: 'blueLineArea',
    planning_stage: 'planningStage',
  };
  const result: any = {};
  for (const [key, val] of Object.entries(data)) {
    const camelKey = map[key] || key;
    result[camelKey] = val;
  }
  return result;
}

// Snake_case → camelCase field mapping for cost parameters
function mapCostToCamel(data: any) {
  if (!data) return undefined;
  const map: Record<string, string> = {
    construction_duration_months: 'constructionDurationMonths',
    cost_per_sqm_residential: 'costPerSqmResidential',
    cost_per_sqm_service: 'costPerSqmService',
    cost_per_sqm_commercial: 'costPerSqmCommercial',
    cost_per_sqm_balcony: 'costPerSqmBalcony',
    cost_per_sqm_development: 'costPerSqmDevelopment',
    betterment_levy: 'bettermentLevy',
    purchase_tax: 'purchaseTax',
    planning_consultants: 'planningConsultants',
    permits_fees: 'permitsFees',
    electricity_connection: 'electricityConnection',
    bank_supervision: 'bankSupervision',
    engineering_management: 'engineeringManagement',
    tenant_supervision: 'tenantSupervision',
    management_overhead: 'managementOverhead',
    marketing_advertising: 'marketingAdvertising',
    tenant_lawyer: 'tenantLawyer',
    initiation_fee: 'initiationFee',
    developer_lawyer: 'developerLawyer',
    rent_subsidy: 'rentSubsidy',
    evacuation_cost: 'evacuationCost',
    moving_cost: 'movingCost',
    contingency: 'contingency',
    demolition: 'demolition',
    construction_total: 'constructionTotal',
    parking_construction: 'parkingConstruction',
    financing_interest_rate: 'financingInterestRate',
    vat_rate: 'vatRate',
    cpi_linkage_pct: 'cpiLinkagePct',
    planning_consultants_pct: 'planningConsultantsPct',
    permits_fees_pct: 'permitsFeesPct',
    bank_supervision_pct: 'bankSupervisionPct',
    engineering_management_pct: 'engineeringManagementPct',
    tenant_supervision_pct: 'tenantSupervisionPct',
    management_overhead_pct: 'managementOverheadPct',
    marketing_advertising_pct: 'marketingAdvertisingPct',
    tenant_lawyer_pct: 'tenantLawyerPct',
    developer_lawyer_pct: 'developerLawyerPct',
    contingency_pct: 'contingencyPct',
    initiation_fee_pct: 'initiationFeePct',
  };
  const result: any = {};
  for (const [key, val] of Object.entries(data)) {
    const camelKey = map[key] || key;
    result[camelKey] = val;
  }
  return result;
}

// Snake_case → camelCase field mapping for revenue parameters
function mapRevenueToCamel(data: any) {
  if (!data) return undefined;
  const map: Record<string, string> = {
    price_per_unit_by_type: 'pricePerUnitByType',
    price_per_sqm_residential: 'pricePerSqmResidential',
    price_per_sqm_commercial: 'pricePerSqmCommercial',
    sales_pace_per_month: 'salesPacePerMonth',
    marketing_discount_pct: 'marketingDiscountPct',
    price_per_sqm_parking: 'pricePerSqmParking',
    price_per_sqm_storage: 'pricePerSqmStorage',
  };
  const result: any = {};
  for (const [key, val] of Object.entries(data)) {
    const camelKey = map[key] || key;
    result[camelKey] = val;
  }
  return result;
}

function mapEconomicToCamel(data: any) {
  if (!data) return undefined;
  const map: Record<string, string> = {
    sales_prices_by_use: 'salesPricesByUse',
    cost_construction_dev: 'costConstructionDev',
    cost_planning_mgmt: 'costPlanningMgmt',
    levies_fees_taxes: 'leviesFeesTaxes',
    timeline_months: 'timelineMonths',
    interest_rate: 'interestRate',
    sales_pace_per_month: 'salesPacePerMonth',
    marketing_discount_pct: 'marketingDiscountPct',
  };
  const result: any = {};
  for (const [key, val] of Object.entries(data)) {
    const camelKey = map[key] || key;
    result[camelKey] = val;
  }
  return result;
}

function mapMixToCamel(items: any[]) {
  return items.map((item) => ({
    apartmentType: item.apartment_type,
    quantity: item.quantity,
    percentageOfMix: item.percentage_of_mix,
  }));
}

export async function listByProject(projectId: string) {
  return simulationDA.findByProject(projectId);
}

export async function getById(id: string) {
  const sim = await simulationDA.findById(id);
  if (!sim) throw new HttpError(404, 'Simulation not found');
  return sim;
}

export async function create(projectId: string, versionName: string) {
  return simulationDA.create(projectId, versionName);
}

export async function updateFull(
  id: string,
  body: {
    version_name?: string;
    planning_parameters?: any;
    cost_parameters?: any;
    revenue_parameters?: any;
    apartment_mix?: any[];
    economic_parameters?: any;
  }
) {
  const sim = await simulationDA.findById(id);
  if (!sim) throw new HttpError(404, 'Simulation not found');

  if (body.version_name) {
    await prisma.simulation.update({
      where: { id },
      data: { versionName: body.version_name },
    });
  }

  if (body.planning_parameters) {
    await paramDA.upsertPlanning(id, mapPlanningToCamel(body.planning_parameters));
  }

  if (body.cost_parameters) {
    await paramDA.upsertCost(id, mapCostToCamel(body.cost_parameters));
  }

  if (body.revenue_parameters) {
    await paramDA.upsertRevenue(id, mapRevenueToCamel(body.revenue_parameters));
  }

  if (body.economic_parameters) {
    await paramDA.upsertEconomic(id, mapEconomicToCamel(body.economic_parameters));
  }

  if (body.apartment_mix) {
    await paramDA.replaceApartmentMix(id, mapMixToCamel(body.apartment_mix));
  }

  return simulationDA.findById(id);
}

export async function clone(id: string) {
  const sim = await simulationDA.findById(id);
  if (!sim) throw new HttpError(404, 'Simulation not found');

  const newSim = await simulationDA.create(
    sim.projectId,
    `${sim.versionName} (copy)`
  );

  // Copy all parameters
  if (sim.planningParameters) {
    const { simulationId, ...data } = sim.planningParameters;
    await paramDA.upsertPlanning(newSim.id, data);
  }
  if (sim.costParameters) {
    const { simulationId, ...data } = sim.costParameters;
    await paramDA.upsertCost(newSim.id, data);
  }
  if (sim.revenueParameters) {
    const { simulationId, ...data } = sim.revenueParameters;
    await paramDA.upsertRevenue(newSim.id, data);
  }
  if (sim.economicParameters) {
    const { simulationId, ...data } = sim.economicParameters;
    await paramDA.upsertEconomic(newSim.id, data);
  }
  if (sim.apartmentMix.length > 0) {
    await paramDA.replaceApartmentMix(
      newSim.id,
      sim.apartmentMix.map((m: any) => ({
        apartmentType: m.apartmentType,
        quantity: m.quantity,
        percentageOfMix: Number(m.percentageOfMix),
      }))
    );
  }

  return simulationDA.findById(newSim.id);
}

export async function setStatus(id: string, status: SimulationStatus) {
  const sim = await simulationDA.findById(id);
  if (!sim) throw new HttpError(404, 'Simulation not found');
  return simulationDA.updateStatus(id, status);
}

export async function saveResults(id: string, results: any) {
  // Snapshot previous results for delta analysis
  const existing = await paramDA.findResults(id);
  if (existing) {
    const { simulationId, ...snapshot } = existing;
    results.previousResultsSnapshot = snapshot;
  }

  await paramDA.upsertResults(id, results);
  return simulationDA.findById(id);
}
