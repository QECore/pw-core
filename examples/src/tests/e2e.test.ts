import { expect } from '@playwright/test';
import { Table } from 'pw-core/component/table';
import { scenario } from '@utils/fixtures';

scenario('End-to-End User Flow on QECore App with Page Object Flows', async ({
  loginPage,
  dashboardPage,
  projectsPage,
  tasksPage,
  sidebar,
  topNav
}) => {
  // 1. Login (automatic page usage)
  await loginPage.goto();

  // Verify title and page element states
  await loginPage.verifyTitle(/PW-Core/);
  await loginPage.verify('defaultUserLogin').toBeEnabled();

  await loginPage.click('defaultUserLogin');
  await dashboardPage.verifyURL();

  // Verify dashboard page is loaded with soft assertions (toBeVisible is default and doesn't need to be chained)
  await dashboardPage.verify.soft('heading');
  await dashboardPage.verify.soft('heading').toHaveText('Dashboard');

  // 2. Create a Project (using custom overridden ProjectsPage flows)
  await sidebar.click('itemProjects');
  await projectsPage.verifyURL();

  // Verify elements are not present initially using verifyHidden
  await projectsPage.verifyHidden('formTitle');

  await projectsPage.createProject('Demo Project', 'A project created via pw-core automation.');
  await projectsPage.verifyProjectInTable('Demo Project');

  // 3. Create a Task (automatic page usage, creating Table component inline)
  await sidebar.click('itemTasks');
  await tasksPage.verifyURL();
  await tasksPage.click('newTask');

  // Verify element attributes using the typed expect wrapper
  await tasksPage.expect('formTitle').toBeVisible();

  await tasksPage.fill('formTitle', 'Demo Task');
  await tasksPage.fill('formDescription', 'A task created via pw-core automation.');
  await tasksPage.click('formSave');

  // Wait for the new task to appear in the table using built-in verify
  await tasksPage.verify('table', { hasText: 'Demo Task' });

  const taskTable = new Table<{ title: string }>(tasksPage.table);
  const taskHeaders = await taskTable.getHeaders();
  expect(taskHeaders).toContain('title');
  const taskRows = await taskTable.get();
  expect(taskRows.getAll('title')).toContain('Demo Task');

  // 4. Logout (automatic page usage)
  await topNav.hover('workspaceDropdown');
  await topNav.click('logoutBtn');
  await loginPage.verifyURL();
  await loginPage.verify('defaultUserLogin'); // Inbuilt visibility check
});
