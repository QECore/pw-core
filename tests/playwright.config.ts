import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  timeout: 10000,
  expect: {
    timeout: 5000,
  },
  reporter: 'list',
  use: {
    headless: true,
  },
});
