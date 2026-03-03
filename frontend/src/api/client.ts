const BASE_URL = '/api';

export class ApiError extends Error {
  data: Record<string, unknown> | null;
  status: number;

  constructor(message: string, status: number, data?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data ?? null;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let detail: unknown;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const err = await res.json();
      detail = err.detail;
    } else {
      const text = await res.text();
      detail = text || res.statusText;
    }
    if (typeof detail === 'object' && detail !== null) {
      throw new ApiError(
        (detail as Record<string, string>).message || `HTTP ${res.status}`,
        res.status,
        detail as Record<string, unknown>,
      );
    }
    throw new ApiError(typeof detail === 'string' ? detail : `HTTP ${res.status}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export default request;
