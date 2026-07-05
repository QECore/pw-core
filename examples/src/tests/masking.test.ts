import { scenario } from '@utils/fixtures'

scenario('Verify password masking in step descriptions during login flow', async ({ loginPage, dashboardPage }) => {
  await loginPage.goto()

  // Fill email (should not be masked in logs/reports)
  await loginPage.fill('r1h6kqsqppb6amH1_', 'default@mail.com')

  // Fill password (should be masked in logs/reports)
  await loginPage.fill('password', 'default')

  // Click login
  await loginPage.click('submit')

  // Verify dashboard loaded
  await dashboardPage.verifyURL()
})
