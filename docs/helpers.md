# Storage helpers

Browser storage utilities for Playwright tests.

```ts
import {
  getLocalStorage,
  setLocalStorage,
  getSessionStorage,
  setSessionStorage,
  seedSessionStorage,
} from 'pw-core/helpers';
```

| Function | Description |
|----------|-------------|
| `getLocalStorage(page, key)` | Read a localStorage value |
| `setLocalStorage(page, key, value)` | Write a localStorage value |
| `getSessionStorage(page, key)` | Read a sessionStorage value |
| `setSessionStorage(page, key, value)` | Write a sessionStorage value |
| `seedSessionStorage(page, entries)` | Pre-seed sessionStorage via `addInitScript` when cookies exist |

`seedSessionStorage` only runs when the browser context has cookies (e.g. from `storageState`), so unauthenticated tests are unaffected.
