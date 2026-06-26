import { Page, Locator, test } from '@playwright/test';
import { ChainedKeys, PageKeys, zeroArgMethodsList, oneArgMethodsList, DynamicSelectorEntry } from '../config';
import { formatStepDescription, formatTarget } from '../utils/formatter';
import { getExpandedTestIds } from './dynamic-locator-resolver';
import type { DynamicLocatorEntry } from './dynamic-locator-resolver';
import { getCallerLocation } from '../utils/caller-location';

export function defineLocators<T extends { testIds?: Record<string, string | DynamicLocatorEntry>; selectors?: Record<string, string | DynamicSelectorEntry> }>(
  instance: any,
  context: Page | Locator,
  config: T
 ): void {
  if (config.testIds) {
    const expanded = getExpandedTestIds(config.testIds);
    for (const key of Object.keys(expanded)) {
      Object.defineProperty(instance, key, {
        get: () => {
          return context.getByTestId(expanded[key]);
        },
        enumerable: true,
        configurable: true,
      });
    }
  }
  if (config.selectors) {
    const expanded = getExpandedTestIds(config.selectors);
    for (const key of Object.keys(expanded)) {
      Object.defineProperty(instance, key, {
        get: () => {
          return context.locator(expanded[key]);
        },
        enumerable: true,
        configurable: true,
      });
    }
  }
}

export function resolveLocator<T extends { testIds?: Record<string, string | DynamicLocatorEntry>; selectors?: Record<string, string | DynamicSelectorEntry> }>(
  context: Page | Locator,
  config: T,
  target: PageKeys<T> | ChainedKeys<T> | Locator,
  options?: { nth?: number; raw?: boolean; hasText?: string | RegExp }
): Locator {
  if (typeof target !== 'string') return target as Locator;
  const targetStr = target as string;
  const parts = targetStr.split('.');

  const expandedTestIds = config.testIds ? getExpandedTestIds(config.testIds) : undefined;
  const expandedSelectors = config.selectors ? getExpandedTestIds(config.selectors) : undefined;

  const resolveSingle = (key: string, ctx: Page | Locator): Locator => {
    if (expandedTestIds && key in expandedTestIds) {
      return ctx.getByTestId(expandedTestIds[key]);
    }
    if (expandedSelectors && key in expandedSelectors) {
      return ctx.locator(expandedSelectors[key]);
    }
    throw new Error(`Locator key '${key}' is not defined in testIds or selectors.`);
  };

  let loc = resolveSingle(parts[0], context);
  for (let i = 1; i < parts.length; i++) {
    loc = resolveSingle(parts[i], loc);
  }

  let resolved = loc;
  if (options?.hasText !== undefined) {
    resolved = resolved.filter({ hasText: options.hasText });
  }

  if (options?.raw) {
    return resolved;
  }
  if (options?.nth !== undefined) {
    return resolved.nth(options.nth);
  }
  return resolved.first();
}

/**
 * Resolve a config key to a proxied Locator with step-wrapped Playwright methods.
 */
export function locator<T extends { testIds?: Record<string, string | DynamicLocatorEntry>; selectors?: Record<string, string | DynamicSelectorEntry> }>(
  context: Page | Locator,
  config: T,
  target: PageKeys<T> | ChainedKeys<T> | Locator,
  options?: Parameters<Locator['filter']>[0] & { nth?: number }
): Locator {
  const resolved = resolveLocator(context, config, target, { raw: true });
  const filtered = options ? resolved.filter(options) : resolved;
  const loc = (options && typeof options === 'object' && 'nth' in options && options.nth !== undefined) ? filtered.nth(options.nth) : filtered;
  return wrapLocatorWithProxy(loc);
}

export function wrapLocatorWithProxy(loc: Locator): Locator {
  const actionMethods = [...zeroArgMethodsList, ...oneArgMethodsList];
  return new Proxy(loc, {
    get: (targetLoc, propKey, receiver) => {
      const val = Reflect.get(targetLoc, propKey, receiver);
      if (typeof val === 'function' && actionMethods.includes(propKey as any)) {
        return (...args: any[]) => {
          const stepName = formatStepDescription(propKey as string, targetLoc, args);
          if (propKey === 'fill') {
            const options = args[1];
            let shouldMask = false;
            if (options && typeof options === 'object' && options.mask !== undefined) {
              shouldMask = options.mask === true;
            } else {
              const targetStr = formatTarget(targetLoc);
              const targetStrLower = targetStr.toLowerCase();
              shouldMask = targetStrLower.includes('pass') || targetStrLower.includes('pw');
            }
            if (shouldMask) {
              return test.step(stepName, async () => {
                await targetLoc.focus();
                await targetLoc.evaluate((el, val) => {
                  const inputEl = el as HTMLInputElement | HTMLTextAreaElement;
                  const prototype = el.tagName === 'TEXTAREA' 
                    ? window.HTMLTextAreaElement.prototype 
                    : window.HTMLInputElement.prototype;
                  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
                  if (descriptor && descriptor.set) {
                    descriptor.set.call(inputEl, val);
                  } else {
                    inputEl.value = val;
                  }
                  inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                  inputEl.dispatchEvent(new Event('change', { bubbles: true }));
                }, args[0]);
              }, { box: true, location: getCallerLocation() });
            }
          }
          return test.step(stepName, () => val.apply(targetLoc, args), { box: true, location: getCallerLocation() });
        };
      }
      return val;
    }
  });
}
