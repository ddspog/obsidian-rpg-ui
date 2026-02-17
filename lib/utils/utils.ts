/**
 * Deeply merges a source object (which may be nullable/have optional properties)
 * with a default object containing sensible defaults for all properties.
 *
 * @param source The source object with optional properties (may be null/undefined)
 * @param defaults The default object with sensible defaults for all properties
 * @returns A new object with values from source where available, falling back to defaults
 */
export function mergeWithDefaults<T extends object>(source: Partial<T> | null | undefined, defaults: T): T {
  // If source is null or undefined, return a copy of defaults
  if (source == null) {
    return { ...defaults };
  }

  const result = { ...defaults } as T;
  const sourceRecord = source as Record<string, unknown>;
  const defaultRecord = defaults as Record<string, unknown>;

  // Iterate through all properties in the source object
  for (const key of Object.keys(sourceRecord)) {
    const sourceValue = sourceRecord[key];
    const defaultValue = defaultRecord[key];

    // If the current property exists in the source
    // Handle nested objects recursively
    if (
      sourceValue !== null &&
      sourceValue !== undefined &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      defaultValue !== null &&
      defaultValue !== undefined &&
      typeof defaultValue === "object" &&
      !Array.isArray(defaultValue)
    ) {
      // Recursively merge nested objects
      (result as Record<string, unknown>)[key] = mergeWithDefaults(
        sourceValue as Record<string, unknown>,
        defaultValue as Record<string, unknown>
      );
    } else {
      // For non-objects or arrays, use source value if it's not null/undefined,
      // otherwise use the default
      (result as Record<string, unknown>)[key] =
        sourceValue !== undefined && sourceValue !== null ? sourceValue : defaultValue;
    }
  }

  return result;
}
