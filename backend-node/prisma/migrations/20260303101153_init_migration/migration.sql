-- CreateEnum
CREATE TYPE "SimulationStatus" AS ENUM ('Draft', 'AI_Extracting', 'Pending_Review', 'Approved_For_Calc', 'Completed');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('Pending', 'Processing', 'Completed', 'Failed');

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tabu_data" JSONB,
    "market_research_data" JSONB,
    "market_research_status" VARCHAR(20),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulations" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "version_name" TEXT NOT NULL,
    "status" "SimulationStatus" NOT NULL DEFAULT 'Draft',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extraction_progress" JSONB,
    "agent_status" JSONB,

    CONSTRAINT "simulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "simulation_id" UUID,
    "document_type" TEXT NOT NULL,
    "doc_type" VARCHAR(50),
    "file_path" TEXT NOT NULL,
    "upload_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extraction_status" "ExtractionStatus" NOT NULL DEFAULT 'Pending',
    "extraction_error" TEXT,
    "extracted_data" JSONB,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_parameters" (
    "simulation_id" UUID NOT NULL,
    "returns_percent" DECIMAL(5,2),
    "multiplier_far" DECIMAL(5,2),
    "avg_apt_size_sqm" DECIMAL(8,2),
    "service_area_sqm" DECIMAL(8,2),
    "number_of_floors" INTEGER,
    "coverage_above_ground" DECIMAL(5,2),
    "coverage_underground" DECIMAL(5,2),
    "gross_area_per_parking" DECIMAL(8,2),
    "building_lines_notes" TEXT,
    "public_tasks_notes" TEXT,
    "parking_standard_ratio" DECIMAL(5,2),
    "typ_floor_area_min" DECIMAL(8,2),
    "typ_floor_area_max" DECIMAL(8,2),
    "apts_per_floor_min" INTEGER,
    "apts_per_floor_max" INTEGER,
    "return_area_per_apt" DECIMAL(8,2),
    "service_area_percent" DECIMAL(5,2),
    "public_area_sqm" DECIMAL(10,2),
    "parking_floor_area" DECIMAL(10,2),
    "balcony_area_per_unit" DECIMAL(8,2),
    "blue_line_area" DECIMAL(10,2),
    "planning_stage" VARCHAR(50),
    "ai_extraction_metadata" JSONB,

    CONSTRAINT "planning_parameters_pkey" PRIMARY KEY ("simulation_id")
);

-- CreateTable
CREATE TABLE "cost_parameters" (
    "simulation_id" UUID NOT NULL,
    "construction_duration_months" INTEGER,
    "cost_per_sqm_residential" DECIMAL(12,2),
    "cost_per_sqm_service" DECIMAL(12,2),
    "cost_per_sqm_commercial" DECIMAL(12,2),
    "cost_per_sqm_balcony" DECIMAL(12,2),
    "cost_per_sqm_development" DECIMAL(12,2),
    "betterment_levy" DECIMAL(14,2),
    "purchase_tax" DECIMAL(14,2),
    "planning_consultants" DECIMAL(14,2),
    "permits_fees" DECIMAL(14,2),
    "electricity_connection" DECIMAL(14,2),
    "bank_supervision" DECIMAL(14,2),
    "engineering_management" DECIMAL(14,2),
    "tenant_supervision" DECIMAL(14,2),
    "management_overhead" DECIMAL(14,2),
    "marketing_advertising" DECIMAL(14,2),
    "tenant_lawyer" DECIMAL(14,2),
    "initiation_fee" DECIMAL(14,2),
    "developer_lawyer" DECIMAL(14,2),
    "rent_subsidy" DECIMAL(14,2),
    "evacuation_cost" DECIMAL(14,2),
    "moving_cost" DECIMAL(14,2),
    "contingency" DECIMAL(14,2),
    "demolition" DECIMAL(14,2),
    "construction_total" DECIMAL(14,2),
    "parking_construction" DECIMAL(14,2),
    "financing_interest_rate" DECIMAL(5,2),
    "vat_rate" DECIMAL(5,2),
    "cpi_linkage_pct" DECIMAL(5,2),
    "planning_consultants_pct" DECIMAL(5,2),
    "permits_fees_pct" DECIMAL(5,2),
    "bank_supervision_pct" DECIMAL(5,2),
    "engineering_management_pct" DECIMAL(5,2),
    "tenant_supervision_pct" DECIMAL(5,2),
    "management_overhead_pct" DECIMAL(5,2),
    "marketing_advertising_pct" DECIMAL(5,2),
    "tenant_lawyer_pct" DECIMAL(5,2),
    "developer_lawyer_pct" DECIMAL(5,2),
    "contingency_pct" DECIMAL(5,2),
    "initiation_fee_pct" DECIMAL(5,2),
    "data_sources" JSONB,
    "ai_extraction_metadata" JSONB,

    CONSTRAINT "cost_parameters_pkey" PRIMARY KEY ("simulation_id")
);

-- CreateTable
CREATE TABLE "revenue_parameters" (
    "simulation_id" UUID NOT NULL,
    "price_per_unit_by_type" JSONB,
    "price_per_sqm_residential" DECIMAL(12,2),
    "price_per_sqm_commercial" DECIMAL(12,2),
    "sales_pace_per_month" DECIMAL(8,2),
    "marketing_discount_pct" DECIMAL(5,2),
    "price_per_sqm_parking" DECIMAL(12,2),
    "price_per_sqm_storage" DECIMAL(12,2),
    "ai_extraction_metadata" JSONB,

    CONSTRAINT "revenue_parameters_pkey" PRIMARY KEY ("simulation_id")
);

-- CreateTable
CREATE TABLE "apartment_mix" (
    "id" UUID NOT NULL,
    "simulation_id" UUID NOT NULL,
    "apartment_type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "percentage_of_mix" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "apartment_mix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "economic_parameters" (
    "simulation_id" UUID NOT NULL,
    "sales_prices_by_use" JSONB NOT NULL,
    "cost_construction_dev" DECIMAL(12,2) NOT NULL,
    "cost_planning_mgmt" DECIMAL(12,2) NOT NULL,
    "levies_fees_taxes" DECIMAL(12,2) NOT NULL,
    "timeline_months" INTEGER NOT NULL,
    "interest_rate" DECIMAL(5,2) NOT NULL,
    "sales_pace_per_month" DECIMAL(8,2) NOT NULL,
    "marketing_discount_pct" DECIMAL(5,2) NOT NULL,
    "ai_extraction_metadata" JSONB,

    CONSTRAINT "economic_parameters_pkey" PRIMARY KEY ("simulation_id")
);

-- CreateTable
CREATE TABLE "simulation_results" (
    "simulation_id" UUID NOT NULL,
    "profit" DECIMAL(14,2),
    "profitability_rate" DECIMAL(8,4),
    "irr" DECIMAL(8,4),
    "npv" DECIMAL(14,2),
    "total_revenue" DECIMAL(14,2),
    "net_revenue" DECIMAL(14,2),
    "total_costs" DECIMAL(14,2),
    "construction_cost" DECIMAL(14,2),
    "planning_cost" DECIMAL(14,2),
    "levies_cost" DECIMAL(14,2),
    "total_units" INTEGER,
    "total_residential_area" DECIMAL(12,2),
    "residential_revenue" DECIMAL(14,2),
    "commercial_revenue" DECIMAL(14,2),
    "monthly_cash_flows" JSONB,
    "total_return_floorplate" DECIMAL(12,2),
    "total_new_units" INTEGER,
    "total_floorplate" DECIMAL(12,2),
    "developer_units" INTEGER,
    "developer_floorplate" DECIMAL(12,2),
    "avg_developer_unit_size" DECIMAL(8,2),
    "combination_ratio" DECIMAL(8,4),
    "service_areas" DECIMAL(12,2),
    "total_above_ground" DECIMAL(12,2),
    "floor_area" DECIMAL(12,2),
    "max_buildings" INTEGER,
    "above_ground_per_building" DECIMAL(12,2),
    "development_land" DECIMAL(12,2),
    "residential_per_building" DECIMAL(12,2),
    "return_units_per_building" INTEGER,
    "developer_units_per_building" INTEGER,
    "developer_floorplate_per_building" DECIMAL(12,2),
    "total_parking_spots" INTEGER,
    "total_parking_area" DECIMAL(12,2),
    "parking_floors" INTEGER,
    "total_balcony_area" DECIMAL(12,2),
    "financing_cost" DECIMAL(14,2),
    "total_costs_excl_vat" DECIMAL(14,2),
    "total_costs_incl_vat" DECIMAL(14,2),
    "expected_profit" DECIMAL(14,2),
    "profit_percent" DECIMAL(8,4),
    "profit_percent_standard21" DECIMAL(8,4),
    "cost_breakdown" JSONB,
    "revenue_breakdown" JSONB,
    "area_breakdown" JSONB,
    "calculation_details" JSONB,
    "scenarios" JSONB,
    "optimizations" JSONB,
    "ai_validation_notes" TEXT,
    "previous_results_snapshot" JSONB,

    CONSTRAINT "simulation_results_pkey" PRIMARY KEY ("simulation_id")
);

-- AddForeignKey
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "simulations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_parameters" ADD CONSTRAINT "planning_parameters_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "simulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_parameters" ADD CONSTRAINT "cost_parameters_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "simulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_parameters" ADD CONSTRAINT "revenue_parameters_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "simulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apartment_mix" ADD CONSTRAINT "apartment_mix_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "simulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "economic_parameters" ADD CONSTRAINT "economic_parameters_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "simulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_results" ADD CONSTRAINT "simulation_results_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "simulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
