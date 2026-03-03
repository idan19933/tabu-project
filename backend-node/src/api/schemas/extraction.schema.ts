import { z } from 'zod';

export const extractedTabuDataSchema = z.object({
  block: z.string().nullable().optional(),
  parcel: z.string().nullable().optional(),
  sub_parcel: z.string().nullable().optional(),
  owners: z.array(z.string()).nullable().optional(),
  rights: z.array(z.string()).nullable().optional(),
  liens: z.array(z.string()).nullable().optional(),
  mortgages: z.array(z.string()).nullable().optional(),
  warnings: z.array(z.string()).nullable().optional(),
  area_sqm: z.number().nullable().optional(),
  address: z.string().nullable().optional(),
});

export const extractedPlanningSchema = z.object({
  returns_percent: z.number().nullable().optional(),
  multiplier_far: z.number().nullable().optional(),
  avg_apt_size_sqm: z.number().nullable().optional(),
  service_area_sqm: z.number().nullable().optional(),
  number_of_floors: z.number().nullable().optional(),
  coverage_above_ground: z.number().nullable().optional(),
  coverage_underground: z.number().nullable().optional(),
  gross_area_per_parking: z.number().nullable().optional(),
  parking_standard_ratio: z.number().nullable().optional(),
  return_area_per_apt: z.number().nullable().optional(),
  service_area_percent: z.number().nullable().optional(),
  public_area_sqm: z.number().nullable().optional(),
  parking_floor_area: z.number().nullable().optional(),
  balcony_area_per_unit: z.number().nullable().optional(),
  blue_line_area: z.number().nullable().optional(),
});

export const extractedCostSchema = z.object({
  construction_duration_months: z.number().nullable().optional(),
  cost_per_sqm_residential: z.number().nullable().optional(),
  cost_per_sqm_service: z.number().nullable().optional(),
  cost_per_sqm_commercial: z.number().nullable().optional(),
  cost_per_sqm_balcony: z.number().nullable().optional(),
  cost_per_sqm_development: z.number().nullable().optional(),
  betterment_levy: z.number().nullable().optional(),
  purchase_tax: z.number().nullable().optional(),
  financing_interest_rate: z.number().nullable().optional(),
  vat_rate: z.number().nullable().optional(),
});

export const extractedRevenueSchema = z.object({
  price_per_unit_by_type: z.record(z.number()).nullable().optional(),
  price_per_sqm_residential: z.number().nullable().optional(),
  price_per_sqm_commercial: z.number().nullable().optional(),
});

export const extractedApartmentMixSchema = z.object({
  apartment_type: z.string(),
  quantity: z.number(),
  percentage_of_mix: z.number(),
});

export const extractedParametersSchema = z.object({
  planning: extractedPlanningSchema.nullable().optional(),
  cost: extractedCostSchema.nullable().optional(),
  revenue: extractedRevenueSchema.nullable().optional(),
  apartment_mix: z.array(extractedApartmentMixSchema).nullable().optional(),
});

export type ExtractedTabuData = z.infer<typeof extractedTabuDataSchema>;
export type ExtractedParameters = z.infer<typeof extractedParametersSchema>;
