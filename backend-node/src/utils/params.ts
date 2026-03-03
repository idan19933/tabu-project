/**
 * Extract a single string param from Express 5 params (which are string | string[]).
 */
export function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0];
  return value || '';
}
