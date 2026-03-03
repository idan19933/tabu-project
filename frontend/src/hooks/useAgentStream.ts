import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentStatus } from '../types';

const DEFAULT_STATUS: AgentStatus = {
  extraction: { status: 'pending' },
  research: { status: 'pending' },
  calculation: { status: 'pending' },
  alternatives: { status: 'pending' },
};

/**
 * SSE hook for real-time agent pipeline status.
 * Connects to GET /api/simulations/{id}/agent-stream
 *
 * Auto-connects if a simulationId is provided and autoConnect is true.
 * Reconnects on error with exponential backoff.
 */
export function useAgentStream(simulationId: string | null) {
  const [status, setStatus] = useState<AgentStatus>(DEFAULT_STATUS);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disconnect = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!simulationId) return;

    // Close any existing connection
    disconnect();

    setIsRunning(true);
    setIsComplete(false);

    const es = new EventSource(`/api/simulations/${simulationId}/agent-stream`);
    eventSourceRef.current = es;
    retryCountRef.current = 0;

    es.addEventListener('agent_update', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.full_status) {
          setStatus(data.full_status as AgentStatus);
        }
        // Show running step name
        if (data.step && data.status === 'running') {
          setLastEvent(`${data.step} — פועל...`);
        } else if (data.step && data.status === 'completed') {
          setLastEvent(`${data.step} — הושלם`);
        }
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener('pipeline_complete', (e) => {
      try {
        const data = JSON.parse(e.data);
        setStatus(data as AgentStatus);
      } catch {
        // ignore
      }
      setIsRunning(false);
      setIsComplete(true);
      setLastEvent('הצינור הושלם בהצלחה!');
      es.close();
    });

    es.onerror = () => {
      es.close();
      // Retry with backoff (max 5 retries, 1s/2s/4s/8s/16s)
      if (retryCountRef.current < 5) {
        const delay = Math.pow(2, retryCountRef.current) * 1000;
        retryCountRef.current += 1;
        retryTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        setIsRunning(false);
      }
    };
  }, [simulationId, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { status, isRunning, isComplete, lastEvent, connect, disconnect };
}
