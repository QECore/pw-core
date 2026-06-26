/**
 * Extracts placeholder names from a `{name}` pattern string.
 */
export type ExtractPlaceholders<S extends string> =
  S extends `${string}{${infer Name}}${infer Rest}`
    ? Name | ExtractPlaceholders<Rest>
    : never;

/**
 * Checks recursively if a pattern string contains duplicate placeholders.
 */
export type HasDuplicatePlaceholders<S extends string, Seen extends string = never> =
  S extends `${string}{${infer Name}}${infer Rest}`
    ? Name extends Seen
      ? true
      : HasDuplicatePlaceholders<Rest, Seen | Name>
    : false;

/**
 * Returns the subset of `Placeholders` whose names are NOT found as
 * substrings of `TestId`. Evaluates to `never` when all are present.
 */
export type MissingInTestId<TestId extends string, Placeholders extends string> =
  Placeholders extends any
    ? TestId extends `${string}${Placeholders}${string}`
      ? never
      : Placeholders
    : never;

/**
 * Validates a dynamic entry by mapping each of its properties to their expected types.
 *
 * By checking properties individually, TypeScript reports the error exactly on the offending line
 * (e.g. on the wrong value or unknown key) instead of marking the entire object as invalid.
 */
export type ValidateDynamicEntryProperties<
  Pattern extends string,
  Entry,
  TargetKey extends 'testId' | 'selector'
> = {
  [Key in (keyof Entry | ExtractPlaceholders<Pattern> | TargetKey)]:
    Key extends TargetKey
      ? Entry extends Record<TargetKey, infer TPat>
        ? TPat extends string
          ? [MissingInTestId<TPat, ExtractPlaceholders<Pattern>>] extends [never]
            ? string
            : `Error: ${TargetKey} must contain all placeholder names`
          : `Error: ${TargetKey} must be a string`
        : `Error: Dynamic entry must include a ${TargetKey} property`
      : Key extends ExtractPlaceholders<Pattern>
        ? Key extends keyof Entry
          ? Entry[Key] extends readonly string[]
            ? readonly string[]
            : `Error: Placeholder key must be an array: ${Key & string}`
          : `Error: Missing placeholder key: ${Key & string}`
        : `Error: Only placeholder keys and '${TargetKey}' are allowed`
};
