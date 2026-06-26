/**
 * Dynamic locator resolver — expands `{placeholder}` patterns in testId keys
 * into all value combinations at runtime.
 *
 * @example
 * ```ts
 * const testIds = {
 *   staticKey: 'static-test-id',
 *   "{status}{id}Chart": {
 *     id: ['line', 'bar'],
 *     status: ['active', 'inactive'],
 *     testId: "status-id-chart"
 *   }
 * };
 *
 * expandDynamicLocators(testIds);
 * // => {
 * //   staticKey: 'static-test-id',
 * //   activeLineChart:    'active-line-chart',
 * //   activeBarChart:     'active-bar-chart',
 * //   inactiveLineChart:  'inactive-line-chart',
 * //   inactiveBarChart:   'inactive-bar-chart'
 * // }
 * ```
 */

/**
 * Shape of a dynamic testId entry.
 *
 * `testId` — the test-id pattern with placeholder *names* as literal substrings.
 * Every other property is a placeholder name mapped to its list of allowed values.
 */
export type DynamicTestIdEntry = {
  testId?: string;
  [placeholder: string]: string | readonly string[] | undefined;
};

export type DynamicSelectorEntry = {
  selector?: string;
  [placeholder: string]: string | readonly string[] | undefined;
};

export type DynamicLocatorEntry = DynamicTestIdEntry | DynamicSelectorEntry;

/** Returns true when `key` contains at least one `{…}` placeholder. */
export function isDynamicKey(key: string): boolean {
  return /\{[^}]+\}/.test(key);
}

/**
 * Capitalize the first character of a string.
 * @internal
 */
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Compute the cartesian product of an array-of-arrays.
 *
 * @example cartesianProduct([['a','b'],['1','2']]) // [['a','1'],['a','2'],['b','1'],['b','2']]
 * @internal
 */
function cartesianProduct(arrays: readonly (readonly string[])[]): string[][] {
  if (arrays.length === 0) return [[]];
  return arrays.reduce<string[][]>(
    (acc, arr) => acc.flatMap(combo => arr.map(val => [...combo, val])),
    [[]]
  );
}

/**
 * Extract placeholder names from a pattern like `"{status}{id}Chart"`.
 * @internal
 */
function extractPlaceholders(pattern: string): string[] {
  const names: string[] = [];
  const re = /\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pattern)) !== null) {
    names.push(m[1]);
  }
  return names;
}

/**
 * Expand a single dynamic key pattern + entry into flat key → locator-value pairs.
 * Validates the entry at runtime before expansion.
 * @internal
 */
function expandSingleDynamic(
  pattern: string,
  entry: DynamicLocatorEntry
): Record<string, string> {
  const testIdPattern = entry.testId;
  const selectorPattern = entry.selector;
  const targetPattern = (testIdPattern !== undefined ? testIdPattern : selectorPattern) as string;
  const targetKey = testIdPattern !== undefined ? 'testId' : 'selector';

  if (targetPattern === undefined) {
    throw new Error(
      `Dynamic locator "${pattern}": entry must contain either 'testId' or 'selector' property.`
    );
  }

  const placeholders = { ...entry } as any;
  delete placeholders.testId;
  delete placeholders.selector;

  // ─── Validation ──────────────────────────────────────────────────────
  const expectedNames = extractPlaceholders(pattern);

  // 0.5. No duplicate placeholders in the pattern
  const uniqueNames = Array.from(new Set(expectedNames));
  if (uniqueNames.length !== expectedNames.length) {
    throw new Error(
      `Dynamic locator "${pattern}": pattern has duplicate placeholders.`
    );
  }

  // 1. No unknown keys (only placeholder names + targetKey)
  const actualKeys = Object.keys(placeholders);
  const unknownKeys = actualKeys.filter(k => !expectedNames.includes(k));
  if (unknownKeys.length > 0) {
    throw new Error(
      `Dynamic locator "${pattern}": unknown key(s) [${unknownKeys.join(', ')}]. ` +
      `Only '${targetKey}' and placeholder keys [${expectedNames.join(', ')}] are allowed.`
    );
  }

  // 2. All placeholders from the pattern must have a key in the entry
  const missingKeys = expectedNames.filter(name => !(name in placeholders));
  if (missingKeys.length > 0) {
    throw new Error(
      `Dynamic locator "${pattern}": missing placeholder key(s) [${missingKeys.join(', ')}]. ` +
      `You must provide values for all placeholders defined in the pattern.`
    );
  }

  // 2.5. Placeholder values must be arrays
  const nonArrayKeys = expectedNames.filter(name => !Array.isArray(placeholders[name]));
  if (nonArrayKeys.length > 0) {
    throw new Error(
      `Dynamic locator "${pattern}": placeholder key(s) [${nonArrayKeys.join(', ')}] must be arrays.`
    );
  }

  // 3. All placeholder names must appear as substrings in the target pattern value
  const missingInPattern = expectedNames.filter(name => !targetPattern.includes(name));
  if (missingInPattern.length > 0) {
    throw new Error(
      `Dynamic locator "${pattern}": ${targetKey} "${targetPattern}" does not contain ` +
      `placeholder name(s) [${missingInPattern.join(', ')}]. ` +
      `All placeholder names must appear in the ${targetKey} so they can be replaced at runtime.`
    );
  }

  // ─── Expansion ───────────────────────────────────────────────────────

  // Sort placeholder names longest-first to avoid substring replacement issues
  const names = Object.keys(placeholders).sort((a, b) => b.length - a.length);
  const values = names.map(name => {
    const v = placeholders[name];
    return v as string[];
  });

  const result: Record<string, string> = {};

  for (const combo of cartesianProduct(values)) {
    // Build the *key* — replace {name} with Capitalize(value), then uncapitalize the first char
    let expandedKey = pattern;
    let expandedValue = targetPattern;

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const val = combo[i];
      expandedKey = expandedKey.replace(`{${name}}`, capitalize(val));
      expandedValue = expandedValue.replaceAll(name, targetKey === 'selector' ? val : val.toLowerCase());
    }

    // camelCase: uncapitalize the first character
    expandedKey = expandedKey.charAt(0).toLowerCase() + expandedKey.slice(1);

    result[expandedKey] = expandedValue;
  }

  return result;
}

/**
 * Expands all dynamic entries in a `testIds` map into a flat `key → testId` map.
 * Static (string-valued) entries pass through unchanged.
 */
export function expandDynamicLocators(
  testIds: Record<string, string | DynamicLocatorEntry>
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(testIds)) {
    if (typeof value === 'string') {
      result[key] = value;
    } else {
      Object.assign(result, expandSingleDynamic(key, value));
    }
  }

  return result;
}

/**
 * Cached expansion — avoids re-expanding the same config on every action call.
 * @internal
 */
const expandedCache = new WeakMap<object, Record<string, string>>();

/** Return the expanded (flat) testIds map, caching the result per config object. */
export function getExpandedTestIds(
  testIds: Record<string, string | DynamicLocatorEntry>
): Record<string, string> {
  let expanded = expandedCache.get(testIds);
  if (!expanded) {
    expanded = expandDynamicLocators(testIds);
    expandedCache.set(testIds, expanded);
  }
  return expanded;
}
