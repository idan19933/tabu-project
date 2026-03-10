/**
 * @module safe
 * Utility for safely converting Prisma Decimal values and other unknown types to plain numbers.
 */

/**
 * Safely convert a Prisma Decimal, number, string, or null/undefined to a plain number.
 *
 * @param val - The value to convert; accepts Prisma Decimal objects, numbers, strings, null, or undefined.
 * @param defaultVal - The fallback value returned when `val` is null, undefined, or NaN. Defaults to `0`.
 * @returns A plain JavaScript number, or `defaultVal` if conversion is not possible.
 */
export function safe(
  val: unknown,
  defaultVal = 0
): number {
  if (val == null) return defaultVal;
  const n = typeof val === 'number' ? val : Number(val);
  return isNaN(n) ? defaultVal : n;
}
