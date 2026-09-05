---
name: pw-core-architecture
description: Architectural boundaries, domain layout, and file ownership rules for PW-Core.
---

# PW-Core Architecture

## Layer Responsibilities

### 1. `src/page/`
- **`config.ts`**: Page configuration validator, strategy types, dynamic locator parsing types (`PageKeys`, `ValidatePageConfig`, `createPageConfig`).
- **`typed-page.ts`**: `TypedPage<T>` proxy implementation wrapping Playwright `Page` and `Locator` with auto-step logging, caller location tracking, and secret masking.
- **`registry.ts`**: Playwright fixture registry engine (`createPageRegistry`). Generates page-scoped (`dashboard`) and worker-scoped (`workerDashboard`) fixtures.
- **`locators/`**: `resolver.ts` defines locator strategy mappings and dynamic method proxy traps; `dynamic-locator-resolver.ts` expands dynamic test IDs.
- **`assertions/`**: `verify-chain.ts` and `verify-helpers.ts` implement fluent chain assertions (`expect(page).to...`).
- **`utils/`**: `formatter.ts` formats test step descriptions and secret star-masking; `caller-location.ts` extracts call site file locations for Playwright step reporting.

### 2. `src/codegen/`
- **`generator/`**: Smart locator candidate generation, scoring, and test spec generation.
- **`floating-panel/`**: In-browser test recording HUD (`FloatingPanelManager` and browser-safe `clientInjectFloatingPanel`).
- **`hover-tracker/`**: Automatic hover action capture via `addInitScript`.
- **`action-processor.ts`**: Single source of truth for recorded action filtering and normalization.
- **`key-utils.ts`**: Single source of truth for CODEGEN key sanitization, camelCase conversion, and codegen-side worker key generation. (Runtime fixture alias transformations in `src/page/registry.ts` are intentionally owned by the page/runtime layer and remain independent of `src/codegen/`).
- **`registry-store.ts`**: File parser, AST bounds scanner, dynamic key collapse, and registry file serializer.
- **`selector-parser.ts`**: Playwright selector regex parser mapping selectors to `SelectorStrategyType`.

### 3. `src/component/`
- **`table.ts`**: `Table` and `TableRows` component abstractions with typed cell/row queries and `TABLE_DATA_ROW_SELECTOR` constant reuse.

### 4. `src/cli.ts`
- CLI orchestration for `npx pw-core codegen`. Manages recorder context, event sinks, floating panel coordination, and test spec emission.
