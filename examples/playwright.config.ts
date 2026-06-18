import { defineConfig } from '@playwright/test';
import { env } from '@utils/env';

export default defineConfig({
  testDir: './src/tests',
  timeout: 10000,
  expect: {
    timeout: 5000,
  },
  reporter: [['html'], ['list']],
  use: {
    baseURL: env.url,
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chrome',
      use: { browserName: 'chromium' },
    }
  ]
});
