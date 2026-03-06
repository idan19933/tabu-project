/**
 * @file types/simulation.ts
 * @description TypeScript types for the intermediate calculation structures produced
 * during the Shikun & Binui financial model run (Sections 2 and 3 of the model).
 * `SimParams` is the flattened input consumed by `calculation.service.ts`.
 */

/**
 * Flattened, normalised input parameters consumed by the financial calculation engine.
 * Assembled from the four Prisma parameter models (PlanningParameter, CostParameter,
 * RevenueParameter, EconomicParameter) plus the ApartmentMix entries.
 */
export interface SimParams {
  // --- Planning parameters ---
  /** Percentage of existing units returned to original owners (תשואה). */
  returnsPct: number;
  /** Average apartment gross floor area (m²). */
  avgAptSize: number;
  /** Number of floors in the proposed building. */
  numFloors: number;
  /** Above-ground plot coverage ratio (%). */
  coverageAbove: number;
  /** Underground plot coverage ratio (%). */
  coverageUnder: number;
  /** Gross area per parking spot (m²). */
  grossPerParking: number;
  /** Parking spots per apartment. */
  parkingRatio: number;
  /** Floor Area Ratio (FAR) multiplier. */
  multiplierFar: number;
  /** Return-unit floor area per apartment (m²). */
  returnAreaPerApt: number;
  /** Service areas as a percentage of residential GFA. */
  serviceAreaPct: number;
  /** Service area override in m². */
  serviceAreaSqm: number;
  /** Public area in m². */
  publicArea: number;
  /** Total parking floor area in m². */
  parkingFloorArea: number;
  /** Balcony area per unit (m²). */
  balconyPerUnit: number;
  /** Blue-line (tabu-registered) plot area in m² — locked from AI overwrite. */
  blueLineArea: number;

  // --- Cost parameters ---
  /** Construction cost per m² of residential GFA (₪). */
  costSqmRes: number;
  /** Construction cost per m² of service areas (₪). */
  costSqmService: number;
  /** Construction cost per m² of commercial areas (₪). */
  costSqmCommercial: number;
  /** Construction cost per m² of balcony (₪). */
  costSqmBalcony: number;
  /** Site development cost per m² (₪). */
  costSqmDevelopment: number;
  /** Construction duration in months. */
  constructionDuration: number;
  /** Annual financing / interest rate (decimal). */
  financingRate: number;
  /** VAT rate applicable to the project (decimal). */
  vatRate: number;
  /** Annual CPI / inflation rate (decimal). */
  cpiPct: number;

  // --- Revenue parameters ---
  /** Sales price per m² of residential GFA (₪). */
  priceSqmRes: number;
  /** Sales price per m² of commercial GFA (₪). */
  priceSqmComm: number;
  /** Override price per unit keyed by apartment type string. */
  pricePerUnitByType: Record<string, number>;
  /** Monthly unit sales pace (units/month). */
  salesPace: number;
  /** Marketing discount percentage applied to gross revenue. */
  marketingDiscountPct: number;

  // --- Cost line-item overrides (absolute NIS amounts) ---
  /** Override total construction cost if non-zero (skips per-m² formula). */
  constructionTotalOverride: number;
  /** Override parking construction cost if non-zero. */
  parkingConstructionOverride: number;
  /** Betterment levy (היטל השבחה) in ₪. */
  bettermentLevy: number;
  /** Purchase tax in ₪. */
  purchaseTax: number;
  /** Planning consultants cost in ₪. */
  planningConsultants: number;
  /** Permits and fees in ₪. */
  permitsFees: number;
  /** Electricity connection fee in ₪. */
  electricityConnection: number;
  /** Bank supervision cost in ₪. */
  bankSupervision: number;
  /** Engineering management cost in ₪. */
  engineeringManagement: number;
  /** Tenant supervision cost in ₪. */
  tenantSupervision: number;
  /** Management overhead cost in ₪. */
  managementOverhead: number;
  /** Marketing and advertising cost in ₪. */
  marketingAdvertising: number;
  /** Tenant legal fees in ₪. */
  tenantLawyer: number;
  /** Initiation fee in ₪. */
  initiationFee: number;
  /** Rent subsidy in ₪. */
  rentSubsidy: number;
  /** Evacuation cost in ₪. */
  evacuationCost: number;
  /** Moving cost reimbursements in ₪. */
  movingCost: number;
  /** Contingency reserve in ₪. */
  contingency: number;
  /** Developer legal fees in ₪. */
  developerLawyer: number;
  /** Demolition cost in ₪. */
  demolition: number;

  // --- Percentage-based cost fields (override absolute amounts when non-zero) ---
  /** Planning consultants as a % of construction cost. */
  planningConsultantsPct: number;
  /** Permits and fees as a % of construction cost. */
  permitsFeesPct: number;
  /** Bank supervision as a % of construction cost. */
  bankSupervisionPct: number;
  /** Engineering management as a % of construction cost. */
  engineeringManagementPct: number;
  /** Tenant supervision as a % of construction cost. */
  tenantSupervisionPct: number;
  /** Management overhead as a % of construction cost. */
  managementOverheadPct: number;
  /** Marketing and advertising as a % of revenue. */
  marketingAdvertisingPct: number;
  /** Tenant lawyer as a % of construction cost. */
  tenantLawyerPct: number;
  /** Developer lawyer as a % of construction cost. */
  developerLawyerPct: number;
  /** Contingency as a % of construction cost. */
  contingencyPct: number;
  /** Initiation fee as a % of construction cost. */
  initiationFeePct: number;

  // --- Apartment mix ---
  /** Array of apartment types with their quantities and share of total mix. */
  mix: Array<{ apartmentType: string; quantity: number; percentageOfMix: number }>;

  // --- Feature flags ---
  /** True when new CostParameter schema fields are populated. */
  hasNewCost: boolean;
  /** True when new RevenueParameter schema fields are populated. */
  hasNewRevenue: boolean;
  /** True when legacy EconomicParameter fields are used for cost percentages. */
  hasLegacyEp: boolean;
  /** Legacy planning cost percentage (used when `hasLegacyEp` is true). */
  legacyCostPlanningPct: number;
  /** Legacy levies percentage (used when `hasLegacyEp` is true). */
  legacyLeviesPct: number;
}

/**
 * Section 2 output — the proposed state of the project after urban renewal.
 * Describes the split between returned units and new developer units.
 */
export interface ProposedState {
  /** Total number of apartments in the proposed building. */
  totalUnits: number;
  /** Total residential gross floor area (m²). */
  totalResidentialArea: number;
  /** Number of units returned to original owners. */
  returnUnits: number;
  /** Total floor area allocated to return units (m²). */
  totalReturnFloorplate: number;
  /** Number of units kept by the developer. */
  developerUnits: number;
  /** Total floor area of developer units (m²). */
  developerFloorplate: number;
  /** Average size of a developer unit (m²). */
  avgDeveloperUnitSize: number;
  /** Ratio of developer units to return units (combination ratio). */
  combinationRatio: number;
}

/**
 * Section 3 output — the physical building programme: areas, parking, and balconies.
 */
export interface BuildingProgram {
  /** Total service area (lobbies, stairwells, corridors) in m². */
  serviceAreas: number;
  /** Total above-ground gross floor area in m². */
  totalAboveGround: number;
  /** Plot floor area in m². */
  floorArea: number;
  /** Maximum number of separate buildings on the plot. */
  maxBuildings: number;
  /** Above-ground GFA per building (m²). */
  aboveGroundPerBuilding: number;
  /** Net development land area (m²). */
  developmentLand: number;
  /** Residential GFA per building (m²). */
  residentialPerBuilding: number;
  /** Return units per building. */
  returnUnitsPerBuilding: number;
  /** Developer units per building. */
  developerUnitsPerBuilding: number;
  /** Developer unit floor area per building (m²). */
  developerFloorplatePerBuilding: number;
  /** Total parking spaces across the entire project. */
  totalParkingSpots: number;
  /** Total underground parking area (m²). */
  totalParkingArea: number;
  /** Number of underground parking floors. */
  parkingFloors: number;
  /** Total balcony area across all units (m²). */
  totalBalconyArea: number;
}
