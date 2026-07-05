# Chaining Rules in PW-Core

Chaining locators allows navigating complex structures safely and is designed to act as a semantic structure definition. To keep tests clean and maintain semantic boundaries, PW-Core enforces the following type-level rules on `testPage.chain()`:

## Rules of Chaining

### 1. First Selector must be a Universal Selector
The first element in any chain **must always** be defined under a `testId` or `selector` registry option. It cannot start with a semantic role option (like `heading`, `button`, `text`, `label`, etc.).
- **Valid**: `chain('container.username')` (First element `container` is under selectors).
- **Invalid**: `chain('Welcome Message.username')` (First element `Welcome Message` is a semantic text element).

### 2. No Consecutive Semantic Roles
No two semantic role elements can be chained directly together. Semantic elements must be separated or preceded by universal selectors (`testId`/`selector`).
- **Valid**: `chain('container.Main Dashboard')` (Universal followed by semantic).
- **Valid**: `chain('container.username.Main Dashboard')` (Universal, Universal, Semantic).
- **Invalid**: `chain('container.Agree to Terms.Option A')` (Two semantic items, `Agree to Terms` and `Option A`, are used consecutively).

---

## Examples

Given the page registry:
```ts
{
  testId: {
    username: 'username-input',
  },
  selector: {
    container: '.container'
  },
  heading: ['Main Dashboard'],
  checkbox: ['Agree to Terms'],
  radio: ['Option A']
}
```

### Valid Chained Calls
```ts
// Path-based chains:
testPage.chain('container.username')
testPage.chain('container.Main Dashboard')

// Argument-based chains:
testPage.chain('container', 'username')
testPage.chain('container', 'Main Dashboard')
```

### Invalid Chained Calls (Will trigger compile-time errors)
```ts
// Starts with semantic role:
testPage.chain('Main Dashboard.container')
testPage.chain('Agree to Terms.Option A')

// Consecutive semantic role elements:
testPage.chain('container.Agree to Terms.Option A')
```
