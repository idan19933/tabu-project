import { useCallback, useEffect, useRef, useState } from 'react';

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const execute = useCallback(async () => {
    // Only show loading spinner on initial load, not on background refetches
    if (!hasLoadedRef.current) {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await fn();
      setData(result);
      hasLoadedRef.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    hasLoadedRef.current = false;
    execute();
  }, [execute]);

  return { data, loading, error, refetch: execute };
}
