export interface CostBreakdown {
  constructionResidential: number;
  constructionService: number;
  constructionPublic: number;
  constructionBalcony: number;
  constructionDevelopment: number;
  parkingConstruction: number;
  constructionCost: number;
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
  additionalCosts: number;
  financingCost: number;
  totalCostsExclVat: number;
  totalCostsInclVat: number;
  totalCosts: number;
  planningCost: number;
  leviesCost: number;
}

export interface RevenueBreakdown {
  residentialRevenue: number;
  commercialRevenue: number;
  parkingRevenue: number;
  storageRevenue: number;
  totalRevenue: number;
  marketingDiscount: number;
  netRevenue: number;
  expectedProfit: number;
  profitPercent: number;
  profitPercentStandard21: number;
}

export interface FinancialResults {
  cashFlows: number[];
  irr: number;
  npv: number;
}
