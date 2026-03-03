import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Custom hook for interval polling with auto-cleanup.
 * Polls `fn` every `intervalMs` while `enabled` is true.
 */
export function usePolling<T>(
  fn: () => Promise<T>,
  intervalMs: number = 3000,
  enabled: boolean = true,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const mountedRef = useRef(true);

  const poll = useCallback(async () => {
    try {
      const result = await fn();
      if (mountedRef.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Polling error');
      }
    }
  }, [fn]);

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // Initial fetch
    poll();

    // Start interval
    timerRef.current = setInterval(poll, intervalMs);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [poll, intervalMs, enabled]);

  return { data, error, refetch: poll };
}
