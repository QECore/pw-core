---
name: pw-core-codegen
description: Codegen recording pipeline, smart locator generation, and registry synchronization rules.
---

# PW-Core Codegen Pipeline

## Architecture & Data Flow

```
DOM Scanner & Scorer
       ↓
Selector Parser (getSelectorValue)
       ↓
Key Builder & Utils (toRegistryKey, toWorkerKey, toUnprefixedPageKey)
       ↓
Action Processor (processRecordedAction, isOwnPanelSelector)
       ↓
Registry Store (parseRegistry, writeRegistry, collapsePageDict)
       ↓
Test Spec Generator (formatActionCall, updateSpecFile)
```

## Key Invariants

1. **Action Processing Ownership**:
   - `src/codegen/action-processor.ts` owns action normalization, deduplication, and panel filtering. `src/cli.ts` merely orchestrates the recorder event sink.

2. **Key Utilities Single Source of Truth**:
   - `src/codegen/key-utils.ts` owns key sanitization, camelCase conversion, leading-digit stripping, and worker prefix/un-prefix operations for codegen. Local runtime fixture aliases in `src/page/registry.ts` are kept independent to ensure `page/` never imports from `codegen/`.

3. **Browser Script Execution**:
   - Floating panel and hover tracker scripts must be serialized via Playwright native methods:
     `page.evaluate(clientInjectFloatingPanel, payload)`
     `context.addInitScript(clientHoverTracker)`
   - Never inject functions via `window` globals or `new Function()`.

4. **Registry Store Error Semantics**:
   - `parseRegistry` returns `{}` if the file does not exist. If the file exists but has syntax errors or lacks `createPageRegistry`, it throws an explicit error.
   - `writeRegistry` rethrows filesystem errors (`throw e`) so callers detect write failures.
   - `findRegistryCallBounds` tracks string quotes, template literals, and comments to avoid premature parenthesis termination.
