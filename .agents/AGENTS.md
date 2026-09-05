# PW-Core Architecture & Engineering Governance

## 1. Repository Architecture

- `src/page/`: Strongly-typed page objects, locator strategy resolver, action wrappers, fluent assertions, and Playwright fixture registry.
- `src/codegen/`: Codegen recorder pipeline (DOM scanner, smart-locator candidate scorer, selector parser, action processor, floating panel manager, hover tracker, and registry store).
- `src/component/`: Component object abstractions (e.g., `Table`, `TableRows`).
- `src/constants/`: Shared constants across the framework.
- `tests/`:
  - `tests/unit/`: Fast node-based unit test suite (`node --test tests/unit/*.test.js`).
  - `tests/types/`: Compile-time TypeScript type verification (`tsc --noEmit -p tests/types/tsconfig.json`).
- `examples/` (`pw-core-demo`): Multi-worker integration and end-to-end demo test suite (`playwright test`).

---

## 2. Core Engineering & Refactoring Rules

1. **Preserve Behavior & Public API**: Never break existing types, page configuration syntax, locator APIs, CLI flags, or generated code.
2. **Reuse Existing Implementations**: Before creating any new helper, type, constant, or parser, search the repository first. Exactly ONE authoritative implementation per domain concept.
3. **Smallest Correct Abstraction**: Do not introduce generic layers (`services/`, `managers/`, `factories/`, `repositories/`) or wrapper classes around single operations. A compact 5-10 line helper is preferred over extensive indirection.
4. **Strong Type Safety with Localized Boundaries**:
   - Keep public consumer APIs (`TypedPage`, `PageConfig`, `createPageRegistry`, `createPageConfig`) strictly typed with full inference.
   - Confine necessary dynamic casts (Playwright `TestType.extend(...)`, Proxy traps, DOM-to-generic mappings) strictly to localized internal adapter boundaries.
   - Do not introduce unjustified `any` or open-ended `| string` into closed strategy domains (`SelectorStrategyType`).
5. **Browser/Client Restrictions**:
   - Zero `eval` or dynamic `new Function` in browser-injected code.
   - Zero global `window` function lookups for Node-to-browser execution.
   - Always use Playwright-native function serialization: `page.evaluate(fn, payload)` or `context.addInitScript(fn)`.
6. **Error Handling Semantics**:
   - Missing configuration files return default fallback objects (`{}`).
   - Malformed/invalid existing files throw explicit contextual errors.
   - Write failures must propagate (`throw e`).
   - Non-fatal features (e.g. floating-panel injection on transition frames) fail gracefully without halting test execution.
7. **Module Boundary Direction**:
   - `src/page/` (runtime) must never depend on `src/codegen/`.
   - Pure key utilities for codegen reside in `src/codegen/key-utils.ts`; runtime fixture alias helpers in `src/page/registry.ts` remain isolated and local.

---

## 3. Verification Suite

All modifications MUST pass the complete verification suite:

```bash
npm run test:unit                     # Unit tests (node --test)
npm run test:types                    # Type assertions (tsc --noEmit -p tests/types/tsconfig.json)
npm run test:codegen                  # Codegen registry verification
npm test --workspace=pw-core-demo     # End-to-end multi-worker Playwright tests
npm run build                         # Full TypeScript compilation & template packaging
```
