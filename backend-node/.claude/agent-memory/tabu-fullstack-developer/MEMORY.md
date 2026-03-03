# TabuApp Backend-Node Agent Memory

## Key File Locations
- Controller: `src/api/controllers/simulations.controller.ts`
- Service: `src/api/services/simulation.service.ts`
- Data-access: `src/api/data-access/simulation.data-access.ts`
- Calculation engine: `src/api/services/calculation.service.ts` (~956 lines)
- Report generation: `src/api/services/report.service.ts` (ExcelJS, Hebrew RTL)
- Pipeline orchestrator: `src/agents/orchestrator.ts`

## Server
- Runs on port 8000 (from .env PORT=8000)
- Health check: `GET /api/health`
- Live-reloads source changes automatically (tsx watch mode)

## Confirmed Working Endpoints (tested 2026-03-03)
- `POST /api/simulations/:id/calculate` → returns full sim with status=Completed
- `GET /api/simulations/:id/compare/:otherId` → returns `{ simulation_a, simulation_b }`
- `GET /api/simulations/:id/report/management` → 200 xlsx download
- `GET /api/simulations/:id/report/economic` → 200 xlsx download
- `GET /api/simulations/:id/review` → same as getById, includes all param relations

## Critical Bug Fixed
`calculateSimulation` controller was returning stale status. Fix: use `setStatus()` return
value as the response instead of the intermediate `saveResults()` return value.
`setStatus` calls `updateStatus` in data-access which returns full `include` result.
See: `src/api/controllers/simulations.controller.ts` lines 55-66.

## Patterns
- `simulationFullInclude` object in data-access includes all 6 relations
- `updateStatus` returns full include — safe to use as API response
- `saveResults` also calls `findById` internally — but does NOT update status, so returning
  its result would give stale status if called before setStatus
- `setStatus` in service calls `findById` first (guards 404), then calls `updateStatus`
  which does the Prisma update with full include and returns the updated record

## Compare Response Format
`{ simulation_a: SimulationDetail, simulation_b: SimulationDetail }` — matches frontend
`CompareOut` type in `frontend/src/types/index.ts`.

## Review Page (frontend)
- Component: `frontend/src/pages/ReviewApprovePage.tsx`
- Shows planning/cost/revenue params with `ConfidenceBadge` from `ai_extraction_metadata`
- Gracefully handles null `ai_extraction_metadata` (badges simply don't render)
- Approve button disabled unless `status === 'Pending_Review'`
- After approve, navigates to `/simulations/:id/edit`

## Report Service Notes
- Both management and economic reports work even with null simulationResults
  (getAllResults() returns empty/zero defaults for missing fields)
- Reports contain Hebrew text, RTL worksheet view, ExcelJS formatting
- Sensitivity matrix embedded in economic report (5x5 revenue vs cost grid)
