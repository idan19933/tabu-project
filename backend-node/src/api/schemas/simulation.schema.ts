import { z } from 'zod';

export const createSimulationSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    version_name: z.string().min(1, 'Version name is required'),
  }),
});

export const simulationIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const compareSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    otherId: z.string().uuid(),
  }),
});

// Planning parameter input
const planningParameterSchema = z.object({
  returns_percent: z.number().nullable().optional(),
  multiplier_far: z.number().nullable().optional(),
  avg_apt_size_sqm: z.number().nullable().optional(),
  service_area_sqm: z.number().nullable().optional(),
  number_of_floors: z.number().int().nullable().optional(),
  coverage_above_ground: z.number().nullable().optional(),
  coverage_underground: z.number().nullable().optional(),
  gross_area_per_parking: z.number().nullable().optional(),
  building_lines_notes: z.string().nullable().optional(),
  public_tasks_notes: z.string().nullable().optional(),
  parking_standard_ratio: z.number().nullable().optional(),
  typ_floor_area_min: z.number().nullable().optional(),
  typ_floor_area_max: z.number().nullable().optional(),
  apts_per_floor_min: z.number().int().nullable().optional(),
  apts_per_floor_max: z.number().int().nullable().optional(),
  return_area_per_apt: z.number().nullable().optional(),
  service_area_percent: z.number().nullable().optional(),
  public_area_sqm: z.number().nullable().optional(),
  parking_floor_area: z.number().nullable().optional(),
  balcony_area_per_unit: z.number().nullable().optional(),
  blue_line_area: z.number().nullable().optional(),
  planning_stage: z.string().nullable().optional(),
}).optional();

// Cost parameter input
const costParameterSchema = z.object({
  construction_duration_months: z.number().int().nullable().optional(),
  cost_per_sqm_residential: z.number().nullable().optional(),
  cost_per_sqm_service: z.number().nullable().optional(),
  cost_per_sqm_commercial: z.number().nullable().optional(),
  cost_per_sqm_balcony: z.number().nullable().optional(),
  cost_per_sqm_development: z.number().nullable().optional(),
  betterment_levy: z.number().nullable().optional(),
  purchase_tax: z.number().nullable().optional(),
  planning_consultants: z.number().nullable().optional(),
  permits_fees: z.number().nullable().optional(),
  electricity_connection: z.number().nullable().optional(),
  bank_supervision: z.number().nullable().optional(),
  engineering_management: z.number().nullable().optional(),
  tenant_supervision: z.number().nullable().optional(),
  management_overhead: z.number().nullable().optional(),
  marketing_advertising: z.number().nullable().optional(),
  tenant_lawyer: z.number().nullable().optional(),
  initiation_fee: z.number().nullable().optional(),
  developer_lawyer: z.number().nullable().optional(),
  rent_subsidy: z.number().nullable().optional(),
  evacuation_cost: z.number().nullable().optional(),
  moving_cost: z.number().nullable().optional(),
  contingency: z.number().nullable().optional(),
  demolition: z.number().nullable().optional(),
  construction_total: z.number().nullable().optional(),
  parking_construction: z.number().nullable().optional(),
  financing_interest_rate: z.number().nullable().optional(),
  vat_rate: z.number().nullable().optional(),
  cpi_linkage_pct: z.number().nullable().optional(),
  planning_consultants_pct: z.number().nullable().optional(),
  permits_fees_pct: z.number().nullable().optional(),
  bank_supervision_pct: z.number().nullable().optional(),
  engineering_management_pct: z.number().nullable().optional(),
  tenant_supervision_pct: z.number().nullable().optional(),
  management_overhead_pct: z.number().nullable().optional(),
  marketing_advertising_pct: z.number().nullable().optional(),
  tenant_lawyer_pct: z.number().nullable().optional(),
  developer_lawyer_pct: z.number().nullable().optional(),
  contingency_pct: z.number().nullable().optional(),
  initiation_fee_pct: z.number().nullable().optional(),
}).optional();

// Revenue parameter input
const revenueParameterSchema = z.object({
  price_per_unit_by_type: z.record(z.number()).nullable().optional(),
  price_per_sqm_residential: z.number().nullable().optional(),
  price_per_sqm_commercial: z.number().nullable().optional(),
  sales_pace_per_month: z.number().nullable().optional(),
  marketing_discount_pct: z.number().nullable().optional(),
  price_per_sqm_parking: z.number().nullable().optional(),
  price_per_sqm_storage: z.number().nullable().optional(),
}).optional();

// Apartment mix input
const apartmentMixItemSchema = z.object({
  apartment_type: z.string(),
  quantity: z.number().int(),
  percentage_of_mix: z.number(),
});

// Economic parameter input (legacy)
const economicParameterSchema = z.object({
  sales_prices_by_use: z.record(z.number()),
  cost_construction_dev: z.number(),
  cost_planning_mgmt: z.number(),
  levies_fees_taxes: z.number(),
  timeline_months: z.number().int(),
  interest_rate: z.number(),
  sales_pace_per_month: z.number(),
  marketing_discount_pct: z.number(),
}).optional();

export const fullUpdateSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    version_name: z.string().optional(),
    planning_parameters: planningParameterSchema,
    cost_parameters: costParameterSchema,
    revenue_parameters: revenueParameterSchema,
    apartment_mix: z.array(apartmentMixItemSchema).optional(),
    economic_parameters: economicParameterSchema,
  }),
});

export type PlanningParameterInput = z.infer<typeof planningParameterSchema>;
export type CostParameterInput = z.infer<typeof costParameterSchema>;
export type RevenueParameterInput = z.infer<typeof revenueParameterSchema>;
export type ApartmentMixInput = z.infer<typeof apartmentMixItemSchema>;
export type EconomicParameterInput = z.infer<typeof economicParameterSchema>;
