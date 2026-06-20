# pw-core

A developer-first framework layer built on top of Playwright for creating readable, scalable, maintainable, and AI-friendly automation frameworks.

`pw-core` standardizes how pages, locators, components, assertions, and fixtures are defined so teams can focus on writing tests instead of maintaining framework code.

---

## Documentation

- **Online Documentation**: [qecore.github.io/pw-core](https://qecore.github.io/pw-core)
- **Release Guide**: [releases/v1.0.0.md](./releases/v1.0.0.md)

---

## Installation & Setup

### Quick Start (Recommended)
To initialize a brand new test suite pre-configured with `pw-core`, run:

```bash
npm init pw-core
```

This will automatically:
- Set up a clean folder structure with template examples in `src/pages` and `src/tests`
- Create `playwright.config.ts` and `tsconfig.json` configurations
- Install `pw-core`, `@playwright/test`, and `typescript` dependencies
- Download required Playwright browser binaries

### Manual Installation
If you want to add `pw-core` to an existing Playwright project, install it manually:

```bash
npm install pw-core
```

---

## Core Philosophy

| Goal                   | Value                                                   |
| :--------------------- | :------------------------------------------------------ |
| Single Source of Truth | URLs, selectors, and testIds live in one place          |
| Readability            | Tests should read like business workflows               |
| Scalability            | Adding pages should not increase framework complexity   |
| Reusability            | Components should be defined once and reused everywhere |
| Type Safety            | Catch mistakes during development instead of runtime    |
| AI-Friendly            | Standardized patterns reduce context and token usage    |
| Maintainability        | Update locators once, not across hundreds of tests      |

---

## Available Custom Methods

The following custom methods are available on `TypedPage` objects:

### Navigation & Lifecycle
- `goto(options?)`: Navigate to the configured page URL.
- `reload(options?)`: Reload the current page.
- `waitForLoadState(state?, options?)`: Wait for the page to reach the specified load state (e.g. `'load' | 'domcontentloaded' | 'networkidle'`).
- `waitForURL(pattern?, options?)`: Wait for the page navigation to match the configured page URL or a custom pattern.

### Assertions
- `verify(key, options?)`: Assertions chain wrapper (e.g. `await page.verify('submit').toBeVisible()`). Supports `nth` and `hasText` filtering.
- `verifyURL(url?, options?)`: Assert the current URL matches the page configuration URL or a custom string/RegExp pattern.
- `verifyTitle(title, options?)`: Assert the page title matches the expected title string or RegExp pattern.
- `verifyHidden(key, options?)`: Shortcut assertion to verify a locator is hidden. Supports `nth` and `hasText` options.
- `verifyEnabled(key, options?)`: Shortcut assertion to verify a locator is enabled. Supports `nth` and `hasText` options.
- `verifyDisabled(key, options?)`: Shortcut assertion to verify a locator is disabled. Supports `nth` and `hasText` options.

### Locators
- `expect(key)`: Returns raw Playwright expectation: `expect(locator)`.
- `resolveLocator(key, options?)`: Returns the raw Playwright Locator resolved from the page config. Options support `{ nth, hasText, raw }`.
- `locator(key, options?)`: Returns a proxied, step-wrapped Playwright Locator. Options support `{ nth, hasText }`.

---

## License

MIT
