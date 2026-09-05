---
name: pw-core-testing
description: Testing layers, test execution commands, and regression test authoring rules for PW-Core.
---

# PW-Core Testing Strategy

## Test Layers

1. **Unit Tests (`tests/unit/`)**:
   - Fast, zero-dependency Node.js tests run via `node --test tests/unit/*.test.js`.
   - Covers: action formatters, dynamic expansion, key utilities, registry matcher, registry store (parsing/writing/bounds), candidate scorers, selector parsers, floating panel payloads, and table components.

2. **Type Tests (`tests/types/`)**:
   - Compile-time type assertion tests in `tests/types/page-config.test-d.ts`.
   - Executed via `tsc --noEmit -p tests/types/tsconfig.json` (or `npm run test:types`).
   - Validates positive inference (`AssertEqual`) and negative error boundaries (`@ts-expect-error`).

3. **Codegen Verification (`scripts/verify-codegen.js`)**:
   - Verifies end-to-end registry parsing, dynamic key collapsing, and spec file emission.

4. **Integration & E2E Tests (`examples/` - `pw-core-demo`)**:
   - Real multi-worker Playwright tests covering serial suites, parallel suites, shared worker pages, and custom page classes.

## Execution Commands

```bash
# Run full verification suite:
npm run test:unit
npm run test:types
npm run test:codegen
npm test --workspace=pw-core-demo
npm run build
```
