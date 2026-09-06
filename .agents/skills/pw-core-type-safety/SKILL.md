---
name: pw-core-type-safety
description: Type-safety guidelines, Playwright generic boundaries, and casting rules for PW-Core.
---

# PW-Core Type Safety

## Core Principles

1. **Strong Public Types**:
   - Consumers must always receive exact type inference for locators, actions, fixtures, and chained methods.
   - `createPageConfig` and `createPageRegistry` must maintain compile-time type validation for duplicate keys, missing dynamic arrays, and invalid actions.

2. **Closed Strategy Domains**:
   - Never use loose unions like `SelectorStrategyType | string`. Keep `SelectorStrategyType` closed:
     `StrategyType | 'role' | 'ariaLabel' | 'selector' | 'id' | 'class' | 'css' | 'xpath' | 'dataAttribute'`.

3. **Localized Unavoidable Boundaries**:
   - **Playwright Fixtures**: Playwright's `TestType.extend(...)` returns a dynamic fixture runner. Adapt it in `src/page/registry.ts` with a narrow internal cast, without exposing `any` to the public `PageRegistryTest<T, P, W>` interface.
   - **Proxy Traps**: `TypedPage` dynamic method dispatch uses `unknown[]` for proxy traps and resolves against typed Playwright locator methods in `resolvePlaywrightLocator`.
   - **DOM-to-Generic Mappings**: `Table.getRows()` dynamically parses HTML headers and casts to generic `T[]` at the runtime boundary.

4. **Type-Level Verification**:
   - Maintain compile-time tests in `tests/types/page-config.test-d.ts`.
   - Validate both positive assertions (`AssertEqual<Actual, Expected>`) and negative assertions (`@ts-expect-error`).
