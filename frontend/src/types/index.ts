export interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail extends Project {
  documents: DocumentBrief[];
  simulations: SimulationBrief[];
  tabu_data: Record<string, unknown> | null;
  market_research_status: string | null;
  market_research_data: Record<string, unknown> | null;
}

export type ExtractionStatus = 'Pending' | 'Processing' | 'Completed' | 'Failed';

export interface DocumentBrief {
  id: string;
  document_type: string;
  file_path: string;
  upload_date: string;
  extraction_status: ExtractionStatus;
}

export interface DocumentOut extends DocumentBrief {
  project_id: string;
  extraction_error: string | null;
  extracted_data: Record<string, unknown> | null;
}

export type SimulationStatus =
  | 'Draft'
  | 'AI_Extracting'
  | 'Pending_Review'
  | 'Approved_For_Calc'
  | 'Completed';

export interface SimulationBrief {
  id: string;
  version_name: string;
  status: SimulationStatus;
  created_at: string;
}

export interface PlanningParameters {
  returns_percent: number;
  multiplier_far: number;
  avg_apt_size_sqm: number;
  service_area_sqm: number;
  number_of_floors: number;
  coverage_above_ground: number;
  coverage_underground: number;
  gross_area_per_parking: number;
  building_lines_notes: string | null;
  public_tasks_notes: string | null;
  parking_standard_ratio: number;
  typ_floor_area_min: number;
  typ_floor_area_max: number;
  apts_per_floor_min: number;
  apts_per_floor_max: number;
  return_area_per_apt?: number | null;
  service_area_percent?: number | null;
  public_area_sqm?: number | null;
  parking_floor_area?: number | null;
  balcony_area_per_unit?: number | null;
  blue_line_area?: number | null;
  planning_stage?: string | null;
  ai_extraction_metadata?: Record<string, unknown> | null;
}

export interface ApartmentMix {
  id?: string;
  apartment_type: string;
  quantity: number;
  percentage_of_mix: number;
}

export interface CostParameters {
  construction_duration_months?: number | null;
  cost_per_sqm_residential?: number | null;
  cost_per_sqm_service?: number | null;
  cost_per_sqm_commercial?: number | null;
  cost_per_sqm_balcony?: number | null;
  cost_per_sqm_development?: number | null;
  betterment_levy?: number | null;
  purchase_tax?: number | null;
  planning_consultants?: number | null;
  permits_fees?: number | null;
  electricity_connection?: number | null;
  bank_supervision?: number | null;
  engineering_management?: number | null;
  tenant_supervision?: number | null;
  management_overhead?: number | null;
  marketing_advertising?: number | null;
  tenant_lawyer?: number | null;
  initiation_fee?: number | null;
  rent_subsidy?: number | null;
  evacuation_cost?: number | null;
  moving_cost?: number | null;
  contingency?: number | null;
  developer_lawyer?: number | null;
  demolition?: number | null;
  construction_total?: number | null;
  parking_construction?: number | null;
  financing_interest_rate?: number | null;
  vat_rate?: number | null;
  cpi_linkage_pct?: number | null;
  ai_extraction_metadata?: Record<string, unknown> | null;
}

export interface RevenueParameters {
  price_per_unit_by_type?: Record<string, number> | null;
  price_per_sqm_residential?: number | null;
  price_per_sqm_commercial?: number | null;
  sales_pace_per_month?: number | null;
  marketing_discount_pct?: number | null;
  price_per_sqm_parking?: number | null;
  price_per_sqm_storage?: number | null;
  ai_extraction_metadata?: Record<string, unknown> | null;
}

export interface SimulationResult {
  // KPIs
  profit: number;
  profitability_rate: number;
  irr: number;
  npv: number;
  // Revenue & Costs
  total_revenue?: number | null;
  net_revenue?: number | null;
  total_costs?: number | null;
  construction_cost?: number | null;
  planning_cost?: number | null;
  levies_cost?: number | null;
  total_units?: number | null;
  total_residential_area?: number | null;
  residential_revenue?: number | null;
  commercial_revenue?: number | null;
  monthly_cash_flows?: number[] | null;
  calculation_details?: Record<string, unknown> | null;
  // Section 2: מצב יוצא
  total_return_floorplate?: number | null;
  total_new_units?: number | null;
  total_floorplate?: number | null;
  developer_units?: number | null;
  developer_floorplate?: number | null;
  avg_developer_unit_size?: number | null;
  combination_ratio?: number | null;
  // Section 3: פרוגרמה
  service_areas?: number | null;
  total_above_ground?: number | null;
  floor_area?: number | null;
  max_buildings?: number | null;
  above_ground_per_building?: number | null;
  development_land?: number | null;
  residential_per_building?: number | null;
  return_units_per_building?: number | null;
  developer_units_per_building?: number | null;
  developer_floorplate_per_building?: number | null;
  total_parking_spots?: number | null;
  total_parking_area?: number | null;
  parking_floors?: number | null;
  total_balcony_area?: number | null;
  // Section 4+5: Financial
  financing_cost?: number | null;
  total_costs_excl_vat?: number | null;
  total_costs_incl_vat?: number | null;
  expected_profit?: number | null;
  profit_percent?: number | null;
  profit_percent_standard21?: number | null;
  // Breakdowns
  cost_breakdown?: Record<string, number> | null;
  revenue_breakdown?: Record<string, number> | null;
  area_breakdown?: Record<string, number> | null;
  // Delta snapshot
  previous_results_snapshot?: Record<string, unknown> | null;
}

export interface TabuOwner {
  name: string;
  id?: string;
  share?: string;
  sub_parcel?: string;
  area_sqm?: number;
  floor?: string;
}

export interface TabuLien {
  type: string;
  authority?: string;
  regulation?: string;
  holder?: string;
  amount?: string;
  date?: string;
  details?: string;
}

export interface TabuMortgage {
  creditor?: string;
  lender?: string;
  company_id?: string;
  rank?: string;
  share?: string;
  sub_parcel?: string;
  amount?: string;
  date?: string;
  details?: string;
}

export interface TabuData {
  block?: string;
  parcel?: string;
  sub_parcel?: string;
  area_sqm?: number;
  address?: string;
  owners?: TabuOwner[];
  rights?: TabuOwner[];
  rights_holders?: TabuOwner[];
  liens?: TabuLien[];
  mortgages?: TabuMortgage[];
  warnings?: (string | { type: string; details: string; date?: string })[];
  [key: string]: unknown;
}

export interface SimulationDetail extends SimulationBrief {
  project_id: string;
  planning_parameters: PlanningParameters | null;
  apartment_mix: ApartmentMix[];
  cost_parameters: CostParameters | null;
  revenue_parameters: RevenueParameters | null;
  simulation_results: SimulationResult | null;
  agent_status: AgentStatus | null;
}

export interface CompareOut {
  simulation_a: SimulationDetail;
  simulation_b: SimulationDetail;
}

// Extraction status polling
export interface DocumentExtractionStatus {
  id: string;
  document_type: string;
  extraction_status: ExtractionStatus;
  extraction_error: string | null;
}

export interface ExtractionStatusResponse {
  project_id: string;
  documents: DocumentExtractionStatus[];
  tabu_data: Record<string, unknown> | null;
  extraction_progress: {
    total_docs: number;
    completed_docs: number;
    current_step: string;
    percentage: number;
  } | null;
  active_simulation_id: string | null;
  active_simulation_status: string | null;
}

// Delta analysis
export interface DeltaField {
  before: number;
  after: number;
  change: number;
  change_pct: number;
}

export interface DeltaAnalysis {
  has_delta: boolean;
  deltas: Record<string, DeltaField>;
}

// Per-parameter sensitivity
export interface SensitivityVariant {
  change_pct: number;
  value: number;
  profit: number;
  irr: number;
  profit_pct: number;
}

export interface SensitivityParameter {
  field: string;
  label: string;
  base_value: number;
  variants: SensitivityVariant[];
}

export interface ParameterSensitivity {
  base_profit: number;
  base_irr: number;
  base_profit_pct: number;
  parameters: SensitivityParameter[];
}

// --- Multi-Agent Pipeline ---

export interface AgentStepStatus {
  status: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
  docs_processed?: number;
  fields_found?: number;
  scenarios_count?: number;
  optimizations_count?: number;
  error?: string;
}

export interface AgentStatus {
  extraction: AgentStepStatus;
  research: AgentStepStatus;
  calculation: AgentStepStatus;
  alternatives: AgentStepStatus;
}

export interface ScenarioResult {
  profit: number;
  profitability_rate: number;
  irr: number;
  npv: number;
  total_revenue: number;
  net_revenue: number;
  total_costs: number;
  developer_units?: number;
  total_units?: number;
}

export interface Scenario {
  name: string;
  name_en: string;
  description: string;
  params_adjustments: Record<string, string>;
  results: ScenarioResult;
}

export interface Optimization {
  description: string;
  impact_estimate: string;
  confidence: number;
  parameter?: string;
  suggested_value?: number;
}

export interface AlternativesOut {
  scenarios: Scenario[] | null;
  optimizations: Optimization[] | null;
  ai_validation_notes: string | null;
}

export interface MissingFields {
  ready: boolean;
  missing_planning: string[];
  missing_cost: string[];
  missing_revenue: string[];
  missing_mix: boolean;
  warnings: string[];
}

// --- Market Research ---
export interface ResearchSummary {
  neighborhood?: string;
  area_description?: string;
  zoning?: string;
  conservation_status?: string;
  applicable_plans?: string[];
  market_trend?: string;
  comparable_projects?: string;
}

export interface MarketResearchResponse {
  status: string;
  data: Record<string, unknown> | null;
  summary?: ResearchSummary | null;
  planning?: Record<string, unknown> | null;
  costs?: Record<string, unknown> | null;
  revenue?: Record<string, unknown> | null;
  mix?: Record<string, unknown>[] | null;
}

export interface ApplyResearchResponse {
  status: string;
  message: string;
  fields_populated: {
    planning: number;
    costs: number;
    revenue: number;
    mix: number;
  };
  locked_from_tabu?: Record<string, number>;
}

// --- Research Preview ---
export interface ResearchPreviewField {
  field: string;
  section: string;
  label_he: string;
  current: number | null;
  proposed: number;
  will_change: boolean;
  is_pct: boolean;
  is_locked: boolean;
}

export interface ResearchPreviewResponse {
  fields: ResearchPreviewField[];
  grouped: Record<string, ResearchPreviewField[]>;
  summary: {
    total_fields: number;
    will_change: number;
    will_keep: number;
    locked_count: number;
  };
  data_sources: Record<string, string> | null;
  research_summary: ResearchSummary | null;
  apartment_mix: Array<{ apartment_type: string; quantity: number; percentage_of_mix: number }> | null;
  validation_fixes: string[];
  confidence: Record<string, string>;
}
