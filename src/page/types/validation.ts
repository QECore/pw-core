import type { DynamicLocatorEntry } from '../locators/dynamic-locator-resolver.js'

/**
 * Extracts placeholder names from a `{name}` pattern string.
 */
export type ExtractPlaceholders<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | ExtractPlaceholders<Rest>
  : never

/**
 * Checks recursively if a pattern string contains duplicate placeholders.
 */
export type HasDuplicatePlaceholders<
  S extends string,
  Seen extends string = never
> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name extends Seen
    ? true
    : HasDuplicatePlaceholders<Rest, Seen | Name>
  : false

/**
 * Returns the subset of `Placeholders` whose names are NOT found as
 * substrings of `TestId`. Evaluates to `never` when all are present.
 */
export type MissingInTestId<TestId extends string, Placeholders extends string> = Placeholders extends any
  ? TestId extends `${string}${Placeholders}${string}`
    ? never
    : Placeholders
  : never

/**
 * Validates a dynamic entry by mapping each of its properties to their expected types.
 *
 * By checking properties individually, TypeScript reports the error exactly on the offending line
 * (e.g. on the wrong value or unknown key) instead of marking the entire object as invalid.
 */
export type ValidateDynamicEntryProperties<Pattern extends string, Entry, TargetKey extends 'testId' | 'selector'> = {
  [Key in keyof Entry | ExtractPlaceholders<Pattern> | TargetKey]: Key extends TargetKey
    ? Entry extends Record<TargetKey, infer TPat>
      ? TPat extends string
        ? [MissingInTestId<TPat, ExtractPlaceholders<Pattern>>] extends [never]
          ? [Exclude<ExtractPlaceholders<TPat>, ExtractPlaceholders<Pattern>>] extends [never]
            ? string
            : {
                [
                  P in `Error: ${TargetKey} contains unknown placeholder(s): ${Exclude<ExtractPlaceholders<TPat>, ExtractPlaceholders<Pattern>> & string}`
                ]: never
              }
          : {
              [
                P in `Error: ${TargetKey} must contain all placeholder names: missing ${MissingInTestId<TPat, ExtractPlaceholders<Pattern>> & string}`
              ]: never
            }
        : { [P in `Error: ${TargetKey} must be a string`]: never }
      : {
          [P in `Error: Dynamic entry must include a ${TargetKey} property`]: never
        }
    : Key extends ExtractPlaceholders<Pattern>
      ? Key extends keyof Entry
        ? Entry[Key] extends readonly string[]
          ? readonly string[]
          : {
              [P in `Error: Placeholder key must be an array: ${Key & string}`]: never
            }
        : { [P in `Error: Missing placeholder key: ${Key & string}`]: never }
      : {
          [P in `Error: Only placeholder keys and '${TargetKey}' are allowed`]: never
        }
}

/**
 * Replaces every `{Name}` placeholder in `Pattern` with `Capitalize<Value>`
 * where `Value` is drawn from the corresponding array in `Entry`.
 * Template-literal unions distribute automatically, producing the full cartesian product.
 */
export type ReplacePattern<
  Pattern extends string,
  Entry
> = Pattern extends `${infer Before}{${infer Name}}${infer After}`
  ? Name extends keyof Entry
    ? Entry[Name] extends readonly string[]
      ? `${Before}${Capitalize<Entry[Name][number]>}${ReplacePattern<After, Entry> & string}`
      : never
    : never
  : Pattern

/**
 * Expands a dynamic key pattern into the union of all concrete (camelCased) keys.
 */
export type ExpandDynamicKey<Pattern extends string, Entry> = Uncapitalize<ReplacePattern<Pattern, Entry>>

/**
 * Resolves every key in a testIds record:
 * - string values → the key itself (static locator)
 * - object values → the expanded dynamic key union
 */
export type ResolvedTestIdKeys<I> = {
  [K in keyof I & string]: I[K] extends string ? K : ExpandDynamicKey<K, I[K]>
}[keyof I & string]

export type AllExpandedTestIdKeys<I> = {
  [P in keyof I & string]: I[P] extends string ? P : ExpandDynamicKey<P, I[P]>
}[keyof I & string]

export type AllOtherExpandedTestIdKeys<I, K extends keyof I> = {
  [P in Exclude<keyof I, K> & string]: I[P] extends string ? P : ExpandDynamicKey<P, I[P]>
}[Exclude<keyof I, K> & string]

export type ValidateTestIds<I, TargetKey extends 'testId' | 'selector', S> = {
  [K in keyof I & string]: I[K] extends string
    ? K extends AllOtherExpandedTestIdKeys<I, K> | AllExpandedTestIdKeys<S>
      ? {
          [P in `Error: Duplicate key "${K}" is defined in multiple entries`]: never
        }
      : string
    : ExpandDynamicKey<K, I[K]> & (AllOtherExpandedTestIdKeys<I, K> | AllExpandedTestIdKeys<S>) extends never
      ? K extends `${string}{${string}}${string}`
        ? HasDuplicatePlaceholders<K> extends true
          ? { [P in 'Error: Pattern contains duplicate placeholders']: never }
          : ValidateDynamicEntryProperties<K, I[K], TargetKey>
        : I[K]
      : {
          [
            P in `Error: Dynamic locator "${K}" expands to duplicate key(s): ${ExpandDynamicKey<K, I[K]> & (AllOtherExpandedTestIdKeys<I, K> | AllExpandedTestIdKeys<S>) & string}`
          ]: never
        }
}
