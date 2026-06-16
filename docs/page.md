# Page objects

## TypedPage

Extend `TypedPage` with a config of `testIds`, `selectors`, and optional `url`.

```ts
import { TypedPage, createPageConfig } from 'pw-core/page';

export const config = createPageConfig({
  url: 'https://example.com/login',
  testIds: { username: 'user-input', submit: 'login-btn' },
  selectors: { error: '.error-message' },
});

export class LoginPage extends TypedPage<typeof config> {
  async login(user: string, pass: string) {
    await this.fill('username', user);
    await this.click('submit');
  }
}
```

## Locator keys

| Style | Example |
|-------|---------|
| Property access | `page.submit` → raw Playwright `Locator` |
| Key-first proxy | `page.click('submit')` → wrapped in a test step |
| Chained keys | `page.click('dialog.confirm')` |
| Filtered locator | `page.locator('row', { hasText: 'Alice', nth: 1 })` |

Proxy methods delegate to Playwright. See [Locator API](https://playwright.dev/docs/api/class-locator) for options.

pw-core adds `nth` and `hasText` on proxy options to target and filter specific matches.

## pw-core-only methods

| Method | Description |
|--------|-------------|
| `goto()` | Navigate to config `url` |
| `verifyURL()` | Assert current URL (defaults to config `url`) |
| `verifyTitle(title)` | Assert page title |
| `reload()` | Reload the page |
| `waitForLoadState(state?)` | Wait for load state |
| `waitForURL(pattern?)` | Wait for navigation (defaults to config `url`) |
| `verify(key, options?)` | Chainable assertions — `.toBeVisible()`, `.toHaveText()`, `.soft` (supports `nth` and `hasText` options) |
| `verifyHidden/Enabled/Disabled(key, options?)` | Shortcut assertions (supports `nth` and `hasText` options) |
| `expect(key)` | Returns Playwright `expect(locator)` |

## Page registry

Register pages as Playwright fixtures. `createPageRegistry` automatically returns the extended Playwright test runner, including standard page-scoped fixtures and worker-scoped fixtures prefixed with `worker`.

```ts
import { createPageRegistry } from 'pw-core/page';
import { LoginPage, config } from './login.page.js';

// Returns the extended test runner directly
export const test = createPageRegistry({
  login: { ...config, Class: LoginPage },
});

// Access the registered page classes (optional)
export const pages = test.pages;
```

```ts
// In your test files, use page-scoped or worker-scoped fixtures:
test('login flow', async ({ login, workerLogin, page, workerPage }) => {
  // Page-scoped test
  await login.goto();
  await login.login('alice', 'secret');

  // Worker-scoped test (shares a single workerPage among other worker fixtures in the worker)
  await workerLogin.goto();
  await workerLogin.login('bob', 'secret');
});
```
