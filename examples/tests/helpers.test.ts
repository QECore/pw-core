import { expect } from '@playwright/test';
import { scenario } from '../pages/fixtures';
import { getLocalStorage, setLocalStorage } from 'pw-core/helpers';

scenario('test local storage helpers from pw-core', async ({ page }) => {
  await page.goto('/');
  
  // Set value in localStorage
  await setLocalStorage(page, 'testKey', 'hello-world');

  // Get value from localStorage
  const value = await getLocalStorage(page, 'testKey');
  expect(value).toBe('hello-world');
  
  console.log('Successfully retrieved testKey:', value);
});
