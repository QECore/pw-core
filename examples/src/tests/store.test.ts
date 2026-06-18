import { expect } from '@playwright/test';
import { scenario } from '@utils/fixtures';
import { 
  getLocalStorage, 
  setLocalStorage, 
  getSessionStorage, 
  setSessionStorage, 
  seedSessionStorage 
} from 'pw-core/helpers';

scenario('Verify local and session storage helpers', async ({ page }) => {
  await page.goto('/login');
  
  // 1. LocalStorage Helpers
  await setLocalStorage(page, 'localKey', 'localValue');
  const localVal = await getLocalStorage(page, 'localKey');
  expect(localVal).toBe('localValue');

  // 2. SessionStorage Helpers
  await setSessionStorage(page, 'sessionKey', 'sessionValue');
  const sessionVal = await getSessionStorage(page, 'sessionKey');
  expect(sessionVal).toBe('sessionValue');
});

scenario('Verify sessionStorage seeding helper', async ({ page }) => {
  // Add a cookie to simulate authenticated state and trigger sessionStorage seeding
  await page.context().addCookies([{
    name: 'auth-token',
    value: 'dummy-token-value',
    domain: 'qecore.github.io',
    path: '/'
  }]);

  // Seed sessionStorage before load/navigation
  await seedSessionStorage(page, { seededKey: 'seededValue' });
  
  await page.goto('/login');

  const seededVal = await getSessionStorage(page, 'seededKey');
  expect(seededVal).toBe('seededValue');
  
  console.log('Successfully seeded and retrieved sessionStorage value:', seededVal);
});
