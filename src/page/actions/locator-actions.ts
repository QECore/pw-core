import { Locator, test } from '@playwright/test';
import { AllowedMethodKeys, getOptionsArgumentIndex, zeroArgMethodsList, oneArgMethodsList } from '../config';
import { formatStepDescription } from '../utils/formatter';

export function executeAction(
  prop: AllowedMethodKeys,
  resolveLocatorFn: (target: any, options?: { nth?: number; raw?: boolean }) => Locator,
  timeout: number | undefined,
  args: any[]
): Promise<any> {
  const [locatorKey, ...methodArgs] = args;

  let optNth: number | undefined = undefined;
  const optionsIndex = getOptionsArgumentIndex(prop);
  if (optionsIndex !== -1 && methodArgs.length > optionsIndex) {
    const opts = methodArgs[optionsIndex];
    if (opts && typeof opts === 'object' && 'nth' in opts) {
      optNth = opts.nth;
    }
  }

  const isCount = prop === 'count';
  const locator = resolveLocatorFn(locatorKey, { nth: optNth, raw: isCount });
  const method = (locator as any)[prop];
  if (typeof method !== 'function') {
    throw new Error(`Property '${prop}' does not exist on Locator.`);
  }

  if (prop === 'dragTo' && methodArgs.length > 0) {
    methodArgs[0] = resolveLocatorFn(methodArgs[0]);
  }

  if (timeout !== undefined) {
    if (optionsIndex !== -1) {
      while (methodArgs.length < optionsIndex) {
        methodArgs.push(undefined);
      }
      const existingOptions = methodArgs[optionsIndex] || {};
      methodArgs[optionsIndex] = { timeout, ...existingOptions };
    }
  }

  const stepName = formatStepDescription(prop, locatorKey, methodArgs);

  if (prop === 'fill' && methodArgs.length > 1) {
    const opts = methodArgs[1];
    if (opts && typeof opts === 'object' && 'mask' in opts) {
      const { mask, ...playwrightOpts } = opts;
      methodArgs[1] = playwrightOpts;
    }
  }

  return test.step(stepName, () => {
    return method.apply(locator, methodArgs);
  });
}

export function defineActionMethods(
  instance: any,
  resolveLocatorFn: (target: any, options?: { nth?: number; raw?: boolean }) => Locator,
  timeout: number | undefined
): void {
  const locatorMethods = [...zeroArgMethodsList, ...oneArgMethodsList];
  for (const prop of locatorMethods) {
    Object.defineProperty(instance, prop, {
      value: (...args: any[]) => {
        return executeAction(
          prop as AllowedMethodKeys,
          resolveLocatorFn,
          timeout,
          args
        );
      },
      writable: true,
      configurable: true,
      enumerable: false
    });
  }
}
