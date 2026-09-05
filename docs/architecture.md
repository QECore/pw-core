# Architecture

`pw-core` is a TypeScript framework layer over Playwright. Its public package
contracts are the `pw-core/page`, `pw-core/component/table`, and
`pw-core/helpers` export paths, plus the `pw-core` executable. The repository
also publishes `create-pw-core`, which initializes a test project from the
`examples` workspace.

## Package layout

| Area | Responsibility |
| --- | --- |
| `src/page` | Typed page configuration, locator resolution, Playwright fixture registration, actions, and assertions. |
| `src/component` | Reusable higher-level Playwright components. |
| `src/helpers.ts` | Browser storage helpers. |
| `src/codegen` | Locator discovery/scoring and registry/spec source generation. |
| `src/cli.ts` | Interactive codegen orchestration and its browser lifecycle. |
| `create-pw-core` | Interactive project initializer and template copier. |
| `examples` | Executable consumer project and the initializer template source. |

## Typed page runtime

1. Consumers define a `PageConfig` with `createPageConfig` or provide a
   compatible config to `createPageRegistry`.
2. Dynamic `testId` and `selector` entries expand once and are cached per
   configuration object. `buildLookupIndex` normalizes the resulting keys and
   detects cross-strategy duplicates.
3. `TypedPage` receives a Playwright `Page` or `Locator`, exposes configured
   locators, and installs the configured locator action methods.
4. Locator resolution selects the configured Playwright strategy, applies
   `hasText`, `nth`, and `raw` consistently, and defaults to the first match.
5. Actions and assertions wrap Playwright calls in `test.step`, using caller
   locations to keep reports attributed to consumer code.

`createPageRegistry` creates page-scoped fixtures and matching worker-scoped
fixtures. It also exposes generated page constructors through `.pages` and
`.classes`, and its custom `.extend` supports both normal Playwright fixture
extensions and page-class overrides.

## Codegen runtime

`pw-core codegen` resolves or creates a registry, launches a visible Chromium
context, enables Playwright's recorder, and injects the floating control panel
and hover tracker. Each recorded action follows this path:

```text
recorder event
  -> action normalization
  -> smart locator candidate collection and scoring
  -> existing registry match or new registry entry
  -> formatted pw-core action call
  -> live recorded spec + registry serialization
```

The CLI serializes actions through one queue so navigation and panel actions
cannot reorder registry/spec writes. `--safe` keeps existing selector mappings;
the default mode can replace less suitable generated mappings. The generated
registry and spec are user-owned source files, so their format is a compatibility
boundary.

## Build and release flow

The root build clears `dist`, compiles the library with `tsc`, then builds
`create-pw-core`. The initializer build copies `examples` into its distributed
template directory and updates the template's `pw-core` version. Therefore,
changes to examples can affect the initializer's generated output.

The root test command runs the Playwright suite from the `examples` workspace.
Before changing public types, locator behavior, fixture lifecycles, codegen
serialization, or templates, run both `npx tsc --noEmit` and `npm test`.

## Compatibility boundaries

- Keep package export paths, CLI options, configuration aliases (`testId` /
  `testIds` and `selector` / `selectors`), and generated registry/spec syntax
  stable.
- Preserve Playwright step names, masking semantics, caller-location behavior,
  locator-first-match behavior, and worker-fixture aliases.
- Treat registry parsing and serialization as source-to-source transformations:
  formatting changes may be observable to codegen users.
- Keep `examples` usable as both integration coverage and the initializer
  template source.
