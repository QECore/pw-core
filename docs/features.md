# Custom Features & Enhancements in `pw-core`

`pw-core` extends standard Playwright capabilities by adding strongly-typed locator references, automated test-step wrapping, unified assertions, complex component parsing, and reliable storage helpers.

Below is a complete reference of the custom features, APIs, and methods introduced in `pw-core`.

---

## 1. Feature Comparison Matrix

The table below outlines the core custom APIs added by `pw-core` compared to their native Playwright equivalents.

| Feature Category | pw-core API | Standard Playwright equivalent | Why it makes your workflow easier |
| :--- | :--- | :--- | :--- |
| **Typed Page Elements** | `page.key` or `page.click('key')` | `page.locator('[data-testid="key"]').click()` | **No hardcoded selectors in tests**. Complete auto-complete/intellisense support derived from `testIds` & `selectors` configurations. |
| **Element Context Filtering** | `page.click('key', { nth: 1, hasText: 'text' })` | `page.locator('[data-testid="key"]').filter({ hasText: 'text' }).nth(1).click()` | **Shorthand filtering**. Simplifies targeting specific elements in a list directly inside action arguments. |
| **Chained Locators** | `page.click('parentKey.childKey')` | `page.locator('[data-testid="parentKey"]').locator('[data-testid="childKey"]').click()` | **Nested element targeting**. Dot notation (`.`) dynamically chains locators together, executing queries recursively. |
| **Sensitive Data Masking** | `page.fill('key', 'secret')` | Custom step wrappers or plaintext logs. | **Credential safety**. Automatically replaces fill values with `***` in HTML report step names unless `{ mask: false }` is provided. |
| **Unified Assertions** | `await page.verify('key').toHaveText('value')` | `await expect(page.locator('[data-testid="key"]')).toHaveText('value')` | **Readable chainable assertions** with standard Playwright `expect` matching, built-in test-step reporting, and support for `.soft` assertions. |
| **Negated Assertions** | `await page.verify('key').not.toBeVisible()` | `await expect(locator).not.toBeVisible()` | **Negated matchers support** inside the custom `verify` builder. |
| **Custom Step Reporting** | `await page.verify('key').toBeVisible({ message: 'custom' })` | Custom `test.step` wrappers. | **Descriptive test reports**. Lets you override the auto-generated assertion step title with a customized description. |
| **Quick Assertions** | `await page.verifyHidden('key')`<br>`await page.verifyEnabled('key')`<br>`await page.verifyDisabled('key')` | `await expect(page.locator('[data-testid="key"]')).toBeHidden()` | **Shortcut assertions** reducing boilerplate code for common element states. |
| **Page-level Actions** | `await page.goto()` | `await page.goto(config.url)` | **Auto-navigation & matching**. Automatically references the configured page URL and wraps execution in a reporting step. |
| **URL & Title Verification** | `await page.verifyURL(pattern?)`<br>`await page.verifyTitle(title)` | `await expect(page).toHaveURL(...)`<br>`await expect(page).toHaveTitle(...)` | **Automated page assertions** utilizing configured values with custom logging. |
| **Extensible Page Registry** | `test.extend({ login: MockLogin })` | Custom fixtures and manually setting up worker scopes. | **Environment overrides**. Overrides page classes dynamically while keeping worker fixtures synchronized. |
| **Complex Table Parsing** | `const table = new Table(locator)` | Manual `evaluateAll()` loops to find headers/cells. | **Structured data extraction** from HTML tables. Instantly converts rows to arrays of strongly-typed JavaScript objects. |
| **Storage Utilities** | `getLocalStorage()` / `setLocalStorage()` | `await page.evaluate(...)` | **Type-safe storage interactions** without raw script injection blocks. |
| **Session Seeding** | `seedSessionStorage(page, data)` | Complex authentication state hooks. | **Pre-seeding session state** before page load, but only executing when authenticated cookies are present. |

---

## 2. API Reference & Code Examples

### 2.1. Actions & Locators Proxy

All standard `Locator` action methods (like `click`, `fill`, `hover`, etc.) are dynamically proxied onto `TypedPage` objects. The first argument resolves to either a configured locator key (from `testIds` or `selectors`), a chained dot-notation path, or a raw Playwright `Locator`.

#### Example:
```typescript
import { TypedPage, createPageConfig } from 'pw-core/page';

export const config = createPageConfig({
  url: 'https://example.com/dashboard',
  testIds: {
    dialog: 'confirmation-dialog',
    confirmButton: 'confirm-btn',
    submitButton: 'submit-btn',
    menuItem: 'menu-item-link',
  },
  selectors: {
    errorMessage: '.alert.alert-danger',
  }
});


export class DashboardPage extends TypedPage<typeof config> {
  async submit() {
    // 1. Simple target by testId key
    await this.click('submitButton');

    // 2. Target selector key with filtering options (nth and hasText)
    await this.click('menuItem', { hasText: 'Settings', nth: 0 });

    // 3. Chained locator using dot notation (resolves to dialog -> confirmButton)
    await this.click('dialog.confirmButton');

    // 4. Sensitive Data Masking: value is hidden in report steps unless { mask: false } is set
    await this.fill('submitButton', 'secretPassword'); // Step logs: Fill "submitButton" with "**************"
  }
}
```

---

### 2.2. Page-level Navigation & Verification

`TypedPage` implements custom page-level methods that use the configuration details.

#### Example:
```typescript
// Navigates to the config URL ('https://example.com/dashboard')
await dashboardPage.goto();

// Reloads the page
await dashboardPage.reload();

// Verifies the current URL matches the config URL
await dashboardPage.verifyURL();

// Verifies page title
await dashboardPage.verifyTitle('Welcome to your Dashboard');
```

---

### 2.3. Assertions

#### Chainable Assertions (`verify`)
The `verify` getter provides a fluent assertion api. It automatically creates standard Playwright `expect` calls under the hood, wrapped in descriptive test steps.

```typescript
// 1. Assert an element has text
await page.verify('errorMessage').toHaveText('Invalid credentials');

// 2. Soft assertions (fails the test but does not halt execution immediately)
await page.verify.soft('submitButton').toBeVisible();

// 3. Negated assertions using .not
await page.verify('errorMessage').not.toBeVisible();

// 4. Custom Step Message overrides (defines the title shown in the Playwright report step)
await page.verify('submitButton').toBeVisible({ message: 'Ensure login submit button is loaded' });
```

#### Shortcut State Assertions
```typescript
await page.verifyHidden('errorMessage');
await page.verifyEnabled('submitButton');
await page.verifyDisabled('submitButton');
```

---

### 2.4. Table Helper Component

The `Table` component parses HTML tables dynamically, aligning column headers (in lowercase) with row values.

#### Example:
```typescript
import { Table } from 'pw-core/component/table';

// Define the shape of your table row
interface UserRow {
  name: string;
  role: string;
  status: string;
}

// Instantiate the table using a locator
const userTable = new Table<UserRow>(page.locator('.user-table'));

// Fetch all rows mapped as typed objects
const rows = await userTable.get();

// Query row values safely
const firstRowName = rows.get('name'); // Returns value of the first row
const adminUser = rows.get('role', 'admin'); // Returns first row object where role is 'admin'
const activeUsers = rows.getAll('status', 'active'); // Returns array of row objects where status is 'active'
```

---

### 2.5. Browser Storage Helpers

Clean helpers to manage localStorage and sessionStorage values in your tests.

#### Example:
```typescript
import { getLocalStorage, setLocalStorage, seedSessionStorage } from 'pw-core/helpers';

// Set and get localStorage
await setLocalStorage(page, 'theme', 'dark');
const theme = await getLocalStorage(page, 'theme'); // 'dark'

// Pre-seed sessionStorage (useful in login/auth hook configurations)
await seedSessionStorage(page, {
  userToken: 'xyz123',
  sessionState: 'active',
});
```

---

### 2.6. Page Registry & Extensibility

The page registry fixture creator does not just register pages, it also allows extending/overriding those pages cleanly dynamically.

#### Example:
```typescript
import { createPageRegistry } from 'pw-core/page';
import { LoginPage, config } from './login.page.js';

// 1. Initialize the page registry
const baseTest = createPageRegistry({
  login: { ...config, Class: LoginPage },
});

// 2. Access registry classes & page classes
const pageClasses = baseTest.pages; // { login: LoginPage }

// 3. Extend / Override page objects dynamically (e.g. mock or environment overrides)
class MockLoginPage extends LoginPage {
  async login(user: string, pass: string) {
    // Custom mock login logic
    await this.fill('username', user);
    await this.click('submit');
  }
}

// 4. Extend the test runner with overrides
export const test = baseTest.extend({
  login: MockLoginPage,
});
```

