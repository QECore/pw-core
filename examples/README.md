# Welcome to your pw-core Test Suite! 🚀

This test suite has been successfully initialized using `create-pw-core`. It is pre-configured with Playwright, TypeScript, and `pw-core` framework patterns.

## 📖 Documentation

For complete guides, API references, and framework concepts, please visit the official documentation:
👉 **[qecore.github.io/pw-core](https://qecore.github.io/pw-core)**

---

## 🛠️ VS Code Developer Experience

For a clean and focused workspace, we recommend configuring VS Code to hide generated files and folders (such as build artifacts, dependencies, and test reports).

You can review or customize these settings in:
📄 **[.vscode/settings.json](file:///.vscode/settings.json)**

### Recommended Settings:
```json
{
  "files.exclude": {
    "node_modules": true,
    "playwright-report": true,
    "test-results": true,
    "package-lock.json": true,
    "yarn.lock": true
  }
}
```

---

## 🚀 Running Your Tests

- **Run all E2E tests**:
  ```bash
  npm run test
  ```
- **Run tests in headed browser**:
  ```bash
  npm run test:headed
  ```
- **Show test execution report**:
  ```bash
  npm run test:report
  ```
