import { Page, Locator, test } from '@playwright/test';
import { ChainedKeys, PageKeys, zeroArgMethodsList, oneArgMethodsList } from '../config';
import { formatStepDescription } from '../utils/formatter';

export function defineLocators<T extends { testIds?: Record<string, string>; selectors?: Record<string, string> }>(
  instance: any,
  context: Page | Locator,
  config: T
): void {
  if (config.testIds) {
    for (const key of Object.keys(config.testIds)) {
      Object.defineProperty(instance, key, {
        get: () => {
          return context.getByTestId(config.testIds![key]);
        },
        enumerable: true,
        configurable: true,
      });
    }
  }
  if (config.selectors) {
    for (const key of Object.keys(config.selectors)) {
      Object.defineProperty(instance, key, {
        get: () => {
          return context.locator(config.selectors![key]);
        },
        enumerable: true,
        configurable: true,
      });
    }
  }
}

export function resolveLocator<T extends { testIds?: Record<string, string>; selectors?: Record<string, string> }>(
  context: Page | Locator,
  config: T,
  target: PageKeys<T> | ChainedKeys<T> | Locator,
  options?: { nth?: number; raw?: boolean }
): Locator {
  if (typeof target !== 'string') return target as Locator;
  const targetStr = target as string;
  const parts = targetStr.split('.');

  const resolveSingle = (key: string, ctx: Page | Locator): Locator => {
    if (config.testIds && key in config.testIds) {
      return ctx.getByTestId(config.testIds[key]);
    }
    if (config.selectors && key in config.selectors) {
      return ctx.locator(config.selectors[key]);
    }
    throw new Error(`Locator key '${key}' is not defined in testIds or selectors.`);
  };

  let loc = resolveSingle(parts[0], context);
  for (let i = 1; i < parts.length; i++) {
    loc = resolveSingle(parts[i], loc);
  }

  if (options?.raw) {
    return loc;
  }
  if (options?.nth !== undefined) {
    return loc.nth(options.nth);
  }
  return loc.first();
}

/**
 * Resolve a config key to a proxied Locator with step-wrapped Playwright methods.
 */
export function locator<T extends { testIds?: Record<string, string>; selectors?: Record<string, string> }>(
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
          return test.step(stepName, () => val.apply(targetLoc, args));
        };
      }
      return val;
    }
  });
}
