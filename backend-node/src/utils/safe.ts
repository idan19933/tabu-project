/**
 * Safely convert a Prisma Decimal, number, or null to a plain number.
 * Returns `defaultVal` if the value is null, undefined, or NaN.
 */
export function safe(
  val: unknown,
  defaultVal = 0
): number {
  if (val == null) return defaultVal;
  const n = typeof val === 'number' ? val : Number(val);
  return isNaN(n) ? defaultVal : n;
}
