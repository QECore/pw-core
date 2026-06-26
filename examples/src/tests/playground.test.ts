import { scenario } from '@utils/fixtures';

scenario('Verify the playground - chart elements are visible', async ({ playground, dashboardPage }) => {
  // Navigation and tab setup
  // await playground.goto();
  await playground.page.goto("http://localhost:5173/playground");

  await playground.waitForLoadState('networkidle');

  // Click on the "Charts" tab to bring the chart components into view
  await playground.page.getByRole('tab', { name: 'Charts' }).click();
  
  // Verify dynamic selectors
  await playground.verify('safe');
  await playground.verify('danger');
  
  // Verify by dynamic testIds
  await playground.verify('activeLineChart');
  await playground.verify('inactiveLineChart').toBeDisabled();
  
  // Verify by chained locators + dynamic locator
  await playground.verify('card.activeBarChart');
  await playground.verifyDisabled('card.inactiveBarChart')
  await playground.verify('card.safe');
});




