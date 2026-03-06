/**
 * @module params
 * Utility for safely extracting route parameters from Express 5 handlers.
 *
 * In Express 5, `req.params` values are typed as `string | string[]`.
 * This module normalises that union so callers always receive a plain string.
 */

/**
 * Extract a single string value from an Express 5 route parameter.
 *
 * Express 5 types route params as `string | string[]`. This helper always
 * returns the first element when an array is received, or an empty string
 * when the value is undefined.
 *
 * @param value - The raw param value from `req.params`.
 * @returns A single string — the param value, the first element of the array, or `''`.
 */
export function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0];
  return value || '';
}
