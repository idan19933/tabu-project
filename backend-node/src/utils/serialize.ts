/**
 * Converts a camelCase string to snake_case.
 */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Recursively converts all object keys from camelCase to snake_case.
 * Handles nested objects, arrays, Dates, and Prisma Decimal types.
 *
 * @param value - The value to transform
 * @param skipKeys - A set of keys whose *values* will NOT have their sub-keys
 *                  converted (useful for free-form JSON fields you control).
 */
export function snakeCaseResponse(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // Prisma Decimal objects have a `.toFixed` method; convert to number
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).toFixed === 'function' &&
    typeof (value as any).toNumber === 'function'
  ) {
    return (value as any).toNumber();
  }

  if (Array.isArray(value)) {
    return value.map(snakeCaseResponse);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const snakeKey = toSnakeCase(key);
      result[snakeKey] = snakeCaseResponse(val);
    }
    return result;
  }

  return value;
}
