# pw-core

A developer-first framework layer built on top of Playwright for creating readable, scalable, maintainable, and AI-friendly automation frameworks.

`pw-core` standardizes how pages, locators, components, assertions, and fixtures are defined so teams can focus on writing tests instead of maintaining framework code.

---

## Installation

```bash
npm install pw-core
```

### Requirements

- Existing Playwright project
- TypeScript recommended
- Compatible with supported Playwright versions defined by peer dependency requirements

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

# Why pw-core?

Most Playwright frameworks start small and manageable.

As projects grow, they often become difficult to maintain:

- Locators duplicated across files
- Massive Page Objects
- Repeated fixture definitions
- Components recreated on every page
- Multiple sources of truth
- Inconsistent coding patterns

The larger the framework becomes, the more expensive these problems become.

`pw-core` solves this by introducing:

- Configuration-driven pages
- Typed Page Objects
- Automatic Page Registry fixtures
- Reusable Components
- Chained Locators
- Built-in Assertions
- Browser Storage Helpers

---

# Traditional Playwright vs pw-core

## Traditional Approach

```ts
class LoginPage {
  constructor(private page: Page) {}

  username = this.page.getByTestId("username-input");
  password = this.page.getByTestId("password-input");
  loginButton = this.page.getByTestId("login-button");
  errorMessage = this.page.getByTestId("login-error");
}
```

Usage:

```ts
await loginPage.username.fill(user);
await loginPage.password.fill(pass);
await loginPage.loginButton.click();

await expect(loginPage.errorMessage).toBeVisible();
```

Problems:

- Locator definitions
- Large Page Objects
- Boilerplate code
- Multiple maintenance points
- Runtime locator mistakes

---

## pw-core Approach

```ts
const config = createPageConfig({
  url: "/login",

  testIds: {
    username: "username-input",
    password: "password-input",
    loginBtn: "login-button",
    loginError: "login-error",
  },
});

class LoginPage extends TypedPage<typeof config> {
  constructor(page: Page) {
    super(page, config);
  }
}
```

Usage:

```ts
await loginPage.fill("username", "admin");
await loginPage.fill("password", "password");
await loginPage.click("loginBtn");
await login.verify("loginError");
```

Benefits:

- Single source of truth
- Strong typing
- Less boilerplate
- Cleaner tests
- Easier maintenance

---

# Single Source of Truth

Everything begins with a page configuration.

```ts
const config = createPageConfig({
  url: "/transactions",

  testIds: {
    table: "transactions-table",
    next: "next-page",
    prev: "prev-page",
  },

  selectors: {
    pageTitle: "h1",
  },
});
```

This configuration owns:

- URLs
- testIds
- selectors

Everything else consumes this configuration.

```ts
await page.goto();

await page.click("next");

await page.verify("table");

await page.verifyURL();
```

When a locator changes, update it once.

Not across dozens of tests and page objects.

---

# TypedPage

`TypedPage` is the foundation of pw-core.

It transforms page configurations into fully typed automation objects.

```ts
class SettingsPage extends TypedPage<typeof config> {
  async toggleLogo() {
    await this.click("logoToggle");
  }
}
```

Automatically provides:

```ts
await page.goto();

await page.click("logoToggle");

await page.fill("username", "admin");

await page.check("rememberMe");

await page.hover("profile");

await page.textContent("message");

await page.verify("submit");

await page.verifyURL();
```

No locator declarations required.

---

# Readable Assertions

Traditional:

```ts
await expect(page.getByTestId("login-button")).toBeVisible();
```

pw-core:

```ts
await login.verify("loginBtn");
```

By default:

```ts
await login.verify("loginBtn");
```

is equivalent to:

```ts
await expect(page.getByTestId("login-button")).toBeVisible();
```

Custom assertions remain available:

```ts
await login.verify("loginBtn").toBeEnabled();

await login.verify("errorMessage").toContainText("Invalid");
```

---

# Chained Locators

Complex nested locators are common in large applications.

Traditional:

```ts
await page
  .getByTestId("transactions-table")
  .getByTestId("transaction-row")
  .nth(2)
  .dblclick();
```

pw-core:

```ts
await transactions.dblclick("table.transactionRows", { nth: 2 });
```

Traditional:

```ts
await page
  .locator('[data-testid="modal"]')
  .locator('[data-testid="form"]')
  .locator('[data-testid="submit"]')
  .click();
```

pw-core:

```ts
await page.click("modal.form.submit");
```

Assertions work the same way:

```ts
await page.verify("table.transactionRows").toHaveCount(10);
```

Nested locator chains stay readable regardless of depth.

---

# Components

Most applications reuse the same UI patterns:

- Tables
- Sidebars
- Filters
- Menus
- Forms
- Modals

Traditional frameworks often recreate these components repeatedly.

```ts
class UsersPage {
  usersTable = ...
}

class OrdersPage {
  ordersTable = ...
}

class ProductsPage {
  productsTable = ...
}
```

Same component.

Different implementation.

Duplicate maintenance.

---

## Reusable Components

With pw-core, components become first-class citizens.

```ts
export class TransactionsPage extends TypedPage<typeof config> {
  constructor(page: Page) {
    super(page, config);
    this.transactionsTable = new Table<Transaction>(tableLocator);
  }
}
```

Use the same component across:

- Users
- Orders
- Products
- Reports

Define once.

Same methods across pages, Reuse everywhere.

Exactly how frontend teams build reusable UI components.

---

# Page Registry

Not every page requires a custom Page Object.

Many pages only contain:

- URLs
- testIds
- selectors

For those pages, use `createPageRegistry`.

```ts
import { createPageRegistry } from "pw-core/page";

export const test = createPageRegistry({
  loginPage: {
    url: "/login",

    testIds: {
      username: "username-input",
      password: "password-input",
      submit: "login-button",
    },
  },
});
```

---

## Automatic Fixtures

Pages immediately become fixtures.

```ts
test("login", async ({ loginPage }) => {
  await loginPage.fill("username", "admin");

  await loginPage.fill("password", "password");

  await loginPage.click("submit");
});
```

No Page Object.

No fixture setup.

No boilerplate.

---

# Extending Registry Pages

As pages become more complex, you can extend them.

```ts
class LoginPage extends test.classes.loginPage {
  async login() {
    await this.fill("username", "admin");

    await this.fill("password", "password");

    await this.click("submit");
  }
}
```

Update the fixture:

```ts
export const test = registry.extend({
  loginPage: LoginPage,
});
```

Usage:

```ts
await loginPage.login();
```

Start simple.

Extend only when needed.

---

# AI-Friendly Automation

Most automation frameworks are inconsistent.

One page uses:

```ts
page.locator(...)
```

Another:

```ts
page.getByTestId(...)
```

Another:

```ts
page.getByRole(...)
```

Another:

```ts
page.locator(...).locator(...)
```

AI agents must understand every pattern.

With pw-core:

```ts
page.click(...)
page.fill(...)
page.verify(...)
page.locator(...)
```

Everything follows the same structure.

Benefits:

- Reduced context size
- Reduced token usage
- Better AI-generated automation
- Easier reviews
- Faster onboarding

---

# Package Overview

| Import                    | Purpose                                                  |
| ------------------------- | -------------------------------------------------------- |
| `pw-core`                 | Browser storage helpers                                  |
| `pw-core/page`            | TypedPage, Page Registry, assertions, page configuration |
| `pw-core/component/table` | Reusable typed table component                           |

---

# Documentation

| Document             | Description                                            |
| -------------------- | ------------------------------------------------------ |
| `docs/page.md`       | TypedPage, Page Registry, locator chaining, assertions |
| `docs/components.md` | Reusable UI components                                 |
| `docs/helpers.md`    | Browser storage helpers                                |

---

# When To Use TypedPage

Use TypedPage when:

- The page contains workflows
- The page contains business logic
- The page contains reusable actions
- Multiple tests interact with the page

Example:

```ts
await login.login();

await settings.toggleLogo("enable");
```

---

# When To Use Page Registry

Use Page Registry when:

- Pages only contain locators
- No custom methods are needed
- You want automatic fixtures
- You want minimal framework code

---

# Summary

pw-core is not a replacement for Playwright.

It is an architectural layer designed to create:

- Readable tests
- Reusable components
- Strongly typed pages
- Automatic fixtures
- Single source of truth configurations
- AI-friendly automation frameworks
- Scalable enterprise test suites

The larger the framework becomes, the more value pw-core provides.

---

More components, helpers, generators, and framework capabilities are planned.

Stay tuned.

## License

MIT
