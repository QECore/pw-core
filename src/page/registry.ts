import test, { Page, TestType } from '@playwright/test';
import { PageConfig } from './config';
import { TypedPage } from './typed-page';

export type PageRegistry = Record<string, PageConfig>;

export interface PageConstructor<C extends PageConfig<any>> {
  new (page: Page): TypedPage<C>;
}

export interface PageRegistryObject<T extends Record<string, PageConfig<any>>> {
  classes: {
    [K in keyof T]: PageConstructor<T[K]>;
  };
  extend<
    O extends Partial<{
      [K in keyof T]: new (page: Page, ...args: any[]) => any;
    }>,
    B extends TestType<any, any> = typeof test
  >(
    overrides: O,
    base?: B
  ): B extends TestType<infer P, infer W>
    ? TestType<
        P & {
          [K in keyof T]: K extends keyof O
            ? O[K] extends new (...args: any[]) => infer R
              ? R
              : TypedPage<T[K]>
            : TypedPage<T[K]>;
        },
        W
      >
    : never;
}

export function createPageRegistry<
  T extends {
    [K in keyof T]: PageConfig<T[K]>;
  } & Record<string, PageConfig<any>>
>(registry: T): PageRegistryObject<T> {
  const classes: any = {};
  for (const key of Object.keys(registry)) {
    const config = registry[key];
    classes[key] = config.Class || (class extends TypedPage<any> {
      constructor(page: Page) {
        super(page, config);
      }
    });
  }

  return {
    classes,
    extend(overrides: any, base: any = test) {
      const fixtures: any = {};
      for (const key of Object.keys(registry)) {
        fixtures[key] = async ({ page }: { page: Page }, use: (r: any) => Promise<void>) => {
          const config = registry[key];
          const PageClass = overrides[key] || classes[key];
          const instance = new PageClass(page);

          await use(instance);
        };
      }
      return base.extend(fixtures);
    }
  };
}
