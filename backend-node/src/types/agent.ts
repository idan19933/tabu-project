/**
 * @file types/agent.ts
 * @description TypeScript types for the AI agent pipeline events and status tracking.
 * Events are emitted by the orchestrator and stored in-memory for SSE delivery.
 */

/**
 * A single event emitted by the agent orchestrator during pipeline execution.
 * Events are indexed sequentially and polled by the SSE endpoint.
 */
export interface AgentEvent {
  /** The pipeline step that produced this event (e.g. `'extraction'`, `'research'`, `'pipeline'`). */
  step: string;
  /** Current status of the step. */
  status: 'running' | 'completed' | 'failed';
  /** Optional step-specific payload (e.g. extracted params, error details). */
  details?: any;
  /** Unix timestamp (ms) when the event was created. */
  timestamp: number;
  /** Monotonically increasing index used by the SSE client to request only new events via `?after=`. */
  index: number;
}

/**
 * Per-step status summary stored on the `Simulation.agentStatus` JSON field.
 * Each step is optional — it is only populated once that step has been attempted.
 */
export interface AgentStatus {
  /** Status of the document extraction step. */
  extraction?: { status: string; details?: any };
  /** Status of the market research step. */
  research?: { status: string; details?: any };
  /** Status of the financial calculation step. */
  calculation?: { status: string; details?: any };
  /** Status of the scenario alternatives generation step. */
  alternatives?: { status: string; details?: any };
}
