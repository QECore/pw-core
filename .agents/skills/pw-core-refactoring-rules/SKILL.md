---
name: pw-core-refactoring-rules
description: Refactoring constraints, reuse guidelines, and anti-patterns to avoid in PW-Core.
---

# PW-Core Refactoring Rules

## Non-Negotiable Rules

1. **Search Before Creating**:
   - Before writing any helper, type, or constant, search the repository first.
   - Reuse `src/codegen/key-utils.ts` for key transformations.
   - Reuse `ACTION_METHODS` in `src/page/locators/resolver.ts` for action method lookups.
   - Reuse `TABLE_DATA_ROW_SELECTOR` in `src/component/table.ts` for table row selection.
   - Reuse `formatStepDescription` in `src/page/utils/formatter.ts` for secret masking and step names.

2. **One Source of Truth**:
   - Exactly one authoritative definition per domain concept.
   - Never create duplicate strategy maps, selector normalizers, or action processors.

3. **No Unnecessary Abstractions**:
   - Do not introduce generic `services/`, `managers/`, `factories/`, or `handlers/` folders.
   - A 5-line local helper is better than multi-file abstractions.

4. **Self-Review Loop**:
   - After any change, verify that behavior, public API, and generated code remain 100% intact.
   - Run the complete verification suite before completing tasks.
