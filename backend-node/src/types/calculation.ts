/**
 * @file types/calculation.ts
 * @description TypeScript types for the financial engine output produced by
 * `calculation.service.ts` (Shikun & Binui model).
 */

/**
 * Itemised cost breakdown from Section 4 of the financial model.
 * All values are in NIS.
 */
export interface CostBreakdown {
  /** Construction cost for residential gross floor area. */
  constructionResidential: number;
  /** Construction cost for service areas (lobbies, stairwells, etc.). */
  constructionService: number;
  /** Construction cost for public/commercial areas. */
  constructionPublic: number;
  /** Construction cost for balcony areas. */
  constructionBalcony: number;
  /** Site development / external works cost. */
  constructionDevelopment: number;
  /** Underground parking construction cost. */
  parkingConstruction: number;
  /** Total direct construction cost (sum of all construction line items). */
  constructionCost: number;
  /** Municipal betterment levy (היטל השבחה). */
  bettermentLevy: number;
  /** Purchase tax (מס רכישה). */
  purchaseTax: number;
  /** Planning and architecture consultants. */
  planningConsultants: number;
  /** Building permits and municipal fees. */
  permitsFees: number;
  /** Electricity grid connection fee. */
  electricityConnection: number;
  /** Bank supervision (פיקוח בנק). */
  bankSupervision: number;
  /** Engineering project management. */
  engineeringManagement: number;
  /** Tenant supervision and liaison costs. */
  tenantSupervision: number;
  /** Developer overhead and management. */
  managementOverhead: number;
  /** Sales and marketing advertising budget. */
  marketingAdvertising: number;
  /** Tenant legal fees. */
  tenantLawyer: number;
  /** Project initiation fee. */
  initiationFee: number;
  /** Rent subsidy paid to evacuated tenants during construction. */
  rentSubsidy: number;
  /** Evacuation compensation costs. */
  evacuationCost: number;
  /** Moving expense reimbursements. */
  movingCost: number;
  /** Contingency reserve. */
  contingency: number;
  /** Developer legal fees. */
  developerLawyer: number;
  /** Demolition costs. */
  demolition: number;
  /** Additional miscellaneous costs. */
  additionalCosts: number;
  /** Construction financing / interest cost. */
  financingCost: number;
  /** Total costs excluding VAT. */
  totalCostsExclVat: number;
  /** Total costs including VAT. */
  totalCostsInclVat: number;
  /** Effective total costs used in the profitability calculation. */
  totalCosts: number;
  /** Aggregate planning and consulting costs sub-total. */
  planningCost: number;
  /** Aggregate levies and taxes sub-total. */
  leviesCost: number;
}

/**
 * Revenue breakdown from Section 5 of the financial model.
 * All values are in NIS.
 */
export interface RevenueBreakdown {
  /** Gross residential sales revenue. */
  residentialRevenue: number;
  /** Commercial unit sales revenue. */
  commercialRevenue: number;
  /** Parking space sales revenue. */
  parkingRevenue: number;
  /** Storage unit sales revenue. */
  storageRevenue: number;
  /** Gross total revenue before marketing discount. */
  totalRevenue: number;
  /** Marketing / early-buyer discount amount. */
  marketingDiscount: number;
  /** Net revenue after applying the marketing discount. */
  netRevenue: number;
  /** Developer profit in NIS (netRevenue − totalCosts). */
  expectedProfit: number;
  /** Developer profit as a percentage of total costs. */
  profitPercent: number;
  /** Profit percentage calculated against the 21-unit benchmark (Section 2 standard). */
  profitPercentStandard21: number;
}

/**
 * Monthly cashflow and time-value metrics from the financial model.
 */
export interface FinancialResults {
  /** Monthly net cashflow series used to compute IRR and NPV. */
  cashFlows: number[];
  /** Internal Rate of Return (annualised) as a decimal (e.g. 0.18 = 18 %). */
  irr: number;
  /** Net Present Value in NIS. */
  npv: number;
}
