export interface SimParams {
  returnsPct: number;
  avgAptSize: number;
  numFloors: number;
  coverageAbove: number;
  coverageUnder: number;
  grossPerParking: number;
  parkingRatio: number;
  multiplierFar: number;
  returnAreaPerApt: number;
  serviceAreaPct: number;
  serviceAreaSqm: number;
  publicArea: number;
  parkingFloorArea: number;
  balconyPerUnit: number;
  blueLineArea: number;
  // Cost params
  costSqmRes: number;
  costSqmService: number;
  costSqmCommercial: number;
  costSqmBalcony: number;
  costSqmDevelopment: number;
  constructionDuration: number;
  financingRate: number;
  vatRate: number;
  cpiPct: number;
  // Revenue params
  priceSqmRes: number;
  priceSqmComm: number;
  pricePerUnitByType: Record<string, number>;
  salesPace: number;
  marketingDiscountPct: number;
  // Cost line items
  constructionTotalOverride: number;
  parkingConstructionOverride: number;
  bettermentLevy: number;
  purchaseTax: number;
  planningConsultants: number;
  permitsFees: number;
  electricityConnection: number;
  bankSupervision: number;
  engineeringManagement: number;
  tenantSupervision: number;
  managementOverhead: number;
  marketingAdvertising: number;
  tenantLawyer: number;
  initiationFee: number;
  rentSubsidy: number;
  evacuationCost: number;
  movingCost: number;
  contingency: number;
  developerLawyer: number;
  demolition: number;
  // Percentage-based cost fields
  planningConsultantsPct: number;
  permitsFeesPct: number;
  bankSupervisionPct: number;
  engineeringManagementPct: number;
  tenantSupervisionPct: number;
  managementOverheadPct: number;
  marketingAdvertisingPct: number;
  tenantLawyerPct: number;
  developerLawyerPct: number;
  contingencyPct: number;
  initiationFeePct: number;
  // Apartment mix
  mix: Array<{ apartmentType: string; quantity: number; percentageOfMix: number }>;
  // Flags
  hasNewCost: boolean;
  hasNewRevenue: boolean;
  hasLegacyEp: boolean;
  legacyCostPlanningPct: number;
  legacyLeviesPct: number;
}

export interface ProposedState {
  totalUnits: number;
  totalResidentialArea: number;
  returnUnits: number;
  totalReturnFloorplate: number;
  developerUnits: number;
  developerFloorplate: number;
  avgDeveloperUnitSize: number;
  combinationRatio: number;
}

export interface BuildingProgram {
  serviceAreas: number;
  totalAboveGround: number;
  floorArea: number;
  maxBuildings: number;
  aboveGroundPerBuilding: number;
  developmentLand: number;
  residentialPerBuilding: number;
  returnUnitsPerBuilding: number;
  developerUnitsPerBuilding: number;
  developerFloorplatePerBuilding: number;
  totalParkingSpots: number;
  totalParkingArea: number;
  parkingFloors: number;
  totalBalconyArea: number;
}
