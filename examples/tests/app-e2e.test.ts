import { expect } from '@playwright/test';
import { Table } from 'pw-core/component/table';
import { scenario } from '../pages/fixtures';

scenario('End-to-End User Flow on QECore App with Page Object Flows', async ({
  loginPage,
  dashboardPage,
  projectsPage,
  tasksPage,
  sidebar,
  topNav,
  page,
}) => {
  // 1. Login (automatic page usage)
  await loginPage.goto();
  await loginPage.click('defaultUserLogin');
  await page.waitForURL('**/app');
  
  // Verify dashboard page is loaded (automatic page usage)
  await dashboardPage.verify('heading').toBeVisible();

  // 2. Create a Project (using custom overridden ProjectsPage flows)
  await sidebar.click('itemProjects');
  await page.waitForURL('**/app/projects');
  await projectsPage.createProject('Demo Project', 'A project created via pw-core automation.');
  await projectsPage.verifyProjectInTable('Demo Project');

  // 3. Create a Task (automatic page usage, creating Table component inline)
  await sidebar.click('itemTasks');
  await page.waitForURL('**/app/tasks');
  await tasksPage.click('newTask');
  await tasksPage.fill('formTitle', 'Demo Task');
  await tasksPage.fill('formDescription', 'A task created via pw-core automation.');
  await tasksPage.click('formSave');

  const taskTable = new Table<{ title: string }>(tasksPage.table);
  const taskHeaders = await taskTable.getHeaders();
  expect(taskHeaders).toContain('title');
  const taskRows = await taskTable.get();
  expect(taskRows.getAll('title')).toContain('Demo Task');

  // 4. Logout (automatic page usage)
  await topNav.click('logoutBtn');
  await page.waitForURL('**/login');
  await loginPage.verify('defaultUserLogin').toBeVisible();
});
