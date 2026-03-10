/**
 * @module serialize
 * Serialization helpers for converting Prisma query results to API-safe objects.
 *
 * Handles the following transformations:
 *  - camelCase object keys → snake_case (for REST responses)
 *  - Prisma Decimal objects → plain JavaScript numbers
 *  - Date objects → ISO 8601 strings
 *  - Arrays and nested objects (recursive)
 */

/**
 * Convert a camelCase string to snake_case.
 *
 * @param str - A camelCase identifier string.
 * @returns The snake_case equivalent.
 */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Recursively convert all object keys from camelCase to snake_case, converting
 * Prisma Decimal values to numbers and Date objects to ISO strings along the way.
 *
 * Handles:
 *  - Prisma Decimal objects (detected via `.toFixed` + `.toNumber` methods)
 *  - Arrays (each element is transformed recursively)
 *  - Date objects (converted to ISO 8601 strings)
 *  - Plain objects (keys converted, values transformed recursively)
 *  - Primitives (returned unchanged)
 *
 * @param value - The value to transform. Can be any type returned by a Prisma query.
 * @returns The fully snake_case-keyed, serialization-safe equivalent of `value`.
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
