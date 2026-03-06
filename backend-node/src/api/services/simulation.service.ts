/**
 * @module simulation.service
 * Business-logic layer for simulation lifecycle management.
 *
 * Responsibilities:
 *  - CRUD operations on simulations and their nested parameters
 *  - Field-name mapping from snake_case API bodies to camelCase Prisma models
 *  - Delegating to the calculation engine and persisting results
 *  - Cloning simulations (deep copy of all parameter tables)
 *  - Triggering the 4-step AI agent pipeline asynchronously
 *  - Delta analysis comparing current vs. previous calculation results
 */
import { SimulationStatus } from '../../../prisma/generated/prisma/client';
import * as simulationDA from '../data-access/simulation.data-access';
import * as paramDA from '../data-access/parameter.data-access';
import * as calculationService from './calculation/calculation.service';
import { runSimulationPipeline } from './pipeline.service';
import { HttpError } from '../../lib/HttpError';
import { logger } from '../../config/logger';
import { prisma } from '../../config/prisma';

/**
 * Convert snake_case planning parameter keys (as sent by the API) to the
 * camelCase field names expected by the Prisma `PlanningParameter` model.
 *
 * @param data - Raw object with snake_case keys from the request body.
 * @returns A new object with keys mapped to camelCase, or `undefined` if `data` is falsy.
 */
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

/**
 * Convert snake_case cost parameter keys (as sent by the API) to the
 * camelCase field names expected by the Prisma `CostParameter` model.
 *
 * @param data - Raw object with snake_case keys from the request body.
 * @returns A new object with keys mapped to camelCase, or `undefined` if `data` is falsy.
 */
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

/**
 * Convert snake_case revenue parameter keys (as sent by the API) to the
 * camelCase field names expected by the Prisma `RevenueParameter` model.
 *
 * @param data - Raw object with snake_case keys from the request body.
 * @returns A new object with keys mapped to camelCase, or `undefined` if `data` is falsy.
 */
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

/**
 * Convert snake_case legacy economic parameter keys to camelCase.
 *
 * @param data - Raw object with snake_case keys from the request body.
 * @returns A new object with keys mapped to camelCase, or `undefined` if `data` is falsy.
 */
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

/**
 * Normalise apartment-mix items from snake_case API shape to camelCase for Prisma.
 *
 * @param items - Array of mix items with snake_case keys.
 * @returns Array of mix items with camelCase keys.
 */
function mapMixToCamel(items: any[]) {
  return items.map((item) => ({
    apartmentType: item.apartment_type,
    quantity: item.quantity,
    percentageOfMix: item.percentage_of_mix,
  }));
}

/**
 * List all simulations for a project (summary view — no parameter relations).
 *
 * @param projectId - The UUID of the parent project.
 * @returns A promise resolving to an array of simulation summaries.
 */
export async function listByProject(projectId: string) {
  return simulationDA.findByProject(projectId);
}

/**
 * Fetch a complete simulation by ID, including all parameter relations.
 *
 * @param id - The UUID of the simulation.
 * @returns A promise resolving to the full Simulation record.
 * @throws {HttpError} 404 if no simulation exists with the given ID.
 */
export async function getById(id: string) {
  const sim = await simulationDA.findById(id);
  if (!sim) throw new HttpError(404, 'Simulation not found');
  return sim;
}

/**
 * Create a new simulation in `Draft` status for a project.
 *
 * @param projectId - The UUID of the parent project.
 * @param versionName - A human-readable version label for this simulation.
 * @returns A promise resolving to the newly created Simulation record.
 */
export async function create(projectId: string, versionName: string) {
  return simulationDA.create(projectId, versionName);
}

/**
 * Update any combination of simulation fields and nested parameter tables.
 *
 * Each parameter section is upserted independently; omitting a key leaves
 * the existing data untouched. Apartment mix is always fully replaced when provided.
 *
 * @param id - The UUID of the simulation to update.
 * @param body - Partial update payload; supports `version_name`, all five parameter sections.
 * @returns A promise resolving to the updated Simulation with all relations.
 * @throws {HttpError} 404 if no simulation exists with the given ID.
 */
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

/**
 * Create an independent copy of a simulation with all its parameter tables.
 *
 * The clone is created in `Draft` status with `" (copy)"` appended to the version name.
 * Planning, cost, revenue, economic parameters, and apartment mix are all deep-copied.
 *
 * @param id - The UUID of the simulation to clone.
 * @returns A promise resolving to the newly created clone Simulation with all relations.
 * @throws {HttpError} 404 if no simulation exists with the given ID.
 */
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

/**
 * Transition a simulation to a new status.
 *
 * @param id - The UUID of the simulation.
 * @param status - The target `SimulationStatus` enum value.
 * @returns A promise resolving to the updated Simulation with all relations.
 * @throws {HttpError} 404 if no simulation exists with the given ID.
 */
export async function setStatus(id: string, status: SimulationStatus) {
  const sim = await simulationDA.findById(id);
  if (!sim) throw new HttpError(404, 'Simulation not found');
  return simulationDA.updateStatus(id, status);
}

/**
 * Approve a simulation for calculation by setting its status to `Approved_For_Calc`.
 *
 * @param id - The UUID of the simulation to approve.
 * @returns A promise resolving to the updated Simulation with all relations.
 * @throws {HttpError} 404 if no simulation exists with the given ID.
 */
export async function approve(id: string) {
  return setStatus(id, SimulationStatus.Approved_For_Calc);
}

/**
 * Persist calculation results for a simulation, snapshotting any previous results
 * into `previousResultsSnapshot` for later delta analysis.
 *
 * @param id - The UUID of the simulation.
 * @param results - The results object produced by the calculation engine.
 * @returns A promise resolving to the full Simulation after saving results.
 */
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

/**
 * Run the financial calculation engine against a simulation and persist the results.
 *
 * Transitions the simulation to `Completed` status upon success.
 *
 * @param id - The UUID of the simulation to calculate.
 * @returns A promise resolving to the updated Simulation with `Completed` status and results.
 * @throws {HttpError} 404 if no simulation exists with the given ID.
 */
export async function calculate(id: string) {
  const sim = await getById(id);
  const results = calculationService.runCalculations(sim);
  await saveResults(id, results);
  return simulationDA.updateStatus(id, SimulationStatus.Completed);
}

/**
 * Start the 4-step AI agent pipeline for a simulation in a fire-and-forget manner.
 *
 * The pipeline runs asynchronously via `setImmediate`; this function returns
 * immediately with `{ status: 'pipeline_started', simulation_id }`. Pipeline
 * progress is streamed via SSE from a separate endpoint.
 *
 * @param id - The UUID of the simulation whose documents will be processed.
 * @returns A promise resolving to a status acknowledgement object.
 * @throws {HttpError} 404 if no simulation exists with the given ID.
 */
export async function triggerPipeline(id: string) {
  await getById(id);

  setImmediate(() => {
    runSimulationPipeline(id).catch((err) => logger.error('Pipeline failed', err));
  });

  return { status: 'pipeline_started', simulation_id: id };
}

/**
 * Compute a field-level delta between the current and previous calculation results.
 *
 * Compares key financial metrics (profit, IRR, NPV, revenue, costs) and returns
 * absolute and percentage changes for any field that has changed.
 *
 * @param id - The UUID of the simulation.
 * @returns An object with `has_delta` (boolean) and `deltas` (map of changed fields).
 * @throws {HttpError} 404 if no simulation exists or no results are available yet.
 */
export async function getDeltaAnalysis(id: string) {
  const sim = await getById(id);
  if (!sim.simulationResults) throw new HttpError(404, 'No results for delta analysis');

  const current = sim.simulationResults;
  const previous = current.previousResultsSnapshot as any;
  if (!previous) {
    return { has_delta: false, deltas: {} };
  }

  const fieldMap: Record<string, string> = {
    profit: 'profit',
    profitabilityRate: 'profitability_rate',
    irr: 'irr',
    npv: 'npv',
    totalRevenue: 'total_revenue',
    netRevenue: 'net_revenue',
    totalCosts: 'total_costs',
    totalCostsInclVat: 'total_costs_incl_vat',
    totalCostsExclVat: 'total_costs_excl_vat',
    expectedProfit: 'expected_profit',
    profitPercent: 'profit_percent',
  };

  const deltas: Record<string, { before: number; after: number; change: number; change_pct: number }> = {};
  for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
    const after = Number((current as any)[camelKey]) || 0;
    const before = Number(previous[snakeKey] ?? previous[camelKey]) || 0;
    if (after !== before) {
      deltas[snakeKey] = {
        before,
        after,
        change: after - before,
        change_pct: before !== 0 ? ((after - before) / Math.abs(before)) * 100 : 0,
      };
    }
  }

  return { has_delta: Object.keys(deltas).length > 0, deltas };
}

/**
 * Return the raw `SimulationResult` record for a completed simulation.
 *
 * @param id - The UUID of the simulation.
 * @returns A promise resolving to the SimulationResult record.
 * @throws {HttpError} 404 if no results exist yet.
 */
export async function getCalculationDetails(id: string) {
  const sim = await getById(id);
  if (!sim.simulationResults) throw new HttpError(404, 'No calculation results found');
  return sim.simulationResults;
}

/**
 * Return the AI-generated scenarios and optimizations from the alternatives agent.
 *
 * @param id - The UUID of the simulation.
 * @returns An object with `scenarios` (Conservative/Base/Optimistic) and `optimizations` arrays.
 * @throws {HttpError} 404 if no results exist yet.
 */
export async function getAlternatives(id: string) {
  const sim = await getById(id);
  if (!sim.simulationResults) throw new HttpError(404, 'No results found');
  return {
    scenarios: sim.simulationResults.scenarios,
    optimizations: sim.simulationResults.optimizations,
  };
}
