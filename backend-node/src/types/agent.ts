export interface AgentEvent {
  step: string;
  status: 'running' | 'completed' | 'failed';
  details?: any;
  timestamp: number;
  index: number;
}

export interface AgentStatus {
  extraction?: { status: string; details?: any };
  research?: { status: string; details?: any };
  calculation?: { status: string; details?: any };
  alternatives?: { status: string; details?: any };
}
