# Tabu Project — Agent Memory

## Serialization: Prisma 7 Already Snake_cases via @map

Prisma 7 (`prisma-client` generator) serializes JS objects to JSON using `@map` column names
automatically. So `createdAt` with `@map("created_at")` is serialized as `created_at` when
`JSON.stringify` is called (e.g., via `res.json()`). This means the backend-node already returns
snake_case field names without extra transformation.

A defensive `snakeCaseResponse` middleware was added in `src/app.ts` that also converts
Prisma Decimal objects to numbers. File: `src/utils/serialize.ts`.

## Key Data Flow: snake_case Throughout

- DB columns: snake_case (via `@map`)
- Prisma TS fields: camelCase (internal Prisma models)
- API responses: snake_case (Prisma auto-serializes via @map)
- Frontend types (in `frontend/src/types/index.ts`): snake_case
- Frontend form payloads sent to API: snake_case
- `simulation.service.ts` converts snake_case body → camelCase for Prisma upsert via `mapPlanningToCamel` etc.

## Bug Fixed: project.data-access.ts Missing Fields

`projectWithRelations` (used in `findById`) was missing `filePath` and `uploadDate` from
the documents select. This caused `doc.upload_date` to be `undefined` in ProjectDetailPage,
showing "Invalid Date". Fixed by adding both fields + `orderBy` clauses.
File: `src/api/data-access/project.data-access.ts`

## Bug Fixed: getDeltaAnalysis Wrong Response Format

The delta controller was returning `{ delta }` but the frontend `DeltaAnalysis` type expects
`{ has_delta: boolean, deltas: Record<string, DeltaField> }`. Also `DeltaField` uses
`{ before, after, change, change_pct }` keys. Fixed in `simulations.controller.ts`.

## Bug Fixed: getExtractionStatus Wrong extraction_progress Format

The controller was returning a `Record<string, string>` (docId→status map) but the frontend
`ExtractionStatusResponse.extraction_progress` expects `{ total_docs, completed_docs, current_step, percentage }`.
Fixed in `src/api/controllers/extraction.controller.ts`.

## All 8 Frontend Routes Confirmed Present (App.tsx)

`/` → ProjectsPage, `/projects/:id` → ProjectDetailPage, `/projects/:id/upload` → DocumentUploadPage,
`/simulations/:id/workspace` → SimulationWorkspace, `/simulations/:id/review` → ReviewApprovePage,
`/simulations/:id/edit` → SimulationEditorPage, `/simulations/:id/results` → ResultsPage,
`/compare` → ComparePage

## All PRD API Endpoints Confirmed Implemented

All 30+ endpoints from PRD.md are implemented. See routes files:
`src/api/routes/projects.routes.ts`, `simulations.routes.ts`, `documents.routes.ts`,
`research.routes.ts`, `extraction.routes.ts`

## Key File Locations

- Calculation engine: `backend-node/src/api/services/calculation.service.ts` (~956 lines)
- Sensitivity analysis: `backend-node/src/api/services/sensitivity.service.ts`
- Pipeline orchestration: `backend-node/src/api/services/pipeline.service.ts`
- Document extraction AI: `backend-node/src/api/services/ai/document-extraction.service.ts`
- Market research AI: `backend-node/src/api/services/ai/market-research.service.ts`
- Scenario analysis AI: `backend-node/src/api/services/ai/scenario-analysis.service.ts`
- Prisma schema: `backend-node/prisma/schema.prisma`
- Generated client: `backend-node/prisma/generated/prisma/client.ts`

## Backend Dev Server

Runs on port 8000 via `nodemon src/index.ts`. Frontend Vite proxies `/api` → `localhost:8000`.

## Validation Response Has Extra Field

`calculateService.validateSimulationReady` returns `missing_economic` in addition to the
fields defined in the frontend `MissingFields` type. This is harmless (extra fields ignored by TS).

## Sensitivity Service Uses Prisma camelCase Internally

`sensitivity.service.ts` reads `sim.planningParameters`, `sim.costParameters` etc. (Prisma
camelCase) and parameter field names like `numberOfFloors`, `returnsPercent` (also camelCase).
This is correct because the service receives the raw Prisma sim object, not the serialized response.

## Bug Fixed: Tabu Extraction Ignored Explicit document_type (2026-03)

`runDocumentExtraction()` always called AI `detectDocType()` even when the document was
explicitly uploaded as `document_type='tabu'`. The AI can misclassify, so `tabu_data` was
never stored on the project. Fix: added `hintDocumentType` param to `runDocumentExtraction()`;
when hint is `'tabu'`, skip AI detection and call `extractTabu()` directly.
`documents.controller.ts` now passes `document_type` from request body as hint.
Files: `src/api/services/ai/document-extraction.service.ts`, `src/api/controllers/documents.controller.ts`

## Bug Fixed: Frontend Blocked Simulation Creation Without tabu_data (2026-03)

`ProjectDetailPage` gated both the "New Simulation" button and the simulations section
on `hasTabuData = !!project?.tabu_data`. Per PRD Manual Flow, users must always be able
to create simulations. Fix: removed all `hasTabuData` gates from button and simulations list.
Added `tabuDocCompletedEmpty` state (doc exists + Completed status + tabu_data is null) to show
a warning card with re-upload option rather than the "must upload" lock message.
File: `frontend/src/pages/ProjectDetailPage.tsx`

## ProjectDetailPage Tabu Section State Machine
1. `hasTabuData` → show full `<TabuPreview>`
2. `isTabuExtracting` → show animated extraction progress card
3. `tabuDocCompletedEmpty` (doc exists, Completed, no tabu_data) → amber warning + re-upload button
4. No tabu doc → dashed upload zone (optional, not blocking creation)
