import { Locator, test } from '@playwright/test';
import { AllowedMethodKeys, getOptionsArgumentIndex, zeroArgMethodsList, oneArgMethodsList } from '../config';
import { formatStepDescription, formatTarget } from '../utils/formatter';
import { getCallerLocation } from '../utils/caller-location';

export function executeAction(
  prop: AllowedMethodKeys,
  resolveLocatorFn: (target: any, options?: { nth?: number; hasText?: string | RegExp; raw?: boolean }) => Locator,
  timeout: number | undefined,
  args: any[]
): Promise<any> {
  const [locatorKey, ...methodArgs] = args;

  let optNth: number | undefined = undefined;
  let optHasText: string | RegExp | undefined = undefined;
  const optionsIndex = getOptionsArgumentIndex(prop);
  if (optionsIndex !== -1 && methodArgs.length > optionsIndex) {
    const opts = methodArgs[optionsIndex];
    if (opts && typeof opts === 'object') {
      if ('nth' in opts) {
        optNth = opts.nth;
      }
      if ('hasText' in opts) {
        optHasText = opts.hasText;
      }
    }
  }

  const isCount = prop === 'count';
  const locator = resolveLocatorFn(locatorKey, { nth: optNth, hasText: optHasText, raw: isCount });
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

  let shouldMask = false;
  if (prop === 'fill' && methodArgs.length > 0) {
    const opts = methodArgs[1];
    if (opts && typeof opts === 'object' && opts.mask !== undefined) {
      shouldMask = opts.mask === true;
    } else {
      const targetStr = formatTarget(locatorKey);
      const targetStrLower = targetStr.toLowerCase();
      shouldMask = targetStrLower.includes('pass') || targetStrLower.includes('pw');
    }
  }

  if (prop === 'fill' && shouldMask) {
    return test.step(stepName, async () => {
      await locator.focus();
      await locator.evaluate((el, val) => {
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
      }, methodArgs[0]);
    }, { box: true, location: getCallerLocation() });
  }

  return test.step(stepName, () => {
    return method.apply(locator, methodArgs);
  }, { box: true, location: getCallerLocation() });
}

export function defineActionMethods(
  instance: any,
  resolveLocatorFn: (target: any, options?: { nth?: number; hasText?: string | RegExp; raw?: boolean }) => Locator,
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
