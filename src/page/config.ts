import { Locator, Page } from '@playwright/test';

export { ProxyLocatorMethods } from './types/proxy-methods';

export const zeroArgMethodsList = [
  'click', 'dblclick', 'hover', 'focus', 'blur', 'check', 'uncheck', 'clear',
  'waitFor', 'isChecked', 'isDisabled',
  'isVisible', 'textContent', 'innerText',
  'allInnerTexts', 'allTextContents', 'count',
  'scrollIntoViewIfNeeded', 'boundingBox'
] as const;

export const oneArgMethodsList = [
  'fill', 'press', 'pressSequentially', 'selectOption', 'setInputFiles',
  'getAttribute', 'dragTo'
] as const;

export type AllowedZeroArgMethods = typeof zeroArgMethodsList[number];
export type AllowedOneArgMethods = typeof oneArgMethodsList[number];
export type AllowedMethodKeys = AllowedZeroArgMethods | AllowedOneArgMethods;

export type PageKeys<T> =
  (T extends { testIds?: infer I } ? keyof I & string : never) |
  (T extends { selectors?: infer S } ? keyof S & string : never);

export type TypedLocators<T> = {
  [K in PageKeys<T>]: Locator;
};

export type ChainedKeys<T> = `${PageKeys<T>}.${PageKeys<T>}`;

export type TargetKey<T> = PageKeys<T> | ChainedKeys<T> | Locator;

export type ValidateTarget<K, T> = K extends Locator ? Locator : K extends (PageKeys<T> | ChainedKeys<T>) ? K : never;

export function getOptionsArgumentIndex(methodName: AllowedMethodKeys): number {
  if ((zeroArgMethodsList as readonly string[]).includes(methodName)) return 0;
  if ((oneArgMethodsList as readonly string[]).includes(methodName)) return 1;
  return -1;
}

export type PageConfig<T = any> = {
  url?: string;
  testIds?: Record<string, string>;
  selectors?: T extends { testIds: infer I; selectors: infer S }
    ? {
        [K in keyof S]: K extends keyof I
          ? `Duplicate key: ${K & string} already exists in testIds`
          : S[K];
      }
    : Record<string, string>;
  Class?: new (page: Page, config?: any) => any;
};

export function createPageConfig<
  T extends PageConfig<T>
>(config: T): T {
  return config;
}
