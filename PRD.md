# PRD — TabuApp (Urban Renewal Feasibility Platform)

## 1. Product Overview

**TabuApp** is a full-stack Israeli urban renewal (התחדשות עירונית) feasibility analysis platform. It uses AI agents (Claude via LangChain) to extract data from Hebrew PDF documents (tabu land registry, planning documents, economic reports), runs financial calculations based on the Shikun & Binui feasibility model, and generates scenario analysis for real estate development projects.

**Core Value Proposition:** Automate the labor-intensive process of gathering property data, researching market conditions, and running financial feasibility calculations for urban renewal projects in Israel.

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, React Router 7, Tailwind CSS 4, Recharts, Framer Motion |
| Backend | Python 3.11, FastAPI, SQLAlchemy 2, PostgreSQL, Alembic |
| AI Pipeline | LangChain + Claude API (extraction, research, calculation validation, alternatives) |
| Deploy | Docker (multi-stage), Railway |

---

## 3. User Pipelines

### Pipeline 1: Full AI-Assisted Flow (Primary)

```
Create Project
    |
    v
Upload Tabu PDF --> AI Extracts property data (owners, liens, mortgages, area)
    |
    v
Market Research Agent runs automatically (neighborhood, prices, zoning)
    |
    v
Create Simulation
    |
    v
Upload Planning/Economic PDFs --> AI Extracts parameters
    |
    v
Review extracted parameters (confidence scores) --> Approve or Edit
    |
    v
Apply Market Research defaults (fills missing fields)
    |
    v
Run Full Pipeline (SSE-streamed):
  1. Extraction Agent — parse remaining docs
  2. Research Agent — fill missing fields from docs
  3. Calculation Agent — run financial engine + AI validation
  4. Alternatives Agent — generate Conservative/Base/Optimistic scenarios
    |
    v
View Results: KPIs, charts, sensitivity, AI recommendations
    |
    v
(Optional) Compare simulations side-by-side
(Optional) Download Excel reports
(Optional) Clone simulation and adjust parameters
```

### Pipeline 2: Manual Editing Flow

```
Create Project --> Upload Tabu PDF
    |
    v
Create Simulation --> Navigate to Edit Page
    |
    v
Manually fill all parameters:
  - Planning (floors, FAR, coverage, parking, etc.)
  - Costs (construction, levies, financing, etc.)
  - Revenue (sale prices, pace, discounts)
  - Apartment Mix (unit types and quantities)
    |
    v
Save --> Calculate --> View Results
```

### Pipeline 3: Clone & Iterate

```
From a completed simulation:
    |
    v
Clone Simulation --> Edit cloned parameters --> Calculate
    |
    v
Compare original vs. clone side-by-side
```

---

## 4. Pages & Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/` | ProjectsPage | Dashboard with all projects in a grid. Create new project via modal. |
| `/projects/:id` | ProjectDetailPage | Project hub: tabu data display, market research status, document list, simulation list. Upload tabu PDF here. Create new simulation. |
| `/projects/:id/upload` | DocumentUploadPage | Standalone document upload (tabu/planning/economic/general). |
| `/simulations/:id/workspace` | SimulationWorkspace | Main work area: upload docs, monitor extraction progress, preview/apply research, view missing fields, trigger pipeline, see real-time SSE progress. |
| `/simulations/:id/review` | ReviewApprovePage | Read-only review of AI-extracted parameters with confidence badges. Approve or navigate to edit. |
| `/simulations/:id/edit` | SimulationEditorPage | Full parameter editor with collapsible sections (planning, costs, revenue, apartment mix). Validate, save, calculate. |
| `/simulations/:id/results` | ResultsPage | KPI cards (profit, IRR, NPV), charts (bar, pie, line), sensitivity analysis, scenario comparison, AI recommendations. Download reports. |
| `/compare` | ComparePage | Side-by-side comparison of two simulations with delta analysis. |

---

## 5. Features

### 5.1 Project Management
- Create/update/delete projects
- Grid dashboard with date-sorted project cards
- Each project holds tabu data, documents, and simulations

### 5.2 Tabu Data Extraction
- Drag-drop PDF upload on project detail page
- AI extracts: block (גוש), parcel (חלקה), area, owners, liens (שעבודים/עיקולים), mortgages (משכנתאות), warnings (הערות אזהרה)
- Collapsible sections with counts for each category
- Polling every 2s during extraction

### 5.3 Market Research (Automatic)
- Triggered automatically after tabu extraction
- 5-step AI pipeline:
  1. Identify location from gush/chelka
  2. Look up zoning & building rights
  3. Search construction costs
  4. Search sale prices (neighborhood-specific)
  5. Calculate feasible parameters
- Preview panel shows proposed vs. current values with confidence
- Apply research to fill missing simulation fields (non-destructive merge)
- Tabu-locked fields (e.g., blue_line_area) are protected

### 5.4 Document Upload & AI Extraction
- Supports: tabu, planning (תב"ע), economic (כלכלי), general documents
- Auto-detects document type
- Per-document extraction status: Pending → Processing → Completed/Failed
- Extracted data populates simulation parameters

### 5.5 Simulation Parameter Management
- **Planning Parameters**: floors, FAR, coverage, parking, apartment sizes, planning stage, building lines notes
- **Cost Parameters**: construction costs per sqm (residential/service/commercial/balcony), development, betterment levy, purchase tax, consultants, permits, financing, demolition, etc.
- **Revenue Parameters**: sale price per sqm (residential/commercial), parking price, storage price, sales pace, marketing discount
- **Apartment Mix**: unit types with quantity and percentage
- **Economic Parameters**: construction duration, interest rate, VAT, CPI linkage
- Readiness badges show completion status per section
- Validation blocks calculation if required fields are missing

### 5.6 AI Agent Pipeline (SSE-Streamed)
- 4-step sequential pipeline with real-time progress via Server-Sent Events
- Visual pipeline UI with connected step indicators
- Each step shows: pending → running → completed/error
- Detail badges (docs processed, fields found, scenarios count)
- Exponential backoff retry on SSE failures (max 5 retries)
- Polling fallback if SSE unavailable

### 5.7 Financial Calculation Engine
- Implements the Shikun & Binui feasibility model:
  - Section 2: Proposed state (return units, new units, developer units)
  - Section 3: Building program (areas, parking, commercial, service)
  - Section 4: All cost categories
  - Section 5: Revenue (residential + commercial)
  - Final: Monthly cashflow, IRR, NPV computation
- AI validation of calculation results

### 5.8 Results & Analysis
- **KPI Cards**: Developer Profit, Profitability %, IRR, NPV, Total Revenue, Total Costs
- **Charts**: Revenue/Costs/Profit bar chart, Apartment mix pie chart, Monthly cashflow line chart (with cumulative)
- **Sensitivity Analysis**: 2D matrix (revenue % vs cost %) and per-parameter sensitivity
- **Delta Analysis**: Before/after comparison when recalculating
- **Confetti effect** on results page load

### 5.9 Scenario Alternatives
- Conservative / Base / Optimistic scenarios with adjusted parameters
- Per-scenario KPI comparison
- AI optimization recommendations with confidence scores and suggested parameter changes

### 5.10 Report Export
- Management Report (XLSX)
- Economic Report (XLSX)
- Downloaded via browser

### 5.11 Simulation Comparison
- Side-by-side comparison of any two simulations
- Delta values with percentage change
- Color-coded: green (positive) / red (negative)
- Compares both results and planning parameters

### 5.12 Simulation Cloning
- Clone any completed simulation
- Creates independent copy with all parameters
- Edit and recalculate independently

---

## 6. API Endpoints

### 6.1 Projects

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| `GET` | `/api/projects` | List all projects | — | `Project[]` |
| `POST` | `/api/projects` | Create project | `{ name: string }` | `Project` |
| `GET` | `/api/projects/:id` | Get project detail | — | `ProjectDetail` |
| `PUT` | `/api/projects/:id` | Update project | `{ name?: string }` | `Project` |
| `DELETE` | `/api/projects/:id` | Delete project | — | `204` |
| `GET` | `/api/projects/:id/simulations` | List simulations | — | `SimulationBrief[]` |
| `POST` | `/api/projects/:id/simulations` | Create simulation | `{ version_name: string }` | `SimulationDetail` |
| `GET` | `/api/projects/:id/extraction-status` | Extraction progress | — | `ExtractionStatusResponse` |

### 6.2 Simulations

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| `GET` | `/api/simulations/:id` | Get simulation | — | `SimulationDetail` |
| `PUT` | `/api/simulations/:id` | Update params | `SimulationFullUpdate` | `SimulationDetail` |
| `POST` | `/api/simulations/:id/clone` | Clone simulation | — | `SimulationDetail` |
| `PUT` | `/api/simulations/:id/approve` | Approve for calc | — | `SimulationDetail` |
| `POST` | `/api/simulations/:id/calculate` | Run calculation | — | `SimulationDetail` |
| `GET` | `/api/simulations/:id/validation` | Check readiness | — | `ValidationResult` |
| `GET` | `/api/simulations/:id/calculation-details` | Detailed results | — | `object` |
| `GET` | `/api/simulations/:id/delta` | Delta analysis | — | `DeltaAnalysis` |
| `GET` | `/api/simulations/:id/sensitivity` | Sensitivity analysis | — | `ParameterSensitivity` |
| `GET` | `/api/simulations/:id1/compare/:id2` | Compare two sims | — | `CompareOut` |

### 6.3 Documents

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| `POST` | `/api/documents/upload` | Upload PDF | `FormData { project_id, document_type, file, simulation_id? }` | `DocumentOut` |
| `GET` | `/api/documents/by-project/:id` | Project documents | — | `DocumentBrief[]` |
| `GET` | `/api/documents/by-simulation/:id` | Simulation documents | — | `DocumentBrief[]` |

### 6.4 Market Research

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| `POST` | `/api/projects/:id/research` | Trigger research | `?force=boolean` | `{ status, message }` |
| `GET` | `/api/projects/:id/research` | Get results | — | `MarketResearchResponse` |
| `GET` | `/api/projects/:id/research/preview/:simId` | Preview diff | — | `ResearchPreviewResponse` |
| `POST` | `/api/projects/:id/simulations/:simId/apply-research` | Apply research | `{ overrides?: Record<string, number> }` | `ApplyResearchResponse` |

### 6.5 Agent Pipeline

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| `POST` | `/api/simulations/:id/run-pipeline` | Start pipeline | — | `{ status, simulation_id }` |
| `GET` | `/api/simulations/:id/agent-stream` | SSE stream | — | `EventSource` (SSE) |
| `GET` | `/api/simulations/:id/agent-status` | Pipeline status | — | `AgentStatus` |
| `GET` | `/api/simulations/:id/missing-fields` | Missing fields | — | `MissingFields` |
| `GET` | `/api/simulations/:id/alternatives` | Get scenarios | — | `AlternativesOut` |

### 6.6 Reports

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| `GET` | `/api/simulations/:id/report/management` | Management report | `XLSX binary` |
| `GET` | `/api/simulations/:id/report/economic` | Economic report | `XLSX binary` |

### 6.7 Health

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| `GET` | `/api/health` | Health check | `{ status, version, build }` |

---

## 7. Data Schemas

### 7.1 Project

```typescript
interface Project {
  id: string           // UUID
  name: string
  created_at: string   // ISO datetime
  updated_at: string
}

interface ProjectDetail extends Project {
  documents: DocumentBrief[]
  simulations: SimulationBrief[]
  tabu_data: TabuData | null
  market_research_status: string | null   // "running" | "completed" | "failed"
  market_research_data: object | null
}
```

### 7.2 Simulation

```typescript
type SimulationStatus = "Draft" | "AI_Extracting" | "Pending_Review" | "Approved_For_Calc" | "Completed"

interface SimulationBrief {
  id: string
  version_name: string
  status: SimulationStatus
  created_at: string
}

interface SimulationDetail extends SimulationBrief {
  project_id: string
  planning_parameters: PlanningParameters | null
  apartment_mix: ApartmentMix[]
  cost_parameters: CostParameters | null
  revenue_parameters: RevenueParameters | null
  simulation_results: SimulationResult | null
  agent_status: AgentStatus | null
}

// PUT /api/simulations/:id body
interface SimulationFullUpdate {
  version_name?: string
  planning_parameters?: PlanningParameterInput
  apartment_mix?: ApartmentMixInput[]
  cost_parameters?: CostParameterInput
  revenue_parameters?: RevenueParameterInput
}
```

### 7.3 Planning Parameters

```typescript
interface PlanningParameters {
  returns_percent: number | null          // % return to tenants
  multiplier_far: number | null           // FAR multiplier
  avg_apt_size_sqm: number | null         // average apartment sqm
  service_area_sqm: number | null
  number_of_floors: number | null
  coverage_above_ground: number | null    // % coverage
  coverage_underground: number | null
  gross_area_per_parking: number | null   // sqm per parking spot
  parking_standard_ratio: number | null
  building_lines_notes: string | null
  public_tasks_notes: string | null
  typ_floor_area_min: number | null
  typ_floor_area_max: number | null
  apts_per_floor_min: number | null
  apts_per_floor_max: number | null
  return_area_per_apt: number | null
  service_area_percent: number | null
  public_area_sqm: number | null
  parking_floor_area: number | null
  balcony_area_per_unit: number | null
  blue_line_area: number | null           // LOCKED from tabu
  planning_stage: string | null
  ai_extraction_metadata: object | null   // confidence scores
}
```

### 7.4 Cost Parameters

```typescript
interface CostParameters {
  construction_duration_months: number | null
  cost_per_sqm_residential: number | null
  cost_per_sqm_service: number | null
  cost_per_sqm_commercial: number | null
  cost_per_sqm_balcony: number | null
  cost_per_sqm_development: number | null
  betterment_levy: number | null
  purchase_tax: number | null
  planning_consultants: number | null
  permits_fees: number | null
  electricity_connection: number | null
  bank_supervision: number | null
  engineering_management: number | null
  tenant_supervision: number | null
  management_overhead: number | null
  marketing_advertising: number | null
  tenant_lawyer: number | null
  initiation_fee: number | null
  rent_subsidy: number | null
  evacuation_cost: number | null
  moving_cost: number | null
  contingency: number | null
  developer_lawyer: number | null
  demolition: number | null
  construction_total: number | null
  parking_construction: number | null
  financing_interest_rate: number | null
  vat_rate: number | null                 // default 17
  cpi_linkage_pct: number | null
  ai_extraction_metadata: object | null
}
```

### 7.5 Revenue Parameters

```typescript
interface RevenueParameters {
  price_per_unit_by_type: Record<string, number> | null  // per apartment type pricing
  price_per_sqm_residential: number | null
  price_per_sqm_commercial: number | null
  sales_pace_per_month: number | null
  marketing_discount_pct: number | null
  price_per_sqm_parking: number | null
  price_per_sqm_storage: number | null
  ai_extraction_metadata: object | null
}
```

### 7.6 Apartment Mix

```typescript
interface ApartmentMix {
  apartment_type: string    // e.g., "3 rooms", "4 rooms", "penthouse"
  quantity: number
  percentage_of_mix: number // 0-100
}
```

### 7.7 Document

```typescript
type ExtractionStatus = "Pending" | "Processing" | "Completed" | "Failed"

interface DocumentBrief {
  id: string
  document_type: string    // "tabu" | "planning" | "economic" | "general"
  file_path: string
  upload_date: string
  extraction_status: ExtractionStatus
}

interface DocumentOut extends DocumentBrief {
  project_id: string
  extraction_error: string | null
  extracted_data: object | null
}
```

### 7.8 Tabu Data

```typescript
interface TabuData {
  block: number              // גוש
  parcel: number             // חלקה
  sub_parcel: number | null
  area_sqm: number
  address: string | null
  owners: TabuOwner[]
  rights: string[]
  rights_holders: string[]
  liens: TabuLien[]
  mortgages: TabuMortgage[]
  warnings: string[]
}

interface TabuOwner {
  name: string
  id: string | null
  share: string
  sub_parcel: string | null
  area_sqm: number | null
  floor: string | null
}

interface TabuLien {
  type: string
  authority: string | null
  regulation: string | null
  holder: string | null
  amount: number | null
  date: string | null
  details: string | null
}

interface TabuMortgage {
  creditor: string | null
  lender: string | null
  company_id: string | null
  rank: string | null
  share: string | null
  sub_parcel: string | null
  amount: number | null
  date: string | null
  details: string | null
}
```

### 7.9 Simulation Results

```typescript
interface SimulationResult {
  // KPI headline metrics
  profit: number | null
  profitability_rate: number | null
  irr: number | null
  npv: number | null

  // Revenue & Cost totals
  total_revenue: number | null
  net_revenue: number | null
  total_costs: number | null
  construction_cost: number | null
  planning_cost: number | null
  levies_cost: number | null

  // Units & Areas
  total_units: number | null
  total_residential_area: number | null
  total_new_units: number | null
  developer_units: number | null
  developer_floorplate: number | null
  avg_developer_unit_size: number | null
  combination_ratio: number | null

  // Section 2: Proposed State
  total_return_floorplate: number | null
  total_floorplate: number | null

  // Section 3: Building Program
  service_areas: number | null
  total_above_ground: number | null
  floor_area: number | null
  max_buildings: number | null
  above_ground_per_building: number | null
  development_land: number | null
  residential_per_building: number | null
  return_units_per_building: number | null
  developer_units_per_building: number | null
  developer_floorplate_per_building: number | null
  total_parking_spots: number | null
  total_parking_area: number | null
  parking_floors: number | null
  total_balcony_area: number | null

  // Revenue breakdown
  residential_revenue: number | null
  commercial_revenue: number | null

  // Financial
  financing_cost: number | null
  total_costs_excl_vat: number | null
  total_costs_incl_vat: number | null
  expected_profit: number | null
  profit_percent: number | null
  profit_percent_standard21: number | null

  // Breakdown objects
  cost_breakdown: Record<string, number> | null
  revenue_breakdown: Record<string, number> | null
  area_breakdown: Record<string, number> | null

  // Cashflow
  monthly_cash_flows: number[] | null

  // Detailed calculation
  calculation_details: object | null

  // Delta tracking
  previous_results_snapshot: object | null
}
```

### 7.10 Agent Pipeline

```typescript
interface AgentStatus {
  extraction: AgentStepStatus
  research: AgentStepStatus
  calculation: AgentStepStatus
  alternatives: AgentStepStatus
}

interface AgentStepStatus {
  status: "pending" | "running" | "completed" | "error" | "skipped"
  docs_processed?: number
  fields_found?: number
  scenarios_count?: number
  optimizations_count?: number
  error?: string
}

// SSE events
// event: agent_update
// data: { step, status, details, full_status: AgentStatus }

// event: pipeline_complete
// data: AgentStatus
```

### 7.11 Analysis Types

```typescript
interface DeltaAnalysis {
  has_delta: boolean
  deltas: Record<string, {
    before: number
    after: number
    change: number
    change_pct: number
  }>
}

interface ParameterSensitivity {
  base_profit: number
  base_irr: number
  base_profit_pct: number
  parameters: SensitivityParameter[]
}

interface SensitivityParameter {
  field: string
  label: string
  base_value: number
  variants: {
    change_pct: number
    value: number
    profit: number
    irr: number
    profit_pct: number
  }[]
}

interface MissingFields {
  ready: boolean
  missing_planning: string[]
  missing_cost: string[]
  missing_revenue: string[]
  missing_mix: boolean
  warnings: string[]
}

interface ValidationResult {
  ready: boolean
  missing_planning: string[]
  missing_cost: string[]
  missing_revenue: string[]
  missing_mix: boolean
  warnings: string[]
}
```

### 7.12 Alternatives & Scenarios

```typescript
interface AlternativesOut {
  scenarios: Scenario[]
  optimizations: Optimization[]
  ai_validation_notes: string | null
}

interface Scenario {
  name: string         // "Conservative" | "Base" | "Optimistic"
  name_en: string
  description: string
  params_adjustments: object
  results: ScenarioResult
}

interface ScenarioResult {
  profit: number
  profitability_rate: number
  irr: number
  npv: number
  total_revenue: number
  net_revenue: number
  total_costs: number
  developer_units: number
  total_units: number
}

interface Optimization {
  description: string
  impact_estimate: string
  confidence: string
  parameter?: string
  suggested_value?: number
}
```

### 7.13 Market Research

```typescript
interface MarketResearchResponse {
  status: "not_started" | "running" | "completed" | "failed"
  data?: {
    planning_parameters: object
    cost_parameters: object
    revenue_parameters: object
    apartment_mix: ApartmentMix[]
    research_summary?: object
    data_sources?: object
  }
  summary?: object
  planning?: object
  costs?: object
  revenue?: object
  mix?: ApartmentMix[]
}

interface ResearchPreviewField {
  field: string
  section: string
  label_he: string
  current: number | null
  proposed: number
  will_change: boolean
  is_pct: boolean
  is_locked: boolean
}

interface ResearchPreviewResponse {
  fields: ResearchPreviewField[]
  grouped: Record<string, ResearchPreviewField[]>
  summary: {
    total_fields: number
    will_change: number
    will_keep: number
    locked_count: number
  }
  data_sources?: object
  research_summary?: object
  apartment_mix?: ApartmentMix[]
  validation_fixes?: object[]
  confidence?: Record<string, number>
}

interface ApplyResearchResponse {
  status: "applied"
  message: string
  fields_populated: {
    planning: number
    costs: number
    revenue: number
    mix: number
  }
  locked_from_tabu: object
}
```

### 7.14 Extraction Status

```typescript
interface ExtractionStatusResponse {
  project_id: string
  documents: {
    id: string
    document_type: string
    extraction_status: ExtractionStatus
    extraction_error: string | null
  }[]
  tabu_data: TabuData | null
  extraction_progress: object | null
  active_simulation_id: string | null
  active_simulation_status: string | null
}
```

### 7.15 Comparison

```typescript
interface CompareOut {
  simulation_a: SimulationDetail
  simulation_b: SimulationDetail
}
```

---

## 8. Real-Time Communication

### SSE (Server-Sent Events)

**Endpoint:** `GET /api/simulations/:id/agent-stream`

**Events:**
| Event | Payload | When |
|-------|---------|------|
| `agent_update` | `{ step, status, details, full_status }` | Each pipeline step progresses |
| `pipeline_complete` | `AgentStatus` | All 4 steps finished |

**Client behavior:**
- `useAgentStream` hook creates `EventSource` connection
- Exponential backoff retry: 1s → 2s → 4s → 8s → 16s (max 5 retries)
- Auto-closes on `pipeline_complete`
- Falls back to polling `GET /agent-status` every 4s if SSE fails

### Polling Patterns

| Page | Endpoint Polled | Interval | Condition |
|------|-----------------|----------|-----------|
| ProjectDetailPage | `GET /projects/:id` | 2s | While tabu extraction or research is running |
| SimulationWorkspace | `GET /documents/by-simulation/:id` | 2s | While any document is extracting |
| SimulationWorkspace | `GET /simulations/:id/missing-fields` | 2s | After extraction completes |
| SimulationWorkspace (fallback) | `GET /simulations/:id` | 4s | If SSE unavailable during pipeline |

---

## 9. Simulation Status Machine

```
Draft
  |-- (upload docs + extract) --> AI_Extracting
  |                                   |
  |                                   v
  |                            Pending_Review
  |                                   |
  |-- (approve) -or- (direct) ------> Approved_For_Calc
                                      |
                                      v
                                   Completed
```

| Status | Meaning |
|--------|---------|
| `Draft` | Newly created, no extraction started |
| `AI_Extracting` | Documents being processed by AI agents |
| `Pending_Review` | Extraction done, awaiting user review/approval |
| `Approved_For_Calc` | Parameters approved, ready for calculation |
| `Completed` | Calculation done, results available |

---

## 10. Database Models (ERD Summary)

```
Project (1) ──────< (N) Document
   |                        |
   |                        |
   └──< (N) Simulation ────┘ (optional link)
                |
                ├── (1) PlanningParameter
                ├── (1) CostParameter
                ├── (1) RevenueParameter
                ├── (1) EconomicParameter
                ├── (N) ApartmentMix
                └── (1) SimulationResult
```

---

## 11. AI Agent Pipeline Details

### Stage 1: Extraction Agent
- Reads PDF documents attached to the simulation
- Uses Claude to extract structured Hebrew data
- Populates planning, cost, revenue parameters and apartment mix
- Stores raw extraction in `Document.extracted_data`
- Tracks confidence scores in `ai_extraction_metadata`

### Stage 2: Research Agent
- Receives list of missing fields + all document texts
- Re-reads documents for indirect references (tables, footnotes, appendices)
- Returns: `found_fields`, `still_missing`, `sources`

### Stage 3: Calculation Agent
- Runs the full Shikun & Binui financial engine (~1000 lines)
- Computes: proposed state → building program → costs → revenue → cashflow → IRR/NPV
- AI validates results for reasonableness
- Stores snapshot of previous results for delta analysis

### Stage 4: Alternatives Agent
- Generates 3 scenarios: Conservative, Base, Optimistic
- Each adjusts key parameters and recalculates
- Produces optimization recommendations with confidence scores
- Adds AI validation notes

### Market Research Agent (Separate, project-level)
- 5-step web research pipeline
- Identifies neighborhood from tabu gush/chelka
- Researches zoning, construction costs, sale prices
- Produces default parameters for new simulations
- Protected fields (from tabu) cannot be overwritten
- Non-destructive merge: only fills null/0 fields

---

## 12. Error Handling

### HTTP Status Codes
| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `204` | No Content (delete) |
| `400` | Validation error / missing fields |
| `404` | Resource not found |
| `500` | Server error |

### Error Response Format
```json
{
  "detail": "error message"
}
```

### Validation Error (400)
```json
{
  "detail": {
    "code": "MISSING_FIELDS",
    "message": "חסרים שדות נדרשים לחישוב",
    "validation": {
      "ready": false,
      "missing_planning": ["number_of_floors", "coverage_above_ground"],
      "missing_cost": [],
      "missing_revenue": ["price_per_sqm_residential"],
      "missing_mix": true,
      "warnings": []
    }
  }
}
```

---

## 13. UI/UX Notes

- **Full RTL Hebrew interface** — all text, labels, and layouts are right-to-left
- **Framer Motion** page transitions and card hover animations
- **Recharts** for all financial visualizations (Hebrew labels)
- **React Hot Toast** for notifications
- **Canvas Confetti** celebration effect on results page
- **Lucide Icons** throughout the UI
- **Responsive grid** layout (1 → 2 → 3 columns)
- **Collapsible sections** for parameter groups
- **Confidence badges** on AI-extracted fields
- **Color-coded status badges** for simulation and document states
